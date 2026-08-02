import { openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { fetchFacilityPreauthBills } from '../../../billing-claims.resource';
import { fetchShaInterventionByCode } from '../../../../claims/claims.resource';
import { type Intervention } from '../../../../claims';
import { IdentifierTypesUuids } from '../../../../resources/identifier-types';
import { type PatientFacilityBillDetails } from '../types';
import { getConsentToken } from '../../../../shared/services/claims.resource';

const PREAUTH_CODE_KEY = 'ampath.preauthCode';

export const asBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
};

/** SHA coverage flags for an intervention_code (from interventions coverage API). */
export type ShaInterventionPreauthFlags = {
  needsPreauth: boolean;
  needsManualPreauthApproval: boolean;
  intervention?: Intervention | null;
};

/**
 * Bill lines that need elective preauth (`needsManualPreauthApproval`) and are not yet approved.
 */
export const needsElectivePreauth = (item: PatientFacilityBillDetails): boolean => {
  if (!item?.intervention_code) {
    return false;
  }
  if (asBool(item.preauth_approved)) {
    return false;
  }
  if (item.elective_preauth != null) {
    return asBool(item.elective_preauth);
  }
  return false;
};

/**
 * Bill lines that need normal (non-elective) preauth and are not yet approved.
 * Prefer ETL flags when present; otherwise use SHA intervention coverage for the
 * bill's `intervention_code` (`needsPreauth` && !`needsManualPreauthApproval`).
 * @see https://hie-docs.dha.go.ke/docs/claims/process/preauths/normalPreauths
 */
export const needsNormalPreauth = (
  item: PatientFacilityBillDetails,
  sha?: ShaInterventionPreauthFlags | null,
): boolean => {
  if (!item?.intervention_code) {
    return false;
  }
  if (asBool(item.preauth_approved)) {
    return false;
  }
  // Elective is a separate queue / workspace mode
  if (asBool(item.elective_preauth)) {
    return false;
  }
  // Prefer explicit ETL flags when the bill payload includes them
  if (item.requires_preauth != null) {
    return asBool(item.requires_preauth) && !asBool(item.elective_preauth);
  }
  if (item.normal_preauth != null) {
    return asBool(item.normal_preauth);
  }
  // Facility bill lines often omit ETL flags — use SHA coverage for intervention_code
  if (sha) {
    return Boolean(sha.needsPreauth) && !Boolean(sha.needsManualPreauthApproval);
  }
  return false;
};

/**
 * Resolve normal-preauth need for a bill line via SHA interventions coverage
 * using `cr_no` + `intervention_code` (+ optional `subBenefitCode` from claim visit).
 */
export async function resolveNormalPreauthForBillItem(
  item: PatientFacilityBillDetails,
  locationUuid: string,
  subBenefitCode?: string,
): Promise<ShaInterventionPreauthFlags | null> {
  const code = (item.intervention_code ?? '').trim();
  const patientId = (item.cr_no ?? '').trim();
  if (!code || !patientId || !locationUuid) {
    return null;
  }
  try {
    const intervention = await fetchShaInterventionByCode(
      patientId,
      locationUuid,
      code,
      subBenefitCode,
    );
    if (!intervention) {
      return { needsPreauth: false, needsManualPreauthApproval: false, intervention: null };
    }
    return {
      needsPreauth: Boolean(intervention.needsPreauth),
      needsManualPreauthApproval: Boolean(intervention.needsManualPreauthApproval),
      intervention,
    };
  } catch {
    return null;
  }
}

export async function fetchActiveVisitForPatient(patientUuid: string, locationUuid?: string): Promise<Visit | null> {
  if (!patientUuid) {
    return null;
  }
  const params = new URLSearchParams({
    patient: patientUuid,
    includeInactive: 'false',
    fromStartDate: dayjs().startOf('day').toISOString(),
    v: 'full',
    limit: '1',
  });
  if (locationUuid) {
    params.set('location', locationUuid);
  }
  const response = await openmrsFetch(`${restBaseUrl}/visit?${params.toString()}`);
  const results = response?.data?.results as Visit[] | undefined;
  return results?.[0] ?? null;
}

export async function fetchNormalPreauthBillItems(
  locationUuid: string,
  billingDate: string,
): Promise<PatientFacilityBillDetails[]> {
  const results = await fetchFacilityPreauthBills({ locationUuid, billingDate });
  // Dedicated `/facility/pre-auth-bills` already returns preauth candidates; still drop
  // elective / already-approved / lines without an intervention code.
  return (results ?? []).filter((item) => {
    if (!item?.intervention_code) return false;
    if (asBool(item.preauth_approved)) return false;
    if (asBool(item.elective_preauth)) return false;
    if (item.requires_preauth != null || item.normal_preauth != null) {
      return needsNormalPreauth(item);
    }
    return true;
  });
}

