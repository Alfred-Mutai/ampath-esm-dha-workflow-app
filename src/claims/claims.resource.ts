import useSWR from "swr";
import { ServiceType, type BenefitUtilization, type InterventionResults, type ClaimResult, type Intervention, VisitType, type ClientSubBenefit } from "./index";
import { fetchUrl, getUrl, useHie } from "./utils";
import { openmrsFetch } from "@openmrs/esm-framework";

export const useClientSubBenefits = (clientRegistryId: string) => {
    const { hieBaseUrl, locationUuid } = useHie();
    const url = clientRegistryId ? `${hieBaseUrl}/sub-benefits?patient_id=${clientRegistryId}&locationUuid=${locationUuid}` : null;

    const {
        data,
        error,
        isLoading
    } = useSWR<{ data: Array<ClientSubBenefit> }>(url, openmrsFetch);

    const results = data?.data;

    return {
        clientSubBenefits: results,
        error,
        isLoadingClientSubBenefits: isLoading
    };
};

export const useInterventions = (clientRegistryId: string, subBenefitCode: string) => {
    const { hieBaseUrl, locationUuid } = useHie();
    const url = clientRegistryId && subBenefitCode ? `${hieBaseUrl}/interventions?patient_id=${clientRegistryId}&locationUuid=${locationUuid}&sub_benefit_code=${subBenefitCode}` : null;

    const {
        data,
        error,
        isLoading
    } = useSWR<{ data: Array<Intervention> }>(url, openmrsFetch);

    const results = data?.data;

    return {
        interventions: results,
        error,
        isLoadingInterventions: isLoading
    };
};

export const useBenefitUtilizations = (clientRegistryId: string, interventionCode: string, isCapitation: boolean) => {
    const { hieBaseUrl, locationUuid } = useHie();
    const url = clientRegistryId && interventionCode && !isCapitation ? `${hieBaseUrl}/benefits-utilization?patient_id=${clientRegistryId}&locationUuid=${locationUuid}&intervention_code=${interventionCode}` : null;

    const {
        data,
        error,
        isLoading
    } = useSWR<{ data: Array<BenefitUtilization> }>(url, openmrsFetch);

    const results = data?.data;

    return {
        benefitUtilizations: results,
        error,
        isLoadingBenefitUtilization: isLoading
    };
};

export async function createClaimsVisit(interventionCode: string, crIdentifier: string, serviceType: ServiceType, { auth_guid, otp }: { auth_guid?: string, otp?: string } = {}) {
    const endPoint = `/claims/visit`;
    const url = getUrl() + endPoint;

    let payload = {
        intervention_codes: [interventionCode],
        patient_id: crIdentifier,
        service_type: serviceType // Type of service Options: CAPITATION, OUTPATIENT, INPATIENT, EMERGENCY
    }

    if (otp) {
        payload["otp"] = otp;
    }

    if (auth_guid) {
        payload["auth_guid"] = auth_guid;
    }

    return await fetchUrl<ClaimResult>(url, { method: "POST", payload });
}

// Preauths
export async function createPreauth() {

}

const generatePreauthFormData = (payload: any, intervention: Intervention, consentToken: string) => {
    const formData = new FormData();

    // fileInput.files[0]

    formData.append("consent_token", consentToken);
    formData.append("intervention_code", intervention.code);
    formData.append("service_start", payload.service_start);
    formData.append("service_end", payload.service_end);
    formData.append("items", JSON.stringify(payload.items));//items -> [{"unit_price": "500.00"}]
    formData.append("diagnoses", JSON.stringify(payload.diagnoses));// diagnoses -> [{"consent_token": "{{consent_token}}","icd_code": "ca07.0"}]
    formData.append("doctors", JSON.stringify(payload.doctors)); //doctors -> [{"identification_number": "{{practitioner_id_number}}","identification_type":"{{practitioner_id_type}}", "regulation_body": "KMPDC", "intervention_code": "{{intervention_code}}", "is_primary":true}]
    formData.append("attachments", JSON.stringify(payload.attachments)); //attachments -> {"document_title": "Lab Results", "document_type": "LAB_TESTS","file_field_name": "attachments_0_file_blob"}
    formData.append("provider_notification_email", payload.provider_notification_email);

    if (intervention.requiresRadiologyPreauth) {
        formData.append("clinical_indications", payload.clinical_indications);
    }

    if (intervention.requiresOncologyPreauth) {
        formData.append("carcinoma_staging", payload.carcinoma_staging);
        formData.append("comorbidity", payload.comorbidity);
        formData.append("metastases", JSON.stringify(payload.metastases));
        formData.append("treatment_setting", JSON.stringify(payload.treatment_setting));
        formData.append("number_of_sessions_required", String(payload.number_of_sessions_required));
        formData.append("cost_per_session", String(payload.cost_per_session));
        formData.append("is_co_insured", String(payload.is_co_insured));
    }

    if (intervention.requiresOpticalPreauth) {
        formData.append("necessity_of_service", payload.necessity_of_service);
        formData.append("lens_prescription", payload.lens_prescription);
        formData.append("lens_amount", String(payload.lens_amount));
        formData.append("eye_examination_amount", String(payload.eye_examination_amount));
        formData.append("frame_amount", String(payload.frame_amount));
        formData.append("new_or_replacement", payload.new_or_replacement);
    }

    if (intervention.requiresRenalPreauth) {
        formData.append("number_of_sessions_required", String(payload.number_of_sessions_required));
        formData.append("cost_per_session", String(payload.cost_per_session));
        formData.append("frequency_of_sessions", payload.frequency_of_sessions);
        formData.append("clinical_indications", payload.clinical_indications);
        formData.append("start_date", payload.start_date);
        formData.append("is_co_insured", String(payload.is_co_insured));
    }

    if (intervention.requiresSurgicalPreauth) {
        formData.append("chief_complaint", payload.chief_complaint);
        formData.append("vital_signs", payload.vital_signs);
        formData.append("history_of_present_illness", payload.history_of_present_illness);
        formData.append("physical_examination", payload.physical_examination);
        formData.append("investigation_report_details", payload.investigation_report_details);
        formData.append("type_of_anaesthesia", payload.type_of_anaesthesia);
        formData.append("surgery_date", payload.surgery_date);
    }

    // Dynamic Attachments


    return formData;
}

export const getServiceType = (selectedIntervention: Intervention, visitType?: VisitType): ServiceType => {
    const paymentMechanism = selectedIntervention.paymentMechanism;
    if (paymentMechanism.toUpperCase() === "CAPITATION") {
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

export const fetchConsentToken = async () => {
    return "";
}