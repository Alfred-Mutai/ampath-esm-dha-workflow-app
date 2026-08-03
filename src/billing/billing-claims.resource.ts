import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { getEtlBaseUrl } from '../shared/utils/get-base-url';
import {
  type FacilityBillsResponse,
  type FacilityBillsDto,
  type FacilityBill,
  type PatientFacilityBillsDto,
  type PatientFacilityBillDetailsResponse,
  type PatientFacilityBillDetails,
  type ClaimVisitsDto,
  type ClaimVisitReponse,
  type ProviderClaimPreviewDto,
  type ClaimsVisit,
  type PatientPaymentsDto,
  type PatientPaymentReponse,
  type PatientPayment,
  type BillPaymentDto,
  type BillPaymentResponse,
  type AddClaimLineDto,
  type CloseClaimDto,
  type SubmitClaimDto,
  type AddClaimDiagnosisDto,
  type RemoveClaimLineDto,
  type SwitchInterventionDto,
  type PatientBill,
  type PendingBillLineItems,
} from './dashboard/v2/types';
import { getHieBaseUrl } from '../claims/utils';
import {
  type FacilityPreauthsResponse,
  type AmrsMaternityDiagnosis,
  type AmrsMaternityDiagnosisDto,
  type AmrsMaternityDiagnosisResponse,
  type AmrsVisitDiagnosis,
  type AmrsVisitDiagnosisDto,
  type AmrsVisitDiagnosisResponse,
} from './types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';

export async function fetchFacilityBills(facilityBillsDto: FacilityBillsDto): Promise<PatientBill[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const facilityBillsUrl = `${etlBaseUrl}/facility/facility-bills?locationUuid=${facilityBillsDto.locationUuid}&billingDate=${facilityBillsDto.billingDate}`;
  const response = await openmrsFetch(facilityBillsUrl);
  const data = await response.json();
  return (data.results ?? []).map((bill: any) => ({
    ...bill,
    bill_items: typeof bill.bill_items === 'string' ? JSON.parse(bill.bill_items) : bill.bill_items,
  }));
}

export async function fetchPatientFacilityBillDetails(
  patientFacilityBillsDto: PatientFacilityBillsDto,
): Promise<PatientFacilityBillDetails[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const patientfacilityBillDetailsUrl = `${etlBaseUrl}/facility/patient/bill?locationUuid=${patientFacilityBillsDto.locationUuid}&billingDate=${patientFacilityBillsDto.billingDate}&patientUuid=${patientFacilityBillsDto.patientUuid}`;
  const response = await openmrsFetch(patientfacilityBillDetailsUrl);
  const data = (await response.json()) as PatientFacilityBillDetailsResponse;
  return data.results ?? [];
}

/** Bill lines that need normal preauth for the facility/date (ETL pre-filters). */
export async function fetchFacilityPreauthBills(
  facilityBillsDto: FacilityBillsDto,
): Promise<PatientFacilityBillDetails[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const url = `${etlBaseUrl}/facility/pre-auth-bills?locationUuid=${facilityBillsDto.locationUuid}&billingDate=${facilityBillsDto.billingDate}`;
  const response = await openmrsFetch(url);
  const data = await response.json();
  if (Array.isArray(data)) {
    return data as PatientFacilityBillDetails[];
  }
  return (data as PatientFacilityBillDetailsResponse)?.results ?? [];
}

export async function fetchFacilityClaimVisits(claimVisitsDto: ClaimVisitsDto): Promise<ClaimVisitReponse[]> {
  const claimVisitsFilter: ClaimVisitsDto = {};
  if (claimVisitsDto.consentToken) {
    claimVisitsFilter['consentToken'] = claimVisitsDto.consentToken;
  }
  if (claimVisitsDto.locationUuid) {
    claimVisitsFilter['locationUuid'] = claimVisitsDto.locationUuid;
  }
  if (claimVisitsDto.visitDate) {
    claimVisitsFilter['visitDate'] = claimVisitsDto.visitDate;
  }
  const { hieBaseUrl } = await getHieBaseUrl();
  const queryString = new URLSearchParams(claimVisitsFilter).toString();
  const response = await openmrsFetch(`${hieBaseUrl}/claims-visit?${queryString}`);
  const data = (await response.json()) as ClaimVisitReponse[];
  return data ?? [];
}

