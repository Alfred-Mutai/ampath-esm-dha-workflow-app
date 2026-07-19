import React, { useEffect, useState } from 'react';
import { cancelAllPendingAuthorizations, getOtpWhitelistingStatus, getPatientContacts } from '../../hie.resource';
import { Button, InlineLoading, Select, SelectItem, TextArea, FileUploader, TextInput } from '@carbon/react';
import { usePatient } from '../../../context/patient-context';
import { useSession } from '@openmrs/esm-framework';
import { type OTPWhitelistRequest } from '../../hie.types';

interface OTPWhitlistingModalProps {
  onWhitelistStatusChange: (whitelisted: boolean) => void;
  onWhitelistSubmit: (payload: OTPWhitelistRequest) => void;
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

      const isWhitelisted = res?.whitelistedForOTP ?? false;

      setWhitelisted(isWhitelisted);

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

  if (whitelisted === null) {
    return (
      <div>
        <InlineLoading description="Checking whitelist status..." />
      </div>
    );
  }

  const handleCheckStatus = async () => {
    await checkWhitelistStatus();
  };

  const handleWhitelistSubmit = async () => {
    if (!file) {
      alert('Please upload a supporting document.');
      return;
    }

    if (!selectedReason) {
      alert('Please select a reason type.');
      return;
    }

    if (!reasonDescription.trim()) {
      alert('Please provide additional description to support reason type.');
      return;
    }

    onWhitelistSubmit({
      reasonType: selectedReason,
      reason: reasonDescription,
      crId: patient!.id,
      attachments_file_blob: file,
      locationUuid,
    });
  };

  const handleSendClaimsOtp = async () => {
    onOtpVerificationStatusChange(false);
    onSendClaimsOtp();
  };

  const handleVerifyClaimsOtp = async () => {
    onOtpVerified(otp.join(''));
    onOtpVerificationStatusChange(true);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      (nextInput as HTMLInputElement)?.focus();
    }
  };

  return (
    <div>
      {whitelisted ? (
        otpSent ? (
          <>
            <h2>Enter OTP</h2>

            <p>
              Enter the OTP sent to <strong>{phoneNumber}</strong>
            </p>

            <div style={{ display: 'flex', gap: '3rem', marginTop: '1rem' }}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  id={`otp-${index}`}
                  labelText=""
                  hideLabel
                  value={digit}
                  maxLength={1}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  style={{
                    width: '3rem',
                    textAlign: 'center',
                  }}
                />
              ))}
            </div>

            <div
              style={{
                marginTop: '1rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              <Button onClick={handleVerifyClaimsOtp} disabled={otp.join('').length !== 6 || submitting}>
                {submitting ? 'Verifying...' : 'Verify OTP'}
              </Button>

              <Button onClick={handleSendClaimsOtp} disabled={submitting}>
                {submitting ? 'Sending...' : 'Resend OTP'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2>OTP Verification</h2>

            <p>
              OTP will be sent to <strong>{phoneNumber}</strong>
            </p>

            <Button onClick={handleSendClaimsOtp} disabled={submitting}>
              {submitting ? 'Sending...' : 'Send OTP'}
            </Button>
          </>
        )
      ) : whitelistRequest ? (
        <>
          <h2>Whitelisting Request Submitted</h2>

          <p>
            Status: <strong>{whitelistRequest.status}</strong>
          </p>

          <p>
            Beneficiary: <strong>{whitelistRequest.beneficiaryName}</strong>
          </p>

          <div style={{ marginTop: '1rem' }}>
            <Button disabled={submitting} onClick={handleCheckStatus}>
              {submitting ? 'Submitting...' : 'Refresh Status'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2>Phone Number Whitelisting Status</h2>

          <p>
            The phone number <strong>{phoneNumber}</strong> is not whitelisted.
          </p>

          <div style={{ marginTop: '1rem' }}>
            <FileUploader
              labelTitle="Supporting Document"
              buttonLabel="Upload file"
              accept={['.pdf', '.jpg', '.jpeg', '.png']}
              filenameStatus="edit"
              onChange={(event) => {
                const selectedFile = (event.target as HTMLInputElement).files?.[0] ?? null;
                setFile(selectedFile);
              }}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Select
              id="reason-type"
              labelText="Reason Type"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
            >
              <SelectItem value="" text="Select a reason" />

              {REASON_TYPES.map((reason) => (
                <SelectItem key={reason} value={reason} text={reason.replace(/_/g, ' ')} />
              ))}
            </Select>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <TextArea
              id="reason-description"
              labelText="Reason Description"
              placeholder="Provide additional details..."
              value={reasonDescription}
              onChange={(e) => setReasonDescription(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Button
              onClick={handleWhitelistSubmit}
              disabled={submitting || !file || !selectedReason || !reasonDescription.trim()}
            >
              {submitting ? 'Submitting...' : 'Submit Whitelisting Request'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default OTPWhitlistingModal;
