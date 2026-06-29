import { openmrsFetch } from "@openmrs/esm-framework";
import { fetchUrl, getHieBaseUrl, getUrl } from "./utils";

export async function addIntervention(consentToken: string, interventionCode: string, locationUuid: string) {
    const { hieBaseUrl } = await getHieBaseUrl();
    const url = `${hieBaseUrl}/interventions`;

    const payload = {
        locationUuid,
        consentToken: consentToken,
        interventionCode: interventionCode
    }
    // return await fetchUrl<any>(url, { method: "POST", payload });
    return await openmrsFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // signal: abortController.signal,
        body: payload,
    });
}

export async function switchIntervention(consentToken: string, existingInterventionCode: string, newInterventionCode: string) {
    const endPoint = `/claims/interventions/switch`;
    const url = getUrl() + endPoint;

    const payload = {
        consent_token: consentToken,
        existing_intervention_code: existingInterventionCode,
        new_intervention_code: newInterventionCode,
        retain_bill_items: false,
        bill_from: "", // Date from - Optional depending on whether retain_bill_items is true
        bill_to: ""// Date to - Optional depending on whether retain_bill_items is true
    }
    return await fetchUrl<any>(url, { method: "POST", payload });
}

export async function restoreIntervention(consentToken: string, interventionCode: string) {
    const endPoint = `/claims/interventions/restore`;
    const url = getUrl() + endPoint;

    const payload = {
        consent_token: consentToken,
        intervention_code: interventionCode
    }
    return await fetchUrl<any>(url, { method: "POST", payload });
}

export async function retireIntervention(consentToken: string, interventionCode: string) {
    const endPoint = `/claims/interventions/retire`;
    const url = getUrl() + endPoint;

    const payload = {
        consent_token: consentToken,
        intervention_code: interventionCode
    }
    return await fetchUrl<any>(url, { method: "POST", payload });
}