export async function fetchProviderClaimPreview(
  providerClaimPreviewDto: ProviderClaimPreviewDto,
): Promise<ClaimsVisit> {
  const { hieBaseUrl } = await getHieBaseUrl();
  const providerClaimPreviewUrl = `${hieBaseUrl}/claim-preview/provider`;
  const response = await openmrsFetch(providerClaimPreviewUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(providerClaimPreviewDto),
  });
  const data = (await response.json()) as ClaimsVisit;
  return data ?? null;
}

// Fields only a real claim carries; used to tell the claim object apart from any
// wrapper the endpoint might nest it under.
const CLAIM_SIGNATURE_KEYS = ['authorization_code', 'workflow_state', 'scheme_code', 'invoices', 'interventions'];

// The claim-preview endpoint has returned the claim both flat and wrapped (under
// `data` / `results` / `visitResponse`) across API versions. Peel common single-key
// wrappers until we reach the object that actually carries the claim fields, so the
// Claim Details never render blank against a truthy-but-wrapped payload.
function unwrapClaimVisit(body: unknown): ClaimsVisit | undefined {
  let node: any = body;
  for (let depth = 0; node && typeof node === 'object' && depth < 4; depth++) {
    if (CLAIM_SIGNATURE_KEYS.some((key) => key in node)) {
      return node as ClaimsVisit;
    }
    node = node.visitResponse ?? node.data ?? node.results ?? undefined;
  }
  return (node as ClaimsVisit) ?? undefined;
}

export function useProviderClaimPreview(consentToken: string, locationUuid: string) {
  const { hieBaseUrl } = useConfig({
    externalModuleName: '@ampath/esm-dha-workflow-app',
  });
  const url = consentToken
    ? `${hieBaseUrl}/claim-preview/provider?consentToken=${consentToken}&locationUuid=${locationUuid}`
    : null;

  const { data, error, isLoading, isValidating } = useSWR(url, openmrsFetch, {
    keepPreviousData: true,
    // This preview is an expensive round trip to the HIE, so it is fetched only when
    // something actually asks for it: the first load of a claim, a mutation that
    // invalidates it, or the Refresh control on Claim Details. Every one of SWR's
    // automatic triggers is off — window focus, reconnect, and the revalidation it
    // would otherwise run whenever a component remounts over cached data.
    //
    // The trade-off is that a claim changed elsewhere won't appear here until someone
    // refreshes; that is the intent, and the timestamp beside the Refresh control says
    // how old what you are looking at is.
    // `revalidateOnMount` is deliberately left unset: SWR then fetches when there is no
    // cached claim yet — so opening one for the first time still loads it — and skips
    // the fetch when the cache already holds it. Forcing it true would re-fetch on
    // every remount and undo the line above.
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });

  const results = unwrapClaimVisit(data?.data);

  return {
    claimVisit: results,
    error,
    isLoading,
    isValidating,
  };
}

/**
 * Announced whenever the claim has been mutated (a diagnosis or claim line added, an
 * attachment sent, an intervention switched…).
 *
 * Every one of those call sites already invalidates the SWR-backed claim preview. The
 * claims-visit endpoint is fetched imperatively rather than through SWR, so there is no
 * cache to invalidate — this event is how anything holding that response knows to go
 * and refetch it. See PatientClaimDetails.
 */
export const CLAIM_CHANGED_EVENT = 'ampath:claim-changed';

export function useInvalidateProviderClaimPreview() {
  const { hieBaseUrl } = useConfig({
    externalModuleName: '@ampath/esm-dha-workflow-app',
  });
  return useCallback(() => {
    const url = `${hieBaseUrl}/claim-preview/provider`;
    mutate((key) => typeof key === 'string' && key.startsWith(`${url}`), undefined, { revalidate: true });
    window.dispatchEvent(new CustomEvent(CLAIM_CHANGED_EVENT));
  }, [hieBaseUrl]);
}

/**
 * The claims filed at a facility on a date, reloaded whenever one is mutated.
 *
 * Everything that lists claims — the bills table, the dashboard tiles — reads this same
 * shape, so they can't disagree about which claims exist.
 */
