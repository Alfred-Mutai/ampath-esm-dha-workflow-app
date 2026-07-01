import { type Visit } from "@openmrs/esm-framework";
import { ClaimIntervention, type Intervention, type ServiceType, type VisitType } from "../../claims";

export const getConsentToken = (activeVisit: Visit) => {
    const consentToken = activeVisit.attributes?.find(atr => atr?.attributeType?.uuid === "4962a633-c4f8-474c-857c-5c68c72fbbe3")?.value ?? "";
    return consentToken;
}

export const getServiceType = (selectedIntervention: Intervention | ClaimIntervention, visitType?: VisitType): ServiceType => {
    const rawPm = (selectedIntervention as any)?.paymentMechanism ?? (selectedIntervention as any)?.intervention_payment_mechanism ?? "";
    const paymentMechanism = typeof rawPm === "string" ? rawPm.toUpperCase() : "";

    if (paymentMechanism === "CAPITATION") {
        return "CAPITATION";
    }

    if (visitType === "OUTPATIENT") {
        return "OUTPATIENT";
    }

    if (visitType === "INPATIENT") {
        return "INPATIENT";
    }

    return "EMERGENCY";
}