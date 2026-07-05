import React, { useMemo, useState } from 'react';
import { Modal, ModalBody } from '@carbon/react';
import { submitClaim } from '../../../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-framework';
import { SubmitClaimDto } from '../../../types';

interface submitClaimModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    consentToken: string;
    invoiceNumber: string;
    locationUuid: string;
}
const SubmitClaimModal: React.FC<submitClaimModalProps> = ({ open, onClose, onSuccess, locationUuid, consentToken, invoiceNumber }) => {
    const [loading, setLoading] = useState<boolean>(false);

    const invalidValues = useMemo(() => {
        if (invoiceNumber && consentToken) {
            return false;
        }
        return true;
    }, [invoiceNumber, consentToken]);

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
            consentToken,
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
                </ModalBody>
            </Modal>
        </>
    );
};
export default SubmitClaimModal;