export function useFacilityClaimVisits(locationUuid: string, visitDate: string) {
  const [claimVisits, setClaimVisits] = useState<ClaimVisitReponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(() => {
    if (!locationUuid || !visitDate) {
      setClaimVisits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchFacilityClaimVisits({ locationUuid, visitDate })
      .then((data) => setClaimVisits(data ?? []))
      .catch(() => setClaimVisits([]))
      .finally(() => setLoading(false));
  }, [locationUuid, visitDate]);

  useEffect(() => {
    load();
  }, [load]);

  useClaimChanged(load);

  return { claimVisits, loading, reload: load };
}

/** The consent token a claim visit is identified by on the claims endpoints. */
export function claimVisitToken(claimVisit: ClaimVisitReponse): string {
  return (claimVisit?.authorizationCode || claimVisit?.visitResponse?.authorization_code || '').trim();
}

/** One claim's live state, fetched outside SWR so many can be resolved at once. */
async function fetchProviderClaimState(consentToken: string, locationUuid: string): Promise<string | undefined> {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claim-preview/provider?consentToken=${encodeURIComponent(
    consentToken,
  )}&locationUuid=${encodeURIComponent(locationUuid)}`;
  const response = await openmrsFetch(url);
  const claim = unwrapClaimVisit(await response.json());
  const state = (claim?.workflow_state ?? '').trim();
  return state || undefined;
}

// How many claim previews are in flight at once. Each is a round trip to the HIE that
// has been seen to take several seconds, so they overlap — but not so many that opening
// a busy day's bills buries the HIE in requests.
const CLAIM_STATE_CONCURRENCY = 4;

/**
 * States resolved so far this page-load, shared by everything that shows them — the
 * dashboard tiles and the bills table would otherwise each pay for the same slow preview
 * of the same claim, and could disagree about it. Entries are dropped when the claim is
 * mutated (see `load(force)`), so this never serves a state the user has just changed.
 */
const claimStateCache = new Map<string, string>();
const claimStateInFlight = new Map<string, Promise<string | undefined>>();
const claimStateKey = (locationUuid: string, consentToken: string) => `${locationUuid}|${consentToken}`;

function resolveClaimState(consentToken: string, locationUuid: string): Promise<string | undefined> {
  const key = claimStateKey(locationUuid, consentToken);
  const cached = claimStateCache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }
  // Two lists asking for the same claim at once share one request rather than racing.
  const inFlight = claimStateInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }
  const request = fetchProviderClaimState(consentToken, locationUuid)
    .then((state) => {
      if (state) {
        claimStateCache.set(key, state);
      }
      return state;
    })
    .finally(() => {
      if (claimStateInFlight.get(key) === request) {
        claimStateInFlight.delete(key);
      }
    });
  claimStateInFlight.set(key, request);
  return request;
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      await worker(next);
    }
  });
  await Promise.all(runners);
}

/**
 * The live `workflow_state` of each claim, keyed by consent token.
 *
 * /claims-visit returns the copy of the claim that was stored when the visit was
 * recorded, so its `workflow_state` is whatever the claim was *then* — a claim submitted
 * afterwards still reads DRAFT there. claim-preview/provider is the live view, which is
 * why Claim Details opens on DRAFT and corrects itself to the real state a few seconds
 * later, once the preview lands.
 *
 * A list of claims therefore can't trust the state it was handed. There is no bulk
 * status feed, so the preview is fetched per claim, a few at a time, and each row is
 * upgraded as its answer arrives. Claims whose preview fails keep the stored state —
 * `failed` says how many, so the caller can admit that rather than present a stale
 * status as current.
 */
export function useLiveClaimStates(consentTokens: string[], locationUuid: string, enabled = true) {
  const [states, setStates] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<boolean>(false);
  const [failed, setFailed] = useState<number>(0);
  // The claim set a run has finished for. Compared against the current one to answer
  // "are these states final?" — `resolving` alone can't, since it is still false in the
  // render between the claims arriving and the first run starting.
  const [settledKey, setSettledKey] = useState<string>('');
  // Deduped and sorted, so this re-runs when the set of claims genuinely changes rather
  // than on every render that rebuilds the array.
  const tokenKey = useMemo(
    () =>
      Array.from(new Set((consentTokens ?? []).map((token) => (token ?? '').trim()).filter(Boolean)))
        .sort()
        .join('|'),
    [consentTokens],
  );
  // Only the newest run may write: a date changed mid-flight would otherwise have the
  // previous day's answers land on top of the current one's.
  const runSeq = useRef(0);
  // Mirrors settledKey for `load` to read without depending on it.
  const settledKeyRef = useRef('');

  const load = useCallback(
    (force = false) => {
      const tokens = tokenKey ? tokenKey.split('|') : [];
      if (!enabled || !locationUuid || tokens.length === 0) {
        return;
      }
      // These claims have already been resolved and nothing has happened to them since.
      // Without this, leaving the tab and coming back would re-run every request and put
      // the caller back behind a loading state for states it already has.
      if (!force && settledKeyRef.current === tokenKey) {
        return;
      }
      const seq = ++runSeq.current;
      setResolving(true);
      setFailed(0);
      settledKeyRef.current = '';
      setSettledKey('');
      // A forced run is one asking past what was already resolved — a claim has been
      // submitted or closed — so the shared cache gives up its answers for these claims.
      if (force) {
        tokens.forEach((consentToken) => claimStateCache.delete(claimStateKey(locationUuid, consentToken)));
      }
      runWithConcurrency(tokens, CLAIM_STATE_CONCURRENCY, async (consentToken) => {
        try {
          const state = await resolveClaimState(consentToken, locationUuid);
          if (seq === runSeq.current && state) {
            setStates((prev) => (prev[consentToken] === state ? prev : { ...prev, [consentToken]: state }));
          }
        } catch {
          if (seq === runSeq.current) {
            setFailed((count) => count + 1);
          }
        }
      }).finally(() => {
        if (seq === runSeq.current) {
          setResolving(false);
          settledKeyRef.current = tokenKey;
          setSettledKey(tokenKey);
        }
      });
    },
    [tokenKey, locationUuid, enabled],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Submitting or closing a claim changes the very state this is reporting, so that one
  // refetches even though these claims were already resolved.
  const reload = useCallback(() => load(true), [load]);
  useClaimChanged(reload);

  // Nothing to resolve counts as settled; otherwise the current claim set must be the
  // one a run has finished for. A caller that shouldn't show half-resolved statuses can
  // wait on this.
  const settled = !enabled || tokenKey === '' || settledKey === tokenKey;

  return { states, resolving, settled, failed, reload };
}

/** Run `onClaimChanged` whenever the claim is mutated anywhere in the page. */
export function useClaimChanged(onClaimChanged: () => void) {
  const onClaimChangedRef = useRef(onClaimChanged);
  onClaimChangedRef.current = onClaimChanged;

  useEffect(() => {
    const handler = () => onClaimChangedRef.current();
    window.addEventListener(CLAIM_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CLAIM_CHANGED_EVENT, handler);
  }, []);
}

export async function fetchPatientClaimVisit(claimVisitsDto: ClaimVisitsDto): Promise<ClaimVisitReponse[]> {
  const claimVisitsFilter: ClaimVisitsDto = {};
  if (claimVisitsDto.consentToken) {
    claimVisitsFilter['consentToken'] = claimVisitsDto.consentToken;
  }
  if (claimVisitsDto.patientId) {
    claimVisitsFilter['patientId'] = claimVisitsDto.patientId;
  }
  if (claimVisitsDto.locationUuid) {
    claimVisitsFilter['locationUuid'] = claimVisitsDto.locationUuid;
  }
  if (claimVisitsDto.visitDate) {
    claimVisitsFilter['visitDate'] = claimVisitsDto.visitDate;
  }
  const { hieBaseUrl } = await getHieBaseUrl();
  const queryString = new URLSearchParams(claimVisitsFilter).toString();
  const response = await openmrsFetch(`${hieBaseUrl}/claims-visit?${queryString}`);
  const data = (await response.json()) as ClaimVisitReponse[];
  return data ?? [];
}

export async function fetchPatientBillPayments(patientPaymentsDto: PatientPaymentsDto): Promise<PatientPayment[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const patientPaymentsUrl = `${etlBaseUrl}/bill/patient/payment?billingDate=${patientPaymentsDto.billingDate}&patientUuid=${patientPaymentsDto.patientUuid}`;
  const response = await openmrsFetch(patientPaymentsUrl);
  const data = (await response.json()) as PatientPaymentReponse;
  return data.results ?? [];
}

export async function payBillItem(billUuid: string, billPaymentDto: BillPaymentDto) {
  const billPaymentUrl = `${restBaseUrl}/billing/bill/${billUuid}/payment`;
  const response = await openmrsFetch(billPaymentUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(billPaymentDto),
  });
  const data = (await response.json()) as BillPaymentResponse;
  return data ?? null;
}

export async function addClaimItem(addClaimLineDto: AddClaimLineDto) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const addClaimLineUrl = `${hieBaseUrl}/claim-line`;
  const result = await openmrsFetch(addClaimLineUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(addClaimLineDto),
  }).catch((error) => {
    const message = error?.responseBody?.message ?? error?.message ?? '';
    if (typeof message === 'object') {
      throw `${message?.join(',')}`;
    }
    throw message || 'Failed to add claim line';
  });

  if (result?.data && 'error' in result.data && 'message' in result.data) {
    const message = result.data.message ?? '';
    throw typeof message === 'object' ? `${(message as string[]).join(',')}` : message;
  }
  return result?.data ?? null;
}

export async function removeClaimItem(removeClaimLineDto: RemoveClaimLineDto) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claim-line`;
  const result = await openmrsFetch(url, {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(removeClaimLineDto),
  }).catch((error) => {
    const message = error?.responseBody?.message ?? '';
    if (typeof message === 'object') {
      throw `${message?.join(',')}`;
    }
    throw message;
  });

  if (result?.data && 'error' in result.data && 'message' in result.data) {
    const message = result.data.message ?? '';
    throw message;
  }
  return result?.data;
}

// TODO(backend): the `${hieBaseUrl}/interventions/switch` route is not yet
// exposed by the HIE proxy. An equivalent switch lives on the DHA middleware
// (`/claims/interventions/switch`, see src/claims/interventions.resource.ts),
// but this posts the camelCase SwitchInterventionDto through the same OpenMRS
// proxy the other claim-line mutations use. Wire the backend route before this
// ships.
export async function switchClaimIntervention(switchInterventionDto: SwitchInterventionDto) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/interventions/switch`;
  const result = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(switchInterventionDto),
  }).catch((error) => {
    const message = error?.responseBody?.message ?? '';
    if (typeof message === 'object') {
      throw `${message?.join(',')}`;
    }
    throw message;
  });

  if (result?.data && 'error' in result.data && 'message' in result.data) {
    const message = result.data.message ?? '';
    throw message;
  }
  return result?.data;
}

/** Retire (remove) an intervention from the claim visit.
 * @see https://hie-docs.dha.go.ke/docs/claims/process/interventions/retireIntervention
 */
export async function retireClaimIntervention(dto: {
  consentToken: string;
  interventionCode: string;
  locationUuid: string;
}) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/interventions/retire`;
  const result = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(dto),
  }).catch((error) => {
    const message = error?.responseBody?.message ?? error?.message ?? '';
    if (typeof message === 'object') {
      throw `${(message as string[]).join(',')}`;
    }
    throw message || 'Failed to remove intervention';
  });

  if (result?.data && 'error' in result.data && 'message' in result.data) {
    const message = result.data.message ?? '';
    throw typeof message === 'object' ? `${(message as string[]).join(',')}` : message;
  }
  return result?.data;
}