export async function fetchElectivePreauthBillItems(
  locationUuid: string,
  billingDate: string,
): Promise<PatientFacilityBillDetails[]> {
  const results = await fetchFacilityPreauthBills({ locationUuid, billingDate });
  return (results ?? []).filter((item) => needsElectivePreauth(item));
}

export async function fetchPreauthBillItems(
  locationUuid: string,
  billingDate: string,
): Promise<PatientFacilityBillDetails[]> {
  const results = await fetchFacilityPreauthBills({ locationUuid, billingDate });
  return (results ?? []).filter((item) => {
    if (!item?.intervention_code) return false;
    if (asBool(item.preauth_approved)) return false;
    if (asBool(item.elective_preauth)) return true;
    if (item.requires_preauth != null || item.normal_preauth != null) {
      return needsNormalPreauth(item);
    }
    return true;
  });
}

export function resolveConsentTokenForVisit(visit: Visit | null | undefined): string {
  if (!visit) return '';
  return getConsentToken(visit);
}

export function storePreauthCode(consentToken: string, interventionCode: string, preauthCode: string) {
  try {
    const raw = sessionStorage.getItem(PREAUTH_CODE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[`${consentToken}::${interventionCode}`] = preauthCode;
    sessionStorage.setItem(PREAUTH_CODE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getStoredPreauthCode(consentToken: string, interventionCode: string): string | undefined {
  try {
    const raw = sessionStorage.getItem(PREAUTH_CODE_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[`${consentToken}::${interventionCode}`];
  } catch {
    return undefined;
  }
}

export function parseDocTypes(csv?: string | null): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function interventionFlagsFromBillItem(item: PatientFacilityBillDetails) {
  return {
    code: item.intervention_code,
    ...readSpecialtyFlags(item),
    requiredPreauthDocumentTypes: parseDocTypes(item.required_preauth_document_types),
    applicableDocumentTypes: parseDocTypes(item.applicable_document_types),
  };
}

/** Specialty flags from visit/SHA/bill payloads (snake_case or camelCase). */
export function readSpecialtyFlags(source: unknown): {
  requiresSurgicalPreauth: boolean;
  requiresRenalPreauth: boolean;
  requiresOncologyPreauth: boolean;
  requiresRadiologyPreauth: boolean;
  requiresOpticalPreauth: boolean;
} {
  const s = (source ?? {}) as Record<string, unknown>;
  return {
    requiresSurgicalPreauth: asBool(s.requiresSurgicalPreauth ?? s.requires_surgical_preauth),
    requiresRenalPreauth: asBool(s.requiresRenalPreauth ?? s.requires_renal_preauth),
    requiresOncologyPreauth: asBool(s.requiresOncologyPreauth ?? s.requires_oncology_preauth),
    requiresRadiologyPreauth: asBool(s.requiresRadiologyPreauth ?? s.requires_radiology_preauth),
    requiresOpticalPreauth: asBool(s.requiresOpticalPreauth ?? s.requires_optical_preauth),
  };
}

export function mergeSpecialtyFlags(
  ...sources: Array<ReturnType<typeof readSpecialtyFlags> | null | undefined>
): ReturnType<typeof readSpecialtyFlags> {
  return sources.reduce(
    (acc, src) => ({
      requiresSurgicalPreauth: acc.requiresSurgicalPreauth || !!src?.requiresSurgicalPreauth,
      requiresRenalPreauth: acc.requiresRenalPreauth || !!src?.requiresRenalPreauth,
      requiresOncologyPreauth: acc.requiresOncologyPreauth || !!src?.requiresOncologyPreauth,
      requiresRadiologyPreauth: acc.requiresRadiologyPreauth || !!src?.requiresRadiologyPreauth,
      requiresOpticalPreauth: acc.requiresOpticalPreauth || !!src?.requiresOpticalPreauth,
    }),
    {
      requiresSurgicalPreauth: false,
      requiresRenalPreauth: false,
      requiresOncologyPreauth: false,
      requiresRadiologyPreauth: false,
      requiresOpticalPreauth: false,
    },
  );
}

export function preauthFormLabel(flags: {
  requiresSurgicalPreauth?: boolean;
  requiresRenalPreauth?: boolean;
  requiresOncologyPreauth?: boolean;
  requiresRadiologyPreauth?: boolean;
  requiresOpticalPreauth?: boolean;
}): string {
  if (flags.requiresSurgicalPreauth) return 'Surgical';
  if (flags.requiresRenalPreauth) return 'Renal';
  if (flags.requiresOncologyPreauth) return 'Oncology';
  if (flags.requiresRadiologyPreauth) return 'Imaging';
  if (flags.requiresOpticalPreauth) return 'Optical';
  return 'Normal';
}

export type PreauthInterventionProps = {
  code: string;
  name?: string;
  requiresSurgicalPreauth?: boolean;
  requiresRenalPreauth?: boolean;
  requiresOncologyPreauth?: boolean;
  requiresRadiologyPreauth?: boolean;
  requiresOpticalPreauth?: boolean;
  requiredPreauthDocumentTypes?: string[];
  applicableDocumentTypes?: string[];
};

export const GENERATABLE_DOC_TYPES = new Set(['DISCHARGE_SUMMARY', 'INVOICE', 'FINAL_BILL']);

export type OpenMrsProviderHit = {
  uuid: string;
  display: string;
  identifier?: string;
  /** From provider attribute type PROVIDER_NATIONAL_ID_UUID (National ID card) */
  nationalId?: string;
  person?: { display?: string; uuid?: string };
};

function extractProviderNationalId(
  attributes?: Array<{ value?: string; voided?: boolean; attributeType?: { uuid?: string } }>,
): string | undefined {
  const hit = (attributes ?? []).find(
    (a) => !a.voided && a.attributeType?.uuid === IdentifierTypesUuids.PROVIDER_NATIONAL_ID_UUID && a.value,
  );
  return hit?.value ? String(hit.value).trim() : undefined;
}

export async function searchOpenMrsProviders(q: string): Promise<OpenMrsProviderHit[]> {
  if (!q || q.trim().length < 2) {
    return [];
  }
  const url = `${restBaseUrl}/provider?q=${encodeURIComponent(q.trim())}&v=custom:(uuid,display,identifier,person:(uuid,display),attributes:(uuid,value,voided,attributeType:(uuid)))`;
  const response = await openmrsFetch(url);
  const results = (response?.data?.results as Array<OpenMrsProviderHit & { attributes?: any[] }>) ?? [];
  return results.map((p) => ({
    uuid: p.uuid,
    display: p.display,
    identifier: p.identifier,
    person: p.person,
    nationalId: extractProviderNationalId(p.attributes),
  }));
}

export type HwrSearchResult = {
  membership?: {
    id?: string;
    full_name?: string;
    registration_id?: string;
    licensing_body?: string;
    specialty?: string;
    status?: string;
  };
  contacts?: { email?: string; phone?: string };
  identifiers?: {
    identification_type?: string;
    identification_number?: string;
    client_registry_id?: string;
  };
};

/** GET {hieBaseUrl}/practitioner/search */
export async function searchHealthWorkerRegistry(params: {
  identifierType: string;
  identifierValue: string;
  locationUuid: string;
}): Promise<HwrSearchResult[]> {
  const { getHieBaseUrl } = await import('../../../../claims/utils');
  const { hieBaseUrl } = await getHieBaseUrl();
  const qs = new URLSearchParams({
    identifierType: params.identifierType,
    identifierValue: params.identifierValue,
    locationUuid: params.locationUuid,
  });
  const response = await openmrsFetch(`${hieBaseUrl}/practitioner/search?${qs.toString()}`);
  const data = response?.data;
  if (Array.isArray(data)) {
    // Backend may return HealthWokerApiResponse[] with { message } wrappers
    return data.map((row: any) => row?.message ?? row).filter(Boolean);
  }
  if (data?.message) {
    return [data.message];
  }
  return data ? [data] : [];
}

export function billingDateToVisitDate(billDate?: string): string {
  if (!billDate) {
    return dayjs().format('YYYY-MM-DD');
  }
  // "2026-07-23 12:16" or ISO
  const d = dayjs(billDate);
  return d.isValid() ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
}

/** Build service_start/service_end ISO. `timeOrEndOfDay` may be "HH:mm" / "HH:mm:ss", or true for end-of-day. */
export function dateToServiceIso(date: Date | undefined, timeOrEndOfDay: string | boolean = false): string {
  if (!date || Number.isNaN(date.getTime())) {
    return dayjs().format('YYYY-MM-DDTHH:mm:ssZ');
  }
  if (typeof timeOrEndOfDay === 'string') {
    const parts = timeOrEndOfDay.split(':').map((p) => Number(p));
    const [h = 0, m = 0, s = 0] = parts;
    return dayjs(date).hour(h).minute(m).second(s).format('YYYY-MM-DDTHH:mm:ssZ');
  }
  const d = timeOrEndOfDay
    ? dayjs(date).hour(23).minute(59).second(0)
    : dayjs(date).hour(8).minute(0).second(0);
  return d.format('YYYY-MM-DDTHH:mm:ssZ');
}

/** Reusable preauth status check — prefer these over calling getPreauthPreview directly. */
export {
  checkPreauthStatus,
  usePreauthPreview,
  isPreauthFinalised,
  isPreauthTerminalFailure,
  invalidatePreauthPreview,
  preauthPreviewSwrKey,
  type PreauthCheckKind,
  type PreauthCheckResult,
} from '../../../../claims/claims.resource';
