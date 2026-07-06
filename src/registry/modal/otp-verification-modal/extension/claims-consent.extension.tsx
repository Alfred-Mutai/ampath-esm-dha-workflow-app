import { ModalBody, ModalHeader } from "@carbon/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Intervention, VisitType } from "../../../../claims";
import ClaimsConsentModal from "../claims-consent";
import { showSnackbar, useSession } from "@openmrs/esm-framework";
import { createOTPWhitelisting, sendClaimsOTP } from "../../../hie.resource";
import { OTPWhitelistRequest } from "../../../hie.types";
import { getServiceType } from "../../../../shared/services/claims.resource";
import { PatientProvider } from '../../../../context/patient-context';
import { HieClient } from "../../../types";

interface ClaimsConsentExtensionProps {
    patient: HieClient;
    intervention: Intervention;
    crIdentifierId: string;
    visitType: VisitType;
    onClientConsent: ({ otp, authGuid }: { otp?: string, authGuid?: string }) => void;
}

const ClaimsConsentExtension: React.FC<ClaimsConsentExtensionProps> = ({ patient, intervention, crIdentifierId, visitType, onClientConsent }) => {
    const [submitting, setSubmitting] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [whitelistRequest, setWhitelistRequest] = useState(null);
    const { t } = useTranslation();
    const sessionLocation = useSession();

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
                    />
                </ModalBody>
            </>
        </PatientProvider>
    );
}

export default ClaimsConsentExtension;