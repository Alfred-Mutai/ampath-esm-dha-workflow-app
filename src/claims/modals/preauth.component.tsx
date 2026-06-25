import { Button, ModalBody, ModalFooter, ModalHeader, TextInput } from "@carbon/react";
import React from "react";
import { Form } from "react-hook-form";
import { type Intervention } from "..";
import { useTranslation } from "react-i18next";

interface PreauthProps {
    intervention: Intervention
    closeModal: () => void;
}

const Preauth: React.FC<PreauthProps> = ({ intervention, closeModal }) => {
    const { t } = useTranslation();

    return <>
        <ModalHeader closeModal={closeModal} title={t('preauth', 'Preauth')} />
        <ModalBody>
            <div>
                <TextInput
                    id="service-start-date"
                    labelText="Service start date"
                    size="md"
                    type="text"
                />
                <TextInput
                    id="service-end-date"
                    labelText="Service end date"
                    size="md"
                    type="text"
                />
                <TextInput
                    id="provider-notification-email"
                    labelText="Provider notification email"
                    size="md"
                    type="text"
                />

                {
                    intervention.requiresRadiologyPreauth ?
                        <TextInput
                            id="clinical-indications"
                            labelText="Clinical indications"
                            size="md"
                            type="text"
                        />
                        : intervention.requiresOncologyPreauth ?
                            <>
                                <TextInput
                                    id="carcinoma-staging"
                                    labelText="Carcinoma staging"
                                    size="md"
                                    type="text"
                                />
                                <TextInput
                                    id="carcinoma-staging"
                                    labelText="Carcinoma staging"
                                    size="md"
                                    type="text"
                                />
                                <TextInput
                                    id="metastases"
                                    labelText="Metastases"
                                    size="md"
                                    type="text"
                                />
                                <TextInput
                                    id="treatment-setting"
                                    labelText="Treatment setting"
                                    size="md"
                                    type="text"
                                />
                                <TextInput
                                    id="number-of-sessions-required"
                                    labelText="Number of sessions required"
                                    size="md"
                                    type="text"
                                />
                                <TextInput
                                    id="cost-per-session"
                                    labelText="Cost per session"
                                    size="md"
                                    type="text"
                                />
                                <TextInput
                                    id="is-co-insured"
                                    labelText="Is co insured"
                                    size="md"
                                    type="text"
                                />
                            </>
                            : intervention.requiresOpticalPreauth ?
                                <>
                                    <TextInput
                                        id="necessity-of-service"
                                        labelText="Necessity of service"
                                        size="md"
                                        type="text"
                                    />
                                    <TextInput
                                        id="lens-prescription"
                                        labelText="Lens prescription"
                                        size="md"
                                        type="text"
                                    />
                                    <TextInput
                                        id="lens-amount"
                                        labelText="Lens amount"
                                        size="md"
                                        type="text"
                                    />
                                    <TextInput
                                        id="eye-examination-amount"
                                        labelText="Eye examination amount"
                                        size="md"
                                        type="text"
                                    />
                                    <TextInput
                                        id="frame-amount"
                                        labelText="Frame amount"
                                        size="md"
                                        type="text"
                                    />
                                    <TextInput
                                        id="new-or-replacement"
                                        labelText="New or replacement"
                                        size="md"
                                        type="text"
                                    />
                                </>
                                : intervention.requiresRenalPreauth ?
                                    <>
                                        <TextInput
                                            id="number-of-sessions-required"
                                            labelText="Number of sessions required"
                                            size="md"
                                            type="text"
                                        />
                                        <TextInput
                                            id="cost-per-session"
                                            labelText="Cost per session"
                                            size="md"
                                            type="text"
                                        />
                                        <TextInput
                                            id="frequency-of-sessions"
                                            labelText="Frequency of sessions"
                                            size="md"
                                            type="text"
                                        />
                                        <TextInput
                                            id="clinical-indications"
                                            labelText="Clinical indications"
                                            size="md"
                                            type="text"
                                        />
                                        <TextInput
                                            id="start_date"
                                            labelText="Start date"
                                            size="md"
                                            type="text"
                                        />
                                        <TextInput
                                            id="is-co-insured"
                                            labelText="Is co insured"
                                            size="md"
                                            type="text"
                                        />
                                    </>
                                    : intervention.requiresSurgicalPreauth ?
                                        <>
                                            <TextInput
                                                id="chief-complaint"
                                                labelText="Chief complaint"
                                                size="md"
                                                type="text"
                                            />
                                            <TextInput
                                                id="vital-signs"
                                                labelText="Vital signs"
                                                size="md"
                                                type="text"
                                            />
                                            <TextInput
                                                id="history-of-present-illness"
                                                labelText="History of present illness"
                                                size="md"
                                                type="text"
                                            />
                                            <TextInput
                                                id="physical-examination"
                                                labelText="Physical examination"
                                                size="md"
                                                type="text"
                                            />
                                            <TextInput
                                                id="investigation-report-details"
                                                labelText="Investigation report details"
                                                size="md"
                                                type="text"
                                            />
                                            <TextInput
                                                id="is-co-insured"
                                                labelText="Is co insured"
                                                size="md"
                                                type="text"
                                            />
                                        </>
                                        : <></>
                }
            </div>
        </ModalBody>
        {/* <ModalFooter>
            <Button kind="danger" onClick={handleReject}>
                {t('rejectLabResults', 'Reject lab results')}
            </Button>
            <Button type="submit" onClick={handleApproval} disabled={isSubmitting}>
                {t('approveResults', 'Approve Results')}
            </Button>
        </ModalFooter> */}
    </>
}

export default Preauth;