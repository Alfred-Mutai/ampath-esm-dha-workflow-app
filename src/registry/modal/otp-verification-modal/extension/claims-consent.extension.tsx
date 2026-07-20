import { ModalBody, ModalHeader } from '@carbon/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Intervention, type VisitType } from '../../../../claims';
import ClaimsConsentModal from '../claims-consent';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { cancelAllPendingAuthorizations, createOTPWhitelisting, sendClaimsOTP } from '../../../hie.resource';
import { type OTPWhitelistRequest } from '../../../hie.types';
import { getServiceType } from '../../../../shared/services/claims.resource';
import { PatientProvider } from '../../../../context/patient-context';
import { type HieClient } from '../../../types';

interface ClaimsConsentExtensionProps {
  patient: HieClient;
  intervention: Intervention;
  crIdentifierId: string;
  visitType: VisitType;
  onClientConsent: ({ otp, authGuid }: { otp?: string; authGuid?: string }) => void;
  onAuthGuidReceived?: (authGuid: string) => void;
}

const ClaimsConsentExtension: React.FC<ClaimsConsentExtensionProps> = ({
  patient,
  intervention,
  crIdentifierId,
  visitType,
  onClientConsent,
  onAuthGuidReceived,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [whitelistRequest, setWhitelistRequest] = useState(null);
  const [authGuid, setAuthGuid] = useState<string>();
  const { t } = useTranslation();
  const sessionLocation = useSession();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('Grandparent received:', authGuid);
  }, [authGuid]);

  useEffect(() => {
    if (authGuid) {
      onAuthGuidReceived?.(authGuid);
    }
  }, [authGuid, onAuthGuidReceived]);

  const handleVerifyOtp = async (otp: string) => {
    try {
      setSubmitting(true);

      setOtpVerified(true);

      onClientConsent({ otp });

      showSnackbar({
        kind: 'success',
        title: 'OTP Verified',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhitelistSubmit = async (payload: OTPWhitelistRequest) => {
    return await createOTPWhitelisting(payload);
  };

  const handleSendClaimsOtp = async () => {
    try {
      setSubmitting(true);

      await cancelAllPendingAuthorizations(sessionLocation?.sessionLocation?.uuid, crIdentifierId);

      const response = await sendClaimsOTP(crIdentifierId, sessionLocation?.sessionLocation?.uuid, intervention?.code);

      if (response?.message?.includes('OTP')) {
        setOtpSent(true);

        showSnackbar({
          kind: 'success',
          title: 'OTP Sent',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PatientProvider initialPatient={patient}>
      <>
        <ModalHeader title={t('clientConsent', 'Client consent')} />
        <ModalBody>
          <ClaimsConsentModal
            submitting={submitting}
            otpSent={otpSent}
            whitelistRequest={whitelistRequest}
            onWhitelistSubmit={handleWhitelistSubmit}
            onSendClaimsOtp={handleSendClaimsOtp}
            onOtpVerified={handleVerifyOtp}
            onOtpVerificationStatusChange={setOtpVerified}
            serviceType={getServiceType(intervention, visitType)}
            interventionCode={intervention?.code ?? ''}
            crId={patient.id}
            onScanStatusChange={setAuthGuid}
          />
        </ModalBody>
      </>
    </PatientProvider>
  );
};

export default ClaimsConsentExtension;