export async function closeClaim(closeClaimDto: CloseClaimDto) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const addClaimLineUrl = `${hieBaseUrl}/claim-closure`;
  const response = await openmrsFetch(addClaimLineUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(closeClaimDto),
  });
  const data = (await response.json()) as ClaimVisitReponse;
  return data ?? null;
}

export async function submitClaim(submitClaimDto: SubmitClaimDto, visitType: string = 'INPATIENT') {
  const { hieBaseUrl } = await getHieBaseUrl();
  let claimUrl = `${hieBaseUrl}/claim-submission`;
  if (visitType === 'INPATIENT') {
    submitClaimDto['dischargeDate'] = new Date().toISOString();
    claimUrl = `${hieBaseUrl}/claim-submission/inpatient`;
  }
  const response = await openmrsFetch(claimUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(submitClaimDto),
  });
  const data = (await response.json()) as ClaimVisitReponse;
  return data ?? null;
}

export async function fetchPatientDiagnosis(
  amrsVisitDiagnosisDto: AmrsVisitDiagnosisDto,
): Promise<AmrsVisitDiagnosis[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const patientDiagnosisUrl = `${etlBaseUrl}/patient/diagnosis?visitDate=${amrsVisitDiagnosisDto.visitDate}&patientUuid=${amrsVisitDiagnosisDto.patientUuid}&locationUuid=${amrsVisitDiagnosisDto.locationUuid}`;
  const response = await openmrsFetch(patientDiagnosisUrl);
  const data = (await response.json()) as AmrsVisitDiagnosisResponse;
  return data.results ?? [];
}

