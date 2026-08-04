import { openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import { type CaseSummaryResponse } from './types/case-summary.types';

/**
 * Fetches the assembled visit case summary from `hie-saf`'s `GET /case-summary`
 * (`packages/hie-saf/src/case-summary/`). The AMRS join — demographics,
 * allergies, active diagnoses, vitals, medications, lab results, and the SOAP
 * note — now happens server-side in one call; this used to be ~11 REST/FHIR
 * requests assembled client-side. See
 * `packages/hie-saf/docs/case-summary-endpoint.md` for the full contract.
 *
 * `visitUuid` scopes to exactly that visit, with no same-day merging. Omit it
 * for the default behaviour: the patient's current visit, merged with any
 * sibling visit started the same calendar day.
 */
export async function getVisitCaseSummary(
  patientUuid: string,
  locationUuid: string,
  visitUuid?: string,
): Promise<CaseSummaryResponse> {
  const hieBaseUrl = await getHieBaseUrl();
  const params = new URLSearchParams({ patientUuid, locationUuid, ...(visitUuid ? { visitUuid } : {}) });
  const url = `${hieBaseUrl}/case-summary?${params.toString()}`;
  const response = await openmrsFetch<CaseSummaryResponse>(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = (data as { message?: string })?.message || 'Failed to fetch case summary';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

/**
 * SWR hook for the visit case summary. `locationUuid` is required — the
 * endpoint uses it to resolve the requesting facility — so the key stays
 * `null` (no fetch) until both it and `patientUuid` are known. When
 * `visitUuid` is omitted the most recent visit is resolved as part of the
 * same underlying call. Returns the standard `{ data, isLoading, error,
 * mutate }` shape used across the app.
 */
export function useVisitCaseSummary(patientUuid?: string, locationUuid?: string, visitUuid?: string) {
  const key = patientUuid && locationUuid ? `case-summary:${patientUuid}:${locationUuid}:${visitUuid ?? 'latest'}` : null;
  const { data, isLoading, error, mutate } = useSWR<CaseSummaryResponse, Error>(key, () =>
    getVisitCaseSummary(patientUuid as string, locationUuid as string, visitUuid),
  );
  return { summary: data, isLoading, error, mutate };
}
