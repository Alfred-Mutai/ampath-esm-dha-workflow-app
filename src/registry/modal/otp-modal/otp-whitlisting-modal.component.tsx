import React, { useEffect, useRef, useState } from 'react';
import {
  cancelAllPendingAuthorizations,
  getOtpWhitelistingStatus,
  getOtpWhitelistRequests,
  getPatientContacts,
} from '../../hie.resource';
import { Button, ComboBox, FormLabel, InlineLoading, InlineNotification, Tag, TextArea, TextInput } from '@carbon/react';
import { CheckmarkFilled, Chat, CloudUpload, DocumentPdf, Renew, SendAlt, TrashCan, WarningAlt } from '@carbon/react/icons';
import { usePatient } from '../../../context/patient-context';
import { useSession } from '@openmrs/esm-framework';
import { type OTPWhitelistRequest } from '../../hie.types';
import styles from './otp-whitlisting-modal.scss';

// Seconds a user must wait before the OTP can be resent.
const RESEND_COOLDOWN = 30;
const formatCountdown = (secs: number) => `0:${String(Math.max(0, secs)).padStart(2, '0')}`;

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface WhitelistFormErrors {
  file?: string;
  reasonType?: string;
  reasonDescription?: string;
}

interface WhitelistRequestResult {
  status?: string;
  guid?: string;
  reasonType?: string;
  reason?: string;
  beneficiaryCrId?: string;
  beneficiaryName?: string;
  facilityName?: string;
  attachments?: Array<{ guid: string; uploadedFile: string; description: string; contentType: string }>;
}

// Tag colour for the request status.
const statusTagType = (status?: string): 'green' | 'red' | 'blue' => {
  const s = (status ?? '').toUpperCase();
  if (s === 'APPROVED' || s === 'WHITELISTED') return 'green';
  if (s === 'REJECTED' || s === 'EXPIRED') return 'red';
  return 'blue';
};

interface OTPWhitlistingModalProps {
  onWhitelistStatusChange: (whitelisted: boolean) => void;
  onWhitelistSubmit: (payload: OTPWhitelistRequest) => Promise<unknown> | void;
  onSendClaimsOtp: () => void;
  onOtpVerified: (otp: string) => void;
  onOtpVerificationStatusChange: (verified: boolean) => void;
  submitting: boolean;
  otpSent: boolean;
  whitelistRequest: any;
  crId: string;
}

const OTPWhitlistingModal: React.FC<OTPWhitlistingModalProps> = ({
  onWhitelistStatusChange,
  onSendClaimsOtp,
  onWhitelistSubmit,
  onOtpVerified,
  submitting,
  otpSent,
  whitelistRequest,
  onOtpVerificationStatusChange,
  crId,
}) => {
  const [whitelisted, setWhitelisted] = useState<boolean | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonDescription, setReasonDescription] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendIn, setResendIn] = useState(0);
  // Which OTP action is in flight, so the buttons show the right label.
  const [otpBusy, setOtpBusy] = useState<'verify' | 'resend' | null>(null);
  // Set once the OTP is verified — swaps the panel to a "consent successful" state.
  const [consentGiven, setConsentGiven] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<WhitelistFormErrors>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submittingWhitelist, setSubmittingWhitelist] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState<WhitelistRequestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { patient } = usePatient();
  const session = useSession();
  const locationUuid = session.sessionLocation!.uuid;
  const [loadingWhitelistStatus, setLoadingWhitelistStatus] = useState(false);

  const REASON_TYPES = [
    'OLD',
    'AMPUTEE',
    'MEDICAL_CONDITION',
    'MENTALLY_UNSTABLE',
    'ONCOLOGY_TREATMENT',
    'DIALYSIS_TREATMENT',
    'CONSTRUCTION_WORKER',
    'OTHER',
    'EXPIRED',
    'BIOMETRIC_FAILURE',
    'CHILD_BELOW_7_YEARS',
    'PRIVACY_CONCERNS',
    'TECHNICAL_ISSUES',
  ];
  useEffect(() => {
    if (patient) {
      checkWhitelistStatus();
    }
  }, [patient]);

  useEffect(() => {
    if (!crId) return;

    const cancelPending = async () => {
      try {
        await cancelAllPendingAuthorizations(locationUuid, crId);
      } catch (error) {
        console.error('Failed to cancel pending authorizations:', error);
      }
    };

    cancelPending();
  }, [crId, locationUuid]);

  const checkWhitelistStatus = async () => {
    try {
      setLoadingWhitelistStatus(true);
      const res = await getOtpWhitelistingStatus(
        patient!.identification_number,
        patient!.identification_type,
        locationUuid,
      );

      let isWhitelisted = res?.whitelistedForOTP ?? false;

      if (!isWhitelisted) {
        // Not whitelisted by eligibility — look up any existing whitelist request.
        try {
          const list = await getOtpWhitelistRequests(patient!.id, locationUuid);
          const latest = list?.results?.[0];
          const status = (latest?.status ?? '').toUpperCase();
          if (status === 'APPROVED') {
            // Already approved → proceed to OTP consent.
            isWhitelisted = true;
            setSubmittedRequest(null);
          } else if (latest && status !== 'REJECTED' && status !== 'EXPIRED') {
            // Pending review — show the submitted-request state with a status check.
            setSubmittedRequest(latest as WhitelistRequestResult);
          } else {
            // No request (or rejected/expired) → show the whitelisting form.
            setSubmittedRequest(null);
          }
        } catch {
          setSubmittedRequest(null);
        }
      } else {
        setSubmittedRequest(null);
      }

      setWhitelisted(isWhitelisted);
      onWhitelistStatusChange(isWhitelisted);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingWhitelistStatus(false);
    }
  };

  useEffect(() => {
    const crId = patient!.id;
    async function fetchData() {
      try {
        const res = await getPatientContacts(crId, locationUuid);

        const phone = res?.results[0]?.contactValue;

        setPhoneNumber(phone ?? '');
      } catch (error) {
        console.error('Error fetching whitelist status:', error);
        setWhitelisted(false);
        onWhitelistStatusChange(false);
      }
    }

    fetchData();
  }, [onWhitelistStatusChange, patient, locationUuid]);

  // Start the resend cooldown and focus the first digit when a code is sent.
  useEffect(() => {
    if (otpSent) {
      setResendIn(RESEND_COOLDOWN);
      document.getElementById('otp-0')?.focus();
    }
  }, [otpSent]);

  // Tick the resend countdown down to zero.
  useEffect(() => {
    if (!otpSent || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [otpSent, resendIn]);

  // Clear the in-flight OTP action once the parent finishes (submitting → false).
  useEffect(() => {
    if (!submitting) {
      setOtpBusy(null);
    }
  }, [submitting]);

  // Build (and clean up) an object URL to preview an uploaded image.
  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  // Surface the required-field errors as soon as the whitelisting form appears,
  // so the fields show their red/invalid state on launch (not only after edits).
  useEffect(() => {
    if (whitelisted === false) {
      setErrors(validateForm());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whitelisted]);

  if (whitelisted === null) {
    return (
      <div className={styles.checkingState}>
        <InlineLoading className={styles.checking} description="Checking whitelisting…" />
      </div>
    );
  }

  const handleCheckStatus = async () => {
    await checkWhitelistStatus();
  };

  const validateFile = (candidate: File | null): string | undefined => {
    if (!candidate) {
      return 'A supporting document is required.';
    }
    if (!ACCEPTED_FILE_TYPES.includes(candidate.type)) {
      return 'Unsupported file type. Upload a PDF, PNG or JPG.';
    }
    if (candidate.size > MAX_FILE_SIZE) {
      return 'File is too large. The maximum size is 5 MB.';
    }
    return undefined;
  };

  const validateForm = (): WhitelistFormErrors => {
    const nextErrors: WhitelistFormErrors = {};

    const fileError = validateFile(file);
    if (fileError) {
      nextErrors.file = fileError;
    }

    if (!selectedReason) {
      nextErrors.reasonType = 'A reason type is required.';
    }

    if (!reasonDescription.trim()) {
      nextErrors.reasonDescription = 'A reason description is required.';
    } else if (reasonDescription.trim().length < 10) {
      nextErrors.reasonDescription = 'Provide at least 10 characters of detail.';
    }

    return nextErrors;
  };

  // Re-validate a field as the user edits it so errors surface (and clear) live.
  const revalidate = (field: keyof WhitelistFormErrors, error: string | undefined) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleFileSelected = (selected: File | null) => {
    setFile(selected);
    setErrors((prev) => ({ ...prev, file: validateFile(selected) }));
  };

  // Live form validity — the submit button is only enabled when this is true.
  const isFormValid =
    !validateFile(file) && Boolean(selectedReason) && reasonDescription.trim().length >= 10;

  const handleWhitelistSubmit = async () => {
    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitError('');
    setSubmittingWhitelist(true);
    try {
      const result = await onWhitelistSubmit({
        reasonType: selectedReason,
        reason: reasonDescription.trim(),
        crId: patient!.id,
        attachments_file_blob: file!,
        locationUuid,
      });
      // A successful request returns the created record — show its details.
      setSubmittedRequest((result as WhitelistRequestResult) ?? {});
    } catch (err) {
      // Surface the server message (strip the "Request failed with 400:" prefix).
      const message =
        err instanceof Error
          ? err.message.replace(/^Request failed with \d+:\s*/i, '')
          : 'Could not submit the whitelisting request. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmittingWhitelist(false);
    }
  };

  const isSubmitting = submitting || submittingWhitelist;

  const handleSendClaimsOtp = async () => {
    setOtpBusy('resend');
    onOtpVerificationStatusChange(false);
    onSendClaimsOtp();
    setResendIn(RESEND_COOLDOWN);
  };

  const handleVerifyClaimsOtp = async () => {
    setOtpBusy('verify');
    onOtpVerified(otp.join(''));
    onOtpVerificationStatusChange(true);
    setConsentGiven(true);
  };

  const focusOtp = (index: number) => {
    (document.getElementById(`otp-${index}`) as HTMLInputElement | null)?.focus();
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      focusOtp(index + 1);
    }
  };

  // Backspace on an empty field steps back to the previous one.
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      e.preventDefault();
      focusOtp(index - 1);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusOtp(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      focusOtp(index + 1);
    }
  };

  // Pasting a full code fills every field at once.
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i++) newOtp[i] = digits[i];
    setOtp(newOtp);
    focusOtp(Math.min(digits.length, 5));
  };

  return (
    <div>
      {whitelisted ? (
        consentGiven ? (
          <div className={styles.otpCard}>
            <span className={styles.successIcon}>
              <CheckmarkFilled size={24} />
            </span>
            <h4 className={styles.otpTitle}>Consent successful</h4>
            <p className={styles.otpHint}>
              The client has given consent. Proceed to initiate the SHA claim so the patient can be seen.
            </p>
          </div>
        ) : otpSent ? (
          <div className={styles.otpCard}>
            <span className={styles.otpIcon}>
              <Chat size={24} />
            </span>
            <h4 className={styles.otpTitle}>Enter OTP</h4>
            <p className={styles.otpHint}>
              {phoneNumber ? (
                <>
                  Enter the 6-digit code sent to <strong>{phoneNumber}</strong>.
                </>
              ) : (
                "Enter the 6-digit code sent to the client's registered phone number."
              )}
            </p>

            <div className={styles.otpInputs}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  id={`otp-${index}`}
                  labelText=""
                  hideLabel
                  size="lg"
                  value={digit}
                  maxLength={1}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  readOnly={submitting}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={index === 0 ? handleOtpPaste : undefined}
                  className={styles.otpDigit}
                />
              ))}
            </div>

            <div className={styles.otpActions}>
              <Button size="sm" onClick={handleVerifyClaimsOtp} disabled={otp.join('').length !== 6 || submitting}>
                {otpBusy === 'verify' && submitting ? 'Verifying…' : 'Verify OTP'}
              </Button>

              <Button kind="ghost" size="sm" onClick={handleSendClaimsOtp} disabled={submitting || resendIn > 0}>
                {otpBusy === 'resend' && submitting
                  ? 'Resending…'
                  : resendIn > 0
                    ? `Resend in ${formatCountdown(resendIn)}`
                    : 'Resend OTP'}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.otpCard}>
            <span className={styles.otpIcon}>
              <Chat size={24} />
            </span>
            <h4 className={styles.otpTitle}>OTP verification</h4>
            <p className={styles.otpHint}>
              {phoneNumber ? (
                <>
                  A one-time code will be sent by SMS to <strong>{phoneNumber}</strong>.
                </>
              ) : (
                "A one-time code will be sent by SMS to the client's registered phone number."
              )}
            </p>
            <Button
              className={styles.otpSend}
              size="sm"
              renderIcon={SendAlt}
              onClick={handleSendClaimsOtp}
              disabled={submitting}
            >
              {submitting ? 'Sending…' : 'Send OTP'}
            </Button>
          </div>
        )
      ) : submittedRequest || whitelistRequest ? (
        (() => {
          const req: WhitelistRequestResult = submittedRequest ?? whitelistRequest ?? {};
          const attachment = req.attachments?.[0];
          return (
            <div className={styles.whitelistCard}>
              <div className={styles.whitelistIntro}>
                <span className={styles.successIcon}>
                  <CheckmarkFilled size={20} />
                </span>
                <div>
                  <h4 className={styles.otpTitle}>Whitelisting request submitted</h4>
                  <p className={styles.otpHint}>
                    The request is <strong>{(req.status ?? 'PENDING').toLowerCase()}</strong> review. Once approved,
                    {req.beneficiaryName ? ` ${req.beneficiaryName}` : ' the client'} can verify by OTP.
                  </p>
                </div>
              </div>

              <div className={styles.whitelistDivider} />

              <dl className={styles.detailsGrid}>
                <div className={styles.detailRow}>
                  <dt>Status</dt>
                  <dd>
                    <Tag size="sm" type={statusTagType(req.status)}>
                      {req.status ?? 'PENDING'}
                    </Tag>
                  </dd>
                </div>
                {req.beneficiaryName ? (
                  <div className={styles.detailRow}>
                    <dt>Beneficiary</dt>
                    <dd>{req.beneficiaryName}</dd>
                  </div>
                ) : null}
                {req.beneficiaryCrId ? (
                  <div className={styles.detailRow}>
                    <dt>CR number</dt>
                    <dd>{req.beneficiaryCrId}</dd>
                  </div>
                ) : null}
                {req.reasonType ? (
                  <div className={styles.detailRow}>
                    <dt>Reason</dt>
                    <dd>{req.reasonType.replace(/_/g, ' ')}</dd>
                  </div>
                ) : null}
                {req.facilityName ? (
                  <div className={styles.detailRow}>
                    <dt>Facility</dt>
                    <dd>{req.facilityName}</dd>
                  </div>
                ) : null}
                {req.reason ? (
                  <div className={styles.detailRow}>
                    <dt>Notes</dt>
                    <dd>{req.reason}</dd>
                  </div>
                ) : null}
                {attachment ? (
                  <div className={styles.detailRow}>
                    <dt>Attachment</dt>
                    <dd>
                      <a href={attachment.uploadedFile} target="_blank" rel="noreferrer noopener">
                        {attachment.description || 'View document'}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>

              <Button
                className={styles.whitelistSubmit}
                kind="tertiary"
                size="md"
                renderIcon={Renew}
                onClick={handleCheckStatus}
                disabled={loadingWhitelistStatus}
              >
                {loadingWhitelistStatus ? 'Checking…' : 'Check whitelist status'}
              </Button>
            </div>
          );
        })()
      ) : (
        <div className={styles.whitelistCard}>
          <div className={styles.whitelistIntro}>
            <span className={styles.whitelistIcon}>
              <WarningAlt size={20} />
            </span>
            <div>
              <h4 className={styles.otpTitle}>Phone number not whitelisted</h4>
              <p className={styles.otpHint}>
                {phoneNumber ? <strong>{phoneNumber}</strong> : 'This phone number'} isn&apos;t approved to receive OTP
                codes. Submit the request below with a supporting document — once approved, the client can verify by
                OTP.
              </p>
            </div>
          </div>

          <div className={styles.whitelistDivider} />

          <div className={styles.whitelistForm}>
            <span className={styles.whitelistFormTitle}>Request details</span>
            <div className={styles.uploadField}>
              <FormLabel>
                Supporting document <span className={styles.required}>*</span>
              </FormLabel>
              <p className={styles.uploadHint}>PDF or image (PNG / JPG) · one file · max 5 MB</p>
              {file ? (
                // A single file is uploaded — preview it with a remove action.
                // Removing brings the dropzone back so another can be chosen.
                <div className={`${styles.filePreview} ${errors.file ? styles.filePreviewInvalid : ''}`}>
                  {previewUrl ? (
                    <img src={previewUrl} alt={file.name} className={styles.previewThumb} />
                  ) : (
                    <span className={styles.previewIcon}>
                      <DocumentPdf size={24} />
                    </span>
                  )}
                  <div className={styles.previewMeta}>
                    <span className={styles.previewName} title={file.name}>
                      {file.name}
                    </span>
                    <span className={styles.previewSize}>{formatBytes(file.size)}</span>
                  </div>
                  <Button
                    kind="ghost"
                    size="sm"
                    hasIconOnly
                    iconDescription="Remove file"
                    renderIcon={TrashCan}
                    onClick={() => handleFileSelected(null)}
                  />
                </div>
              ) : (
                <div
                  className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''} ${
                    errors.file ? styles.dropZoneInvalid : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-invalid={Boolean(errors.file)}
                  aria-describedby={errors.file ? 'supporting-document-error' : undefined}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) {
                      handleFileSelected(dropped);
                    }
                  }}
                >
                  <span className={styles.dropIcon}>
                    <CloudUpload size={24} />
                  </span>
                  <span className={styles.dropTitle}>Drag and drop a file here</span>
                  <span className={styles.dropSubtitle}>or click to browse</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className={styles.hiddenInput}
                    onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              {errors.file ? (
                <div id="supporting-document-error" className={styles.fieldError} role="alert">
                  {errors.file}
                </div>
              ) : null}
            </div>

            {/* Lock the chosen reason so it can't be partially edited; Backspace/✕ clears it. */}
            <div
              onKeyDownCapture={(e) => {
                if (!selectedReason || e.ctrlKey || e.metaKey || e.altKey) {
                  return;
                }
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedReason('');
                  revalidate('reasonType', 'A reason type is required.');
                } else if (e.key.length === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <ComboBox
                id="reason-type"
                titleText={
                  <>
                    Reason type <span className={styles.required}>*</span>
                  </>
                }
                placeholder="Search a reason"
                items={REASON_TYPES}
                itemToString={(item) => (item ? item.replace(/_/g, ' ') : '')}
                shouldFilterItem={({ item, inputValue }) => {
                  const selectedLabel = selectedReason ? selectedReason.replace(/_/g, ' ') : '';
                  // Reopening on a selection lists every reason (the chosen one is
                  // highlighted); only a fresh typed query narrows the list.
                  if (!inputValue || inputValue === selectedLabel) {
                    return true;
                  }
                  return (item ?? '').replace(/_/g, ' ').toLowerCase().includes(inputValue.toLowerCase());
                }}
                selectedItem={selectedReason || null}
                invalid={Boolean(errors.reasonType)}
                invalidText={errors.reasonType}
                onChange={({ selectedItem }) => {
                  setSelectedReason(selectedItem ?? '');
                  revalidate('reasonType', selectedItem ? undefined : 'A reason type is required.');
                }}
              />
            </div>

            <TextArea
              id="reason-description"
              labelText={
                <>
                  Reason description <span className={styles.required}>*</span>
                </>
              }
              placeholder="Provide additional details…"
              value={reasonDescription}
              invalid={Boolean(errors.reasonDescription)}
              invalidText={errors.reasonDescription}
              onChange={(e) => {
                const value = e.target.value;
                setReasonDescription(value);
                revalidate(
                  'reasonDescription',
                  !value.trim()
                    ? 'A reason description is required.'
                    : value.trim().length < 10
                      ? 'Provide at least 10 characters of detail.'
                      : undefined,
                );
              }}
            />

            {submitError ? (
              <InlineNotification
                kind="error"
                lowContrast
                hideCloseButton
                title="Whitelisting request failed"
                subtitle={submitError}
                className={styles.submitError}
              />
            ) : null}

            <Button
              className={styles.whitelistSubmit}
              size="md"
              renderIcon={SendAlt}
              onClick={handleWhitelistSubmit}
              // Enabled only when the whole form is valid; shows the busy state in-place.
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting ? 'Submitting…' : 'Submit whitelisting request'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OTPWhitlistingModal;
