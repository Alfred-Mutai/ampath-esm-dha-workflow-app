import React, { useMemo, useState } from 'react';
import { Modal, ModalBody } from '@carbon/react';
import { submitClaim } from '../../../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-framework';
import { type ClaimsVisit, type SubmitClaimDto } from '../../../types';
import ClaimsConsentModal from '../../../../../../registry/modal/otp-verification-modal/claims-consent';

interface submitClaimModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    claimsVisit: ClaimsVisit;
    invoiceNumber: string;
    locationUuid: string;
}
const SubmitClaimModal: React.FC<submitClaimModalProps> = ({ open, onClose, onSuccess, locationUuid, claimsVisit, invoiceNumber }) => {
    const [loading, setLoading] = useState<boolean>(false);

    const invalidValues = useMemo(() => {
        if (invoiceNumber && claimsVisit) {
            return false;
        }
        return true;
    }, [invoiceNumber, claimsVisit]);

    async function handleSubmitClaim() {
        setLoading(true);
        try {
            const submitClaimPayload = getSubmitClaimPayload();
            const resp = await submitClaim(submitClaimPayload);
            if ('error' in resp) {
                showSnackbar({
                    title: 'Error submitting claim',
                    kind: 'error',
                    subtitle: 'An error occurred while submitting the claim. Kindy retry or contact support',
                });
                onSuccess();
            } else {
                showSnackbar({
                    title: 'Success submitting claim',
                    kind: 'success',
                    subtitle: 'Claim submitted successfully',
                });
            }
        } catch (error) {
            showSnackbar({
                kind: 'error',
                title: 'Error submitting claim',
                subtitle: 'An error occurred while submitting the claim. Kindy retry or contact support',
            });
        } finally {
            setLoading(false);
        }
    }
    function getSubmitClaimPayload(): SubmitClaimDto {
        return {
            consentToken: claimsVisit.authorization_code,
            invoiceNumber,
            locationUuid
        };
    }
    function holderFunction() {
        return;
    }
    return (
        <>
            <Modal
                modalHeading="Submit Claim"
                open={open}
                size="md"
                onSecondarySubmit={onClose}
                onRequestClose={onClose}
                onRequestSubmit={!invalidValues ? (loading ? holderFunction : handleSubmitClaim) : null}
                primaryButtonText={!invalidValues ? (loading ? 'Submitting claim...' : 'Submit claim') : null}
                secondaryButtonText="Close"
            >
                <ModalBody>
                    <p>
                        Are you sure you want to submit the claim?
                    </p>
                    {/* <ClaimsConsentModal
                        submitting={submitting}
                        otpSent={otpSent}
                        whitelistRequest={whitelistRequest}
                        onWhitelistSubmit={handleWhitelistSubmit}
                        onSendClaimsOtp={handleSendClaimsOtp}
                        onOtpVerified={handleVerifyOtp}
                        onOtpVerificationStatusChange={setOtpVerified}
                        serviceType={getClaimServiceType(selectedVisitType ?? '')}
                        interventionCode={intervention?.code ?? ''}
                    /> */}
                </ModalBody>
            </Modal>
        </>
    );
};
export default SubmitClaimModal;
