import React, { useEffect, useState } from 'react';
import { Button, Dropdown, RadioButton, RadioButtonGroup, TextInput } from '@carbon/react';
import { CheckmarkFilled, CheckmarkOutline, Information, Renew, WarningAltFilled } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import { OtpOptions, OtpStatus, type RequestCustomOtpDto } from '../types';
import { requestCustomOtp, validateCustomOtp } from '../registry.resource';
import { maskAllButFirstAndLastThree, maskPhone } from '../utils/mask-data';
import { getReadableErrorMessage } from '../utils/error-handler';
import { formatPhoneNumberForOTP } from '../utils/phone-number-formatter';
import OTPInput from '../../shared/ui/otp-input/otp-input.component';
import styles from './workflow-drawer.component.scss';

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Resend becomes available after a short cooldown, separate from the 5-min code expiry.
const RESEND_COOLDOWN_SECONDS = 30;

// Reasons a worker may need to send the OTP to a number other than the one on
// record. Presented as an option set when overriding.
const OVERRIDE_REASONS = [
  'Registered phone is unreachable',
  'Wrong number on record',
  'Patient has no phone',
  'Using next of kin / guardian phone',
  'Other',
];

interface OtpVerificationStepProps {
  requestCustomOtpDto: RequestCustomOtpDto;
  phoneNumber: string;
  onVerified: () => void;
  timerSeconds?: number;
  biometricFailedCount?: number;
}