export async function fetchMaternityDiagnosis(
  amrsMaternityDiagnosisDto: AmrsMaternityDiagnosisDto,
): Promise<AmrsMaternityDiagnosis[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const patientDiagnosisUrl = `${etlBaseUrl}/maternity-diagnosis-doctor?patientUuid=${amrsMaternityDiagnosisDto.patientUuid}&billingDate=${amrsMaternityDiagnosisDto.billingDate}`;
  const response = await openmrsFetch(patientDiagnosisUrl);
  const data = (await response.json()) as AmrsMaternityDiagnosisResponse;
  return data.results ?? [];
}

export async function addClaimDiagnosis(addClaimDiagnosisDto: AddClaimDiagnosisDto) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const addClaimDiagnosisUrl = `${hieBaseUrl}/claim-diagnosis`;
  const response = await openmrsFetch(addClaimDiagnosisUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(addClaimDiagnosisDto),
  });
  const data = await response.json();
  return data ?? null;
}

export const endVisit = async (visitUuid: string) => {
  const url = `${restBaseUrl}/visit/${visitUuid}`;
  const stopDatetime = new Date();
  const body = {
    stopDatetime,
  };
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response.json();
};

export const getActiveVisits = async (locationUuid: string, billDate: string) => {
  const etlBaseUrl = await getEtlBaseUrl();
  try {
    const url = `${etlBaseUrl}/facility/active-bill-visits?locationUuid=${locationUuid}&billingDate=${billDate}`;
    const response = await openmrsFetch(url);
    const data = await response.json();

    return data.results ?? [];
  } catch (error) {
    console.error('Error fetching active visits:', error);
    throw error;
  }
};

