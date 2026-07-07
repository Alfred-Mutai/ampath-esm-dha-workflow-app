import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, ModalBody, Row, Select, SelectItem, TextInput } from '@carbon/react';
import { submitClaim } from '../../../../../billing-claims.resource';
import { Patient, showModal, showSnackbar } from '@openmrs/esm-framework';
import { DischargeReasonType, type ClaimsVisit, type SubmitClaimDto } from '../../../types';
import { type HieClient, HieIdentificationType } from '../../../../../../registry/types';
import { Intervention } from '../../../../../../claims';
import { searchPatientByCrNumber } from '../../../../../../resources/patient-search.resource';
import { IdentifierTypesUuids } from '../../../../../../resources/identifier-types';
import ClaimsConsentExtension from '../../../../../../registry/modal/otp-verification-modal/extension/claims-consent.extension';

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
    const [otp, setOtp] = useState("");
    const [authGuid, setAuthGuid] = useState("");
    const [dischargeReason, setDischargeReason] = useState<DischargeReasonType>();
    const [notes, setNotes] = useState("");
    const DischargeReasonTypes = Object.values(DischargeReasonType);
    const [patient, setPatient] = useState<Patient>();

    useEffect(() => {
        const fn = async () => {
            const response = await searchPatientByCrNumber(claimsVisit.member_number);
            if (response.results.length) {
                setPatient(response.results[0]);
            }
        }

        if (claimsVisit) {
            fn();
        }
    }, [claimsVisit]);

    const consentComplete = useMemo(() => {
        if (otp || authGuid) {
            return true;
        }
        return false;
    }, [otp, authGuid]);

    const invalidValues = useMemo(() => {
        if (invoiceNumber && claimsVisit) {
            return false;
        }
        return true;
    }, [invoiceNumber, claimsVisit]);

    function onClientConsent({ otp, authGuid }: { otp?: string, authGuid?: string }) {
        if (otp) {
            setOtp(otp);
        }
        if (authGuid) {
            setAuthGuid(authGuid);
        }
    }

    const nationalId = useMemo(() => {
        if (patient) {
            const identifiers = patient.identifiers;
            return identifiers.find(i => i.identifierType.uuid === IdentifierTypesUuids.NATIONAL_ID_UUID).identifier ?? "";
        }
    }, [patient]);

    const consentPatient = useMemo<HieClient>(() => {
        return {
            id: String(claimsVisit.member_number),
            first_name: claimsVisit.patient_name ?? '',
            identification_type: HieIdentificationType.NationalID,
            identification_number: nationalId ? String(nationalId) : ""
        } as unknown as HieClient;
    }, [claimsVisit, nationalId]);

    const getIntervention = () => {
        const interventions = claimsVisit.interventions;
        if (interventions && interventions.length) {
            const intervention = interventions[interventions.length - 1];
            return {
                code: intervention.intervention_code,
                paymentMechanism: intervention.intervention_payment_mechanism
            } as Intervention;
        }
    }

    async function handleSubmitClaim() {
        setLoading(true);
        try {
            const submitClaimPayload = getSubmitClaimPayload();
            const resp = await submitClaim(submitClaimPayload);
            if ('error' in resp) {
                let message = 'message' in resp ? String(resp?.message) : "An error occurred while submitting the claim. Kindy retry or contact support"
                showSnackbar({
                    title: 'Error submitting claim',
                    kind: 'error',
                    subtitle: message,
                });
                onSuccess();
            } else {
                showSnackbar({
                    title: 'Success submitting claim',
                    kind: 'success',
                    subtitle: 'Claim submitted successfully',
                });
                onSuccess();
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
        let payload = {
            consentToken: claimsVisit.authorization_code,
            invoiceNumber,
            locationUuid,
            dischargeReason
        };
        if (otp) {
            payload["otp"] = otp;
        }
        if (authGuid) {
            payload["dischargeAuthGuid"] = authGuid;
        }
        if (notes) {
            payload["notes"] = notes;
        }
        return payload;
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
                onRequestSubmit={!invalidValues ? (loading ? holderFunction : (consentComplete ? handleSubmitClaim : null)) : null}
                primaryButtonText={!invalidValues ? (loading ? 'Submitting claim...' : (consentComplete ? 'Submit claim' : null)) : null}
                secondaryButtonText="Close"
            >
                <ModalBody>
                    <Row>
                        <Select
                            id="discharge-reason"
                            labelText="Discharge reason"
                            onChange={($event) => setDischargeReason($event.target.value as DischargeReasonType)}
                        >
                            <SelectItem value="" text="Select" />;
                            {DischargeReasonTypes.map((c) => {
                                return <SelectItem value={c} text={c} />;
                            })}
                        </Select>
                    </Row>
                    <Row>
                        <TextInput
                            id="notes"
                            labelText="Notes"
                            onChange={($event) => setNotes($event.target.value)}
                        />
                    </Row>
                    {
                        (dischargeReason && notes) &&
                        <ClaimsConsentExtension patient={consentPatient} intervention={getIntervention()} crIdentifierId={claimsVisit.member_number} visitType={'OUTPATIENT'} onClientConsent={onClientConsent} />
                    }
                </ModalBody>
            </Modal>
        </>
    );
};
export default SubmitClaimModal;
