import { Button, InlineLoading, Row, Select, SelectItem, Tag, TextInput } from "@carbon/react";
import React, { useEffect, useState } from "react";
import { createClaimsVisit, fetchConsentToken, getServiceType, useBenefitUtilizations, useClientSubBenefits, useInterventions } from "./claims.resource";
import { type BenefitUtilization, type InterventionResults, type ClientSubBenefitResults, type Intervention, type ClientSubBenefit, VisitType } from "./index";
import { addIntervention } from "./interventions.resource";

interface ClaimsComponentProps {
    clientRegistryId: string;
    visitType?: VisitType;
    isNewVisit?: boolean;
    onSelectChange: (key, value) => void;
}

const ClaimsComponent: React.FC<ClaimsComponentProps> = ({ clientRegistryId, visitType, isNewVisit = true, onSelectChange }) => {
    const [selectedIntervention, setSelectedIntervention] = useState<Intervention>();
    const [selectedSubBenefitCode, setSelectedSubBenefitCode] = useState<ClientSubBenefit>();
    const [isBenefitEligible, setIsBenefitEligible] = useState(false);
    const [otp, setOtp] = useState("");

    const { clientSubBenefits, isLoadingClientSubBenefits } = useClientSubBenefits(clientRegistryId);
    const { interventions, isLoadingInterventions } = useInterventions(clientRegistryId, selectedSubBenefitCode?.code);
    const { benefitUtilizations, isLoadingBenefitUtilization } = useBenefitUtilizations(clientRegistryId, selectedIntervention?.code, selectedIntervention?.paymentMechanism?.toUpperCase() === "CAPITATION");

    useEffect(() => {
        if (benefitUtilizations) {
            const benefitUtilization = benefitUtilizations[0];
            setIsBenefitEligible(benefitUtilization.computationalDetail.eligibility);
        }
    }, [benefitUtilizations]);

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
        {
            isLoadingClientSubBenefits ?
                <InlineLoading description="Loading client sub-benefits" />
                :
                <Select
                    id="client-sub-benefits"
                    labelText="Client sub benefits"
                    onChange={($event) => {
                        const value = $event.target.value;
                        setSelectedSubBenefitCode(clientSubBenefits.find(sB => sB.code === value));
                        return onSelectChange("client-sub-benefits", value)
                    }}
                >
                    <SelectItem
                        value=""
                        text="--Select Sub Benefit--"
                    />
                    {clientSubBenefits &&
                        clientSubBenefits.map((subBenefit) => {
                            return (
                                <SelectItem
                                    value={subBenefit.code}
                                    text={`${subBenefit.name} (${subBenefit.code})`}
                                />
                            );
                        })}
                </Select>
        }
        {/* Interventions */}
        <Row>
            {
                isLoadingInterventions ?
                    <InlineLoading description="Loading interventions" />
                    :
                    <Select
                        id="interventions"
                        labelText="Interventions"
                        onChange={($event) => {
                            const value = $event.target.value;
                            setSelectedIntervention(interventions.find(i => i.code === value));
                            return onSelectChange("interventions", value)
                        }}
                    >
                        <SelectItem
                            value=""
                            text="--Select Intervention--"
                        />
                        {interventions &&
                            interventions.map((intervention) => {
                                return (
                                    <SelectItem
                                        value={intervention.code}
                                        text={`${intervention.name} (${intervention.code})`}
                                    />
                                );
                            })}
                    </Select>
            }
            {
                isLoadingBenefitUtilization ?
                    <InlineLoading description="Checking eligibility" />
                    :
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
        {/* <TextInput
            id="text-input-1"
            labelText="OTP"
            onChange={(e) => setOtp(e.target.value)}
            size="md"
            type="text"
        />
        <Button onClick={handleStartVisit}>Start Visit</Button> */}
    </>
}

export default ClaimsComponent;