export const useFacilityPreauths = (locationUuid: string, billingDate: string) => {
  const { etlBaseUrl } = useConfig({
    externalModuleName: '@ampath/esm-dha-workflow-app',
  });

  const url = `${etlBaseUrl}/facility/pre-auth-bills?billingDate=${billingDate}&locationUuid=${locationUuid}`;
  const { data, error, isLoading, isValidating } = useSWR<{
    data: FacilityPreauthsResponse;
  }>(url, openmrsFetch);

  return {
    facilityPreauths: data?.data?.results,
    error,
    isLoading,
    isValidating,
  };
};

export const getActiveCashVisits = async (locationUuid: string, billDate: string) => {
  const etlBaseUrl = await getEtlBaseUrl();
  const url = `${etlBaseUrl}/facility/active-cash-visits?locationUuid=${locationUuid}&billingDate=${billDate}`;

  const response = await openmrsFetch(url);

  return response.json();
};

export const getFacilityBillLineItems = async (
  locationUuid: string,
  billDate: string,
): Promise<PendingBillLineItems[]> => {
  const etlBaseUrl = await getEtlBaseUrl();
  const url = `${etlBaseUrl}/facility/bill-line-item?locationUuid=${locationUuid}&billingDate=${billDate}`;

  const response = await openmrsFetch(url);

  const data = await response.json();

  return (data.results ?? []).map((row: any) => ({
    ...row,
    pending_line_items:
      typeof row.pending_line_items === 'string' ? JSON.parse(row.pending_line_items) : row.pending_line_items,
  }));
};

export async function fetchPatientEncounterDiagnosis(
  amrsVisitDiagnosisDto: AmrsVisitDiagnosisDto,
): Promise<AmrsVisitDiagnosis[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const patientDiagnosisUrl = `${etlBaseUrl}/patient/encounter-diagnosis?visitDate=${amrsVisitDiagnosisDto.visitDate}&patientUuid=${amrsVisitDiagnosisDto.patientUuid}&locationUuid=${amrsVisitDiagnosisDto.locationUuid}`;
  const response = await openmrsFetch(patientDiagnosisUrl);
  const data = (await response.json()) as AmrsVisitDiagnosisResponse;
  return data.results ?? [];
}