const OtpVerificationStep: React.FC<OtpVerificationStepProps> = ({
  requestCustomOtpDto,
  phoneNumber,
  onVerified,
  timerSeconds = 60,
  biometricFailedCount = 0,
}) => {
  const [otp, setOtp] = useState('');
  const [otpStatus, setOtpStatus] = useState<string>(OtpStatus.Draft);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [otpAttempt, setOtpAttempt] = useState(0);
  const [sentTo, setSentTo] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [expiresIn, setExpiresIn] = useState(timerSeconds);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const [overrideOtp, setOverrideOtp] = useState<OtpOptions>(
    requestCustomOtpDto.phoneNumber ? OtpOptions.NoOverride : OtpOptions.Override,
  );
  const [alternativePhoneNo, setAlternativePhoneNo] = useState<string>();
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [sendError, setSendError] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const showAlert = (kind: 'error' | 'success', title: string, subtitle: string) =>
    showSnackbar({ kind, title, subtitle });

  const getOtpPayload = (): RequestCustomOtpDto => {
    if (overrideOtp === OtpOptions.Override) {
      // Retain the client's original ID number; only the phone number is overridden.
      return {
        ...requestCustomOtpDto,
        phoneNumber: alternativePhoneNo ? formatPhoneNumberForOTP(alternativePhoneNo) : '',
      };
    }
    return requestCustomOtpDto;
  };

  // Inline validation for the override (alternative-number) fields.
  const validateOverride = (): boolean => {
    let valid = true;
    const phone = (alternativePhoneNo ?? '').trim();
    if (!phone) {
      setPhoneError('Alternative phone number is required');
      valid = false;
    } else if (phone.replace(/\D/g, '').length < 9) {
      setPhoneError('Enter a valid phone number');
      valid = false;
    } else {
      setPhoneError('');
    }
    if (!overrideReason) {
      setReasonError('Select an override reason');
      valid = false;
    } else {
      setReasonError('');
    }
    return valid;
  };

  const handleSendOtp = async () => {
    // When overriding, the alternative number and a reason are required.
    if (overrideOtp === OtpOptions.Override) {
      if (!validateOverride()) {
        return;
      }
    } else if (!requestCustomOtpDto.identificationNumber) {
      showAlert('error', 'Invalid identification value', 'Please enter a valid ID value');
      return;
    }
    setLoading(true);
    setSendError('');
    try {
      const response = await requestCustomOtp(getOtpPayload());
      setSessionId(response.sessionId);
      setSentTo(response.maskedPhone); // shown in-page instead of a toast
      setCanResend(false); // resend re-enables only once the countdown ends
      setOtpStatus(OtpStatus.Sent);
      setOtpAttempt((n) => n + 1); // remount the timer so it restarts from full duration
    } catch (err: any) {
      // Surface the failure inline (not just a toast) so the worker can retry in place.
      const reason = getReadableErrorMessage(err, 'We couldn’t send the OTP. Please retry.');
      setSendError(reason);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      showAlert('error', 'Please enter the OTP code', '');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    try {
      await validateCustomOtp({ sessionId, otp, locationUuid: requestCustomOtpDto.locationUuid });
      setOtpStatus(OtpStatus.Verified);
    } catch (err: any) {
      // Communicate the failure inline so the worker can re-enter the code neatly.
      const reason = getReadableErrorMessage(err, 'The code couldn’t be verified. Please retry.');
      setVerifyError(reason);
    } finally {
      setVerifying(false);
    }
  };

  // Return to the OTP options (where to send / alternative / skip).
  const backToOptions = () => {
    setOtp('');
    setOtpStatus(OtpStatus.Draft);
  };

  const handleOverrideSelection = (selection: OtpOptions) => {
    // Skip no longer verifies immediately — the worker must confirm first.
    setOverrideOtp(selection);
  };

  const confirmSkip = () => {
    setOtpStatus(OtpStatus.Verified);
  };

  // After each send, run two countdowns: the 5-min code expiry and the 30-sec
  // resend cooldown. Resend enables when the cooldown reaches zero.
  useEffect(() => {
    if (otpStatus !== OtpStatus.Sent) {
      return;
    }
    setExpiresIn(timerSeconds);
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setCanResend(false);
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += 1;
      setExpiresIn(Math.max(0, timerSeconds - elapsed));
      const remainingResend = Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
      setResendIn(remainingResend);
      if (remainingResend === 0) {
        setCanResend(true);
      }
      if (elapsed >= timerSeconds) {
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpStatus, otpAttempt]);

  // Let the drawer advance to the next step once verification succeeds.
  useEffect(() => {
    if (otpStatus === OtpStatus.Verified) {
      onVerified();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpStatus]);

  return (
    <div className={styles.stepContent}>
      {otpStatus === OtpStatus.Draft ? (
        <>
          <div className={styles.infoNote}>
            <Information size={20} className={styles.infoNoteIcon} />
            <p className={styles.infoNoteText}>Verify the patient&apos;s identity with a One-Time Password (OTP).</p>
          </div>
          {/* Explains why we're on OTP — hidden once the code is sent */}
          {biometricFailedCount >= 3 ? (
            <div className={styles.fallbackNote}>
              <Information size={18} className={styles.fallbackNoteIcon} />
              <span>Fingerprint failed {biometricFailedCount} times. Verify the patient with an OTP instead.</span>
            </div>
          ) : null}
          <div className={styles.otpChoiceCard}>
            <RadioButtonGroup
              orientation="vertical"
              valueSelected={overrideOtp}
              legendText="Where should the OTP be sent?"
              onChange={(v) => handleOverrideSelection(v as OtpOptions)}
              name="otp-override-group"
              disabled={loading}
            >
              {requestCustomOtpDto?.phoneNumber && (
                <RadioButton
                  id="no-override"
                  labelText={
                    <span>
                      Send code to registered phone{' '}
                      <span className={styles.phoneChip}>{maskAllButFirstAndLastThree(phoneNumber)}</span>
                    </span>
                  }
                  value={OtpOptions.NoOverride}
                />
              )}
              <RadioButton id="override" labelText="Send OTP to an alternative number" value={OtpOptions.Override} />
              <RadioButton id="skip" labelText="Skip OTP verification" value={OtpOptions.Skip} />
            </RadioButtonGroup>
          </div>

          {/* Override: alternative number + reason (an option set) */}
          {overrideOtp === OtpOptions.Override ? (
            <div className={styles.overrideFields}>
              <TextInput
                id="override-phone"
                labelText={
                  <span>
                    Alternative phone number <span className={styles.required}>*</span>
                  </span>
                }
                value={alternativePhoneNo ?? ''}
                onChange={(e) => {
                  setAlternativePhoneNo(e.target.value);
                  if (phoneError) {
                    setPhoneError('');
                  }
                }}
                onBlur={validateOverride}
                invalid={!!phoneError}
                invalidText={phoneError}
                placeholder="Enter phone number"
                disabled={loading}
              />
              <Dropdown
                id="override-reason"
                titleText={
                  <span>
                    Override reason <span className={styles.required}>*</span>
                  </span>
                }
                label="Select a reason"
                items={OVERRIDE_REASONS}
                selectedItem={overrideReason}
                onChange={({ selectedItem }) => {
                  setOverrideReason(selectedItem as string);
                  setReasonError('');
                }}
                invalid={!!reasonError}
                invalidText={reasonError}
                disabled={loading}
              />
            </div>
          ) : (
            <></>
          )}

          {/* Skip requires an explicit confirmation */}
          {overrideOtp === OtpOptions.Skip ? (
            <>
              <div className={styles.noticeBox}>
                <WarningAltFilled size={20} className={styles.noticeIcon} />
                <div>
                  <h5 className={styles.noticeTitle}>Skip identity verification?</h5>
                  <p className={styles.centerText}>
                    The patient&apos;s identity won&apos;t be confirmed by OTP. Only skip if you have verified them
                    another way.
                  </p>
                </div>
              </div>
              <Button kind="danger" size="sm" className={styles.otpPrimaryBtn} onClick={confirmSkip}>
                Confirm skip
              </Button>
            </>
          ) : (
            <>
              {sendError ? (
                <div className={styles.errorNote}>
                  <WarningAltFilled size={20} className={styles.errorNoteIcon} />
                  <p className={styles.errorNoteText}>{sendError} Please try again.</p>
                </div>
              ) : null}
              <Button
                kind="primary"
                size="sm"
                className={styles.otpPrimaryBtn}
                disabled={
                  loading ||
                  (overrideOtp === OtpOptions.Override && (!alternativePhoneNo?.trim() || !overrideReason))
                }
                onClick={handleSendOtp}
              >
                {loading ? 'Sending OTP…' : sendError ? 'Send OTP again' : 'Send OTP'}
              </Button>
            </>
          )}
        </>
      ) : (
        <></>
      )}

      {otpStatus === OtpStatus.Sent ? (
        <div className={styles.otpForm}>
          {/* Visible confirmation of where the code was sent */}
          <div className={styles.otpSentBanner}>
            <CheckmarkFilled size={18} className={styles.otpSentIcon} />
            <span>
              A one-time code was sent to <strong>{maskPhone(sentTo)}</strong>. Ask the patient to share it with you.
            </span>
          </div>

          <div className={styles.otpEntry}>
            <span className={styles.otpEntryLabel}>Enter the 5-digit OTP</span>
            <OTPInput
              otpLength={5}
              disabled={verifying || loading}
              onChange={(value) => {
                setOtp(value);
                if (verifyError) {
                  setVerifyError('');
                }
              }}
            />
            <span className={styles.otpExpiry}>
              {expiresIn > 0 ? `Code expires in ${formatTime(expiresIn)}` : 'Code expired'}
            </span>
          </div>

          {verifyError ? (
            <div className={styles.errorNote}>
              <WarningAltFilled size={20} className={styles.errorNoteIcon} />
              <div className={styles.errorNoteBody}>
                <span className={styles.errorNoteTitle}>We couldn&apos;t verify that code</span>
                <p className={styles.errorNoteText}>{verifyError}</p>
              </div>
            </div>
          ) : null}

          <div className={styles.otpActions}>
            {/* Resend counts down (30s) and only becomes clickable when it reaches zero */}
            {canResend ? (
              <Button kind="ghost" size="sm" renderIcon={Renew} disabled={loading} onClick={handleSendOtp}>
                {loading ? 'Resending…' : 'Resend code'}
              </Button>
            ) : (
              <span className={styles.resendCountdown}>Resend in {resendIn}s</span>
            )}
            <Button
              kind="primary"
              size="sm"
              renderIcon={CheckmarkOutline}
              disabled={loading || verifying || otp.length !== 5}
              onClick={handleVerifyOtp}
            >
              {verifying ? 'Verifying…' : 'Verify'}
            </Button>
          </div>

          {/* Way back to the OTP options if the patient isn't receiving the code */}
          <p className={styles.otpHelp}>
            Didn&apos;t receive the code?{' '}
            <button type="button" className={styles.linkBtn} onClick={backToOptions}>
              Change how it&apos;s sent
            </button>
          </p>
        </div>
      ) : (
        <></>
      )}
    </div>
  );
};

export default OtpVerificationStep;
