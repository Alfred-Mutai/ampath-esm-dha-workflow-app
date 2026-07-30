import { openmrsFetch } from "@openmrs/esm-framework";
import { fetchUrl, getHieBaseUrl, getUrl } from "./utils";
import { ClaimIntervention } from ".";

export async function addIntervention(consentToken: string, interventionCode: string, locationUuid: string) {
    const { hieBaseUrl } = await getHieBaseUrl();
    const url = `${hieBaseUrl}/interventions`;

    const payload = {
        locationUuid,
        consentToken: consentToken,
        interventionCode: interventionCode
    }
    // return await fetchUrl<any>(url, { method: "POST", payload });
    const result = await openmrsFetch<ClaimIntervention>(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // signal: abortController.signal,
        body: payload,
    }).catch((error) => {
        const message = error?.responseBody?.message ?? "";
        if (typeof message === "object") {
            throw `${message?.join(",")}`;
        }
        throw message;
    });

    if (result?.data && "error" in result.data && "message" in result.data) {
        const message = result.data.message ?? "";
        throw message;
    }

    return result?.data;
}

export async function checkInterventionExists(consentToken: string, interventionCode: string): Promise<boolean> {
    const { hieBaseUrl } = await getHieBaseUrl();
    const url = `${hieBaseUrl}/interventions/check-intervention-exists?consentToken=${encodeURIComponent(consentToken)}&interventionCode=${encodeURIComponent(interventionCode)}`;
    const response = await openmrsFetch(url);
    const data = response?.data;
    if (typeof data === 'boolean') {
        return data;
    }
    if (data && typeof data === 'object' && 'exists' in data) {
        return Boolean((data as { exists: boolean }).exists);
    }
    return Boolean(data);
}

/**
 * Ensure the intervention is on the HIE claim visit for this consent token.
 * Preauth and claim-line both require this — SHA rejects otherwise with
 * "intervention … is not in the visit for consent token …".
 */
export async function ensureInterventionOnVisit(
    consentToken: string,
    interventionCode: string,
    locationUuid: string,
    options?: { alreadyOnVisit?: boolean },
): Promise<'added' | 'exists'> {
    if (!consentToken || !interventionCode || !locationUuid) {
        throw 'Missing consent token, intervention code, or location.';
    }
    if (options?.alreadyOnVisit) {
        return 'exists';
    }

    // Local bill-order may already list the code, but HIE visit can still lack it —
    // always POST add when not confirmed on the visit. Treat "already present" as OK.
    try {
        await addIntervention(consentToken, interventionCode, locationUuid);
        return 'added';
    } catch (err) {
        const msg = String(err ?? '').toLowerCase();
        if (
            msg.includes('already') ||
            msg.includes('exist') ||
            msg.includes('duplicate')
        ) {
            return 'exists';
        }
        // If local check says it exists, continue — caller can still fail later with a clear HIE error
        try {
            if (await checkInterventionExists(consentToken, interventionCode)) {
                return 'exists';
            }
        } catch {
            // ignore
        }
        throw err;
    }
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