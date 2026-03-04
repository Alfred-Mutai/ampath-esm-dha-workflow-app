import React, { useState } from 'react';
import { OtpOptions, OtpStatus, type RequestCustomOtpDto } from '../../types';
import {
  Button,
  FormLabel,
  InlineLoading,
  Modal,
  ModalBody,
  RadioButton,
  RadioButtonGroup,
  TextInput,
} from '@carbon/react';
import styles from './otp-verification-modal.scss';
import { showSnackbar } from '@openmrs/esm-framework';
import { requestCustomOtp, validateCustomOtp } from '../../registry.resource';
import { maskAllButFirstAndLastThree } from '../../utils/mask-data';
import OTPInput from '../../../shared/ui/otp-input/otp-input.component';
import Timer from '../../../shared/ui/timer/timer.component';

interface OtpVerificationModalpProps {
  requestCustomOtpDto: RequestCustomOtpDto;
  phoneNumber: string;
  open: boolean;
  onModalClose: () => void;
  onOtpSuccessfullVerification: () => void;
}
const OtpVerificationModal: React.FC<OtpVerificationModalpProps> = ({
  requestCustomOtpDto,
  phoneNumber,
  open,
  onModalClose,
  onOtpSuccessfullVerification,
}) => {
  const [otp, setOtp] = useState('');
  const [otpStatus, setOtpStatus] = useState<string>(OtpStatus.Draft);
  const [loading, setLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [overrideOtp, setOverideOtp] = useState<OtpOptions>(OtpOptions.NoOverride);
  const [alternativeIdNo, setAlternativeIdNo] = useState<string>();

  const handleSendOtp = async () => {
    if (!requestCustomOtpDto.identificationNumber && !alternativeIdNo) {
      showAlert('error', 'Invalid Identification Value', 'Please enter a valid ID value');
      return;
    }
    setLoading(true);
    try {
      const response = await requestCustomOtp(getOtpPayload());
      setSessionId(response.sessionId);
      setOtpStatus(OtpStatus.Sent);

      showAlert('success', 'OTP sent successfully', `A code was sent to ${response.maskedPhone}`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send OTP';
      showAlert('error', 'Error sending OTP', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  const getOtpPayload = (): RequestCustomOtpDto => {
    let payload: RequestCustomOtpDto = null;
    if (overrideOtp === OtpOptions.Override) {
      payload = {
        ...requestCustomOtpDto,
        identificationNumber: alternativeIdNo,
      };
    } else {
      payload = requestCustomOtpDto;
    }

    return payload;
  };
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      showAlert('error', 'Please enter the OTP code', '');
      return;
    }

    setLoading(true);

    try {
      const payload = { sessionId, otp, locationUuid: requestCustomOtpDto.locationUuid };
      await validateCustomOtp(payload);

      setOtpStatus(OtpStatus.Verified);

      showSnackbar({
        kind: 'success',
        title: 'OTP Verified',
        subtitle: 'You can now fetch data from Client Registry.',
      });
    } catch (err: any) {
      const errorMessage = err.message || 'OTP verification failed';
      showSnackbar({
        kind: 'error',
        title: 'OTP Verification Failed',
        subtitle: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = () => {};
  const handleTimeUp = () => {
    if (OtpStatus.Sent) {
      setOtpStatus(OtpStatus.Draft);
    }
  };
  const getPrimaryButtonFunc = () => {
    if (otpStatus === OtpStatus.Draft) {
      return handleSendOtp();
    }
    if (otpStatus === OtpStatus.Sent) {
      return handleVerifyOtp();
    }
    if (otpStatus === OtpStatus.Verified) {
      return onOtpSuccessfullVerification();
    }
  };
  const getPrimaryButtonText = (): any => {
    if (otpStatus === OtpStatus.Draft) {
      if (loading) {
        return 'Sending OTP...';
      } else {
        return 'Send OTP';
      }
    }
    if (otpStatus === OtpStatus.Sent) {
      if (loading) {
        return 'Verifying OTP...';
      } else {
        return 'Verify';
      }
    }
    if (otpStatus === OtpStatus.Verified) {
      if (loading) {
        return 'loading...';
      } else {
        return 'Continue';
      }
    }
    return '';
  };
  const handleOtpOverrideSelection = (overrideSelection: OtpOptions) => {
    setOverideOtp(overrideSelection);
    if (overrideSelection === OtpOptions.Skip) {
      setOtpStatus(OtpStatus.Verified);
    }
  };
  const handleAlternativeIdNo = (alternativeNo: string) => {
    setAlternativeIdNo(alternativeNo);
  };
  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={getPrimaryButtonFunc}
        primaryButtonText={getPrimaryButtonText()}
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.modalVerificationLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>One Time Password (OTP)</h4>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.contentHeader}>
                {otpStatus === OtpStatus.Draft ? (
                  <>
                    <RadioButtonGroup
                      defaultSelected={OtpOptions.NoOverride}
                      legendText="OTP Override"
                      onChange={(v) => handleOtpOverrideSelection(v as OtpOptions)}
                      name="override-button-default-group"
                    >
                      <RadioButton
                        id="no-override"
                        labelText={`Send Code to Phone ${maskAllButFirstAndLastThree(phoneNumber)}?`}
                        value={OtpOptions.NoOverride}
                      />
                      <RadioButton
                        id="override"
                        labelText="Send OTP to alternative contact"
                        value={OtpOptions.Override}
                      />

                      <RadioButton id="skip" labelText="Skip OTP" value={OtpOptions.Skip} />
                    </RadioButtonGroup>

                    {overrideOtp === OtpOptions.Override ? (
                      <>
                        <div className={styles.formControl}>
                          <TextInput
                            id="override-number"
                            labelText="Use alternative ID number and OTP will be sent to their phone number"
                            onChange={(e) => handleAlternativeIdNo(e.target.value)}
                            required={true}
                            placeholder="Enter National ID"
                          />
                        </div>
                      </>
                    ) : (
                      <></>
                    )}
                  </>
                ) : (
                  <></>
                )}

                {otpStatus === OtpStatus.Verified ? (
                  <>
                    {overrideOtp === OtpOptions.Skip ? (
                      <>
                        <h6>OTP Verification Skipped! Continue</h6>
                      </>
                    ) : (
                      <>
                        <h6>OTP Verification Successfull!</h6>
                      </>
                    )}
                  </>
                ) : (
                  <></>
                )}
              </div>
              <div className={styles.otpSection}>
                {otpStatus === OtpStatus.Sent ? (
                  <>
                    <div className={styles.otpForm}>
                      <h6>(Enter one time password to proceed)</h6>
                      <FormLabel>Enter OTP</FormLabel>
                      <OTPInput otpLength={5} onChange={(value) => setOtp(value)} />
                    </div>
                    <div className={styles.otpTimer}>
                      <Timer durationInSeconds={60} resetTimer={() => {}} onTimeUp={handleTimeUp} />
                    </div>
                  </>
                ) : (
                  <></>
                )}
              </div>
            </div>
            <div className={styles.sectionAction}></div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default OtpVerificationModal;
