import { Button, Row, Select, SelectItem, Tag, TextInput } from "@carbon/react";
import React, { useEffect, useState } from "react";
import { createClaimsVisit, fetchBenefitUtilization, fetchClientSubBenefits, fetchConsentToken, fetchInterventions, getServiceType } from "./claims.resource";
import { type BenefitUtilization, type InterventionResults, type ClientSubBenefitResults, type Intervention, type ClientSubBenefit, VisitType } from "./index";
import { addIntervention } from "./interventions.resource";

interface ClaimsComponentProps {
    clientRegistryId: string;
    visitType?: VisitType;
    isNewVisit?: boolean;
    onSelectChange: (key, value) => void;
}

const ClaimsComponent: React.FC<ClaimsComponentProps> = ({ clientRegistryId, visitType, isNewVisit = true, onSelectChange }) => {
    const [subBenefits, setSubBenefits] = useState<ClientSubBenefitResults>();
    const [interventions, setInterventions] = useState<InterventionResults>();
    const [benefitUtilizations, setBenefitUtilizations] = useState<Array<BenefitUtilization>>();
    const [selectedIntervention, setSelectedIntervention] = useState<Intervention>();
    const [selectedSubBenefitCode, setSelectedSubBenefitCode] = useState<ClientSubBenefit>();
    const [isBenefitEligible, setIsBenefitEligible] = useState(false);
    const [otp, setOtp] = useState("");

    useEffect(() => {
        if (clientRegistryId) {
            const fn = async () => {
                let results = await fetchClientSubBenefits(clientRegistryId);
                setSubBenefits(results);
            }
            fn();
        }
    }, [clientRegistryId]);

    useEffect(() => {
        if (clientRegistryId && selectedSubBenefitCode) {
            const fn = async () => {
                let results = await fetchInterventions(clientRegistryId, selectedSubBenefitCode.code);
                setInterventions(results);
            }
            fn();
        }
    }, [clientRegistryId, selectedSubBenefitCode]);

    useEffect(() => {
        if (clientRegistryId && selectedIntervention) {
            const isCapitation = selectedIntervention.paymentMechanism.toUpperCase() === "CAPITATION";
            const fn = async () => {
                let results = await fetchBenefitUtilization(clientRegistryId, selectedIntervention.code);
                if (results) {
                    const benefitUtilization = results[0];
                    setIsBenefitEligible(benefitUtilization.computationalDetail.eligibility);
                    setBenefitUtilizations(results);
                }
            }
            if (!isCapitation) {
                fn();
            }
        }
    }, [clientRegistryId, selectedIntervention]);

    const handleStartVisit = async () => {
        try {
            if (!isNewVisit) {
                return;
            }
            const serviceType = getServiceType(selectedIntervention, visitType);
            const claimVisit = await createClaimsVisit(selectedIntervention.code, clientRegistryId, serviceType, { otp: otp });

            alert("Successfully started a visit");
        } catch (err) {
            alert(`Error: ${err}`);
        }
    }

    const handleAddIntervention = async () => {
        const consentToken = await fetchConsentToken();
        await addIntervention(consentToken, selectedIntervention.code);
    }

    return <>
        {/* Benefits */}
        <Select
            id="client-sub-benefits"
            labelText="Client sub benefits"
            onChange={($event) => {
                const value = $event.target.value;
                setSelectedSubBenefitCode(subBenefits.results.find(sB => sB.code === value));
                return onSelectChange("client-sub-benefits", value)
            }}
        >
            <SelectItem
                value=""
                text="--Select Sub Benefit--"
            />
            {subBenefits && subBenefits.results &&
                subBenefits.results.map((subBenefit) => {
                    return (
                        <SelectItem
                            value={subBenefit.code}
                            text={`${subBenefit.name} (${subBenefit.code})`}
                        />
                    );
                })}
        </Select>
        {/* Interventions */}
        <Row>
            <Select
                id="interventions"
                labelText="Interventions"
                onChange={($event) => {
                    const value = $event.target.value;
                    setSelectedIntervention(interventions.results.find(i => i.code === value));
                    return onSelectChange("interventions", value)
                }}
            >
                <SelectItem
                    value=""
                    text="--Select Intervention--"
                />
                {interventions && interventions.results &&
                    interventions.results.map((intervention) => {
                        return (
                            <SelectItem
                                value={intervention.code}
                                text={`${intervention.name} (${intervention.code})`}
                            />
                        );
                    })}
            </Select>
            {
                benefitUtilizations ? (
                    isBenefitEligible ?
                        <Tag type="green">Eligible</Tag>
                        : <Tag type="red">Not Eligible</Tag>
                ) : <></>
            }
            {
                selectedIntervention ?
                    (selectedIntervention.needsPreauth && !selectedIntervention.needsManualPreauthApproval ?
                        <Tag type="blue">Needs Preauth</Tag>
                        : selectedIntervention.needsPreauth && selectedIntervention.needsManualPreauthApproval ?
                            <Tag type="blue">Needs Elective Preauth</Tag>
                            : <></>
                    )
                    : <></>
            }
        </Row>
        <TextInput
            id="text-input-1"
            labelText="OTP"
            onChange={(e) => setOtp(e.target.value)}
            size="md"
            type="text"
        />
        <Button onClick={handleStartVisit}>Start Visit</Button>
    </>
}

export default ClaimsComponent;