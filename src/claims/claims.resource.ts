import useSWR, { mutate as globalMutate } from 'swr';
import dayjs from 'dayjs';
import {
  ServiceType,
  type BenefitUtilization,
  type InterventionResults,
  type ClaimResult,
  type Intervention,
  VisitType,
  type ClientSubBenefit,
  PomsfBalance,
  PreExistingIntervention,
} from './index';
import { fetchUrl, getHieBaseUrl, getUrl, useHie } from './utils';
import { openmrsFetch, restBaseUrl, useSession, Visit } from '@openmrs/esm-framework';

export const useClientSubBenefits = (clientRegistryId: string) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url = clientRegistryId
    ? `${hieBaseUrl}/sub-benefits?patient_id=${clientRegistryId}&locationUuid=${locationUuid}`
    : null;

  const { data, error, isLoading } = useSWR<{ data: Array<ClientSubBenefit> }>(url, openmrsFetch);

  const results = data?.data;

  return {
    clientSubBenefits: results,
    error,
    isLoadingClientSubBenefits: isLoading,
  };
};

export const useInterventions = (clientRegistryId: string, subBenefitCode: string) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url =
    clientRegistryId && subBenefitCode
      ? `${hieBaseUrl}/interventions?patient_id=${clientRegistryId}&locationUuid=${locationUuid}&sub_benefit_code=${subBenefitCode}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: Array<Intervention> }>(url, openmrsFetch);

  const results = data?.data;

  return {
    interventions: results,
    error,
    isLoadingInterventions: isLoading,
  };
};

/**
 * Fetch patient sub-benefits (required by hie-saf interventions proxy).
 */
export async function fetchClientSubBenefits(
  patientId: string,
  locationUuid: string,
): Promise<ClientSubBenefit[]> {
  if (!patientId || !locationUuid) {
    return [];
  }
  const { hieBaseUrl } = await getHieBaseUrl();
  const params = new URLSearchParams({
    patient_id: patientId,
    locationUuid,
  });
  const response = await openmrsFetch(`${hieBaseUrl}/sub-benefits?${params.toString()}`);
  const data = response?.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  return [];
}

function unwrapInterventions(data: unknown): Intervention[] {
  if (Array.isArray(data)) {
    return data as Intervention[];
  }
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: Intervention[] }).results;
  }
  if (data && typeof data === 'object' && 'code' in (data as object)) {
    return [data as Intervention];
  }
  return [];
}

/** Parent package prefix from an intervention code, e.g. SHA-19-239 → SHA-19 */
function interventionPackagePrefix(interventionCode: string): string {
  const parts = interventionCode.trim().toUpperCase().split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return interventionCode.trim().toUpperCase();
}

/**
 * Look up a single SHA intervention by code via interventions coverage.
 * hie-saf requires `sub_benefit_code`; we resolve it from the patient's sub-benefits,
 * preferring packages that match the intervention prefix (SHA-19-239 → SHA-19…).
 * Response includes `needsPreauth` / `needsManualPreauthApproval`.
 * @see https://hie-docs.dha.go.ke/docs/claims/process/preauths/normalPreauths
 */
export async function fetchShaInterventionByCode(
  patientId: string,
  locationUuid: string,
  interventionCode: string,
  subBenefitCode?: string,
): Promise<Intervention | null> {
  if (!patientId || !locationUuid || !interventionCode) {
    return null;
  }
  const { hieBaseUrl } = await getHieBaseUrl();
  const code = interventionCode.trim().toUpperCase();
  const prefix = interventionPackagePrefix(code);

  const tryFetch = async (sbCode: string): Promise<Intervention | null> => {
    if (!sbCode) return null;
    const params = new URLSearchParams({
      patient_id: patientId,
      locationUuid,
      sub_benefit_code: sbCode,
      code: interventionCode.trim(),
    });
    const response = await openmrsFetch(`${hieBaseUrl}/interventions?${params.toString()}`);
    const list = unwrapInterventions(response?.data);
    return list.find((i) => (i?.code ?? '').trim().toUpperCase() === code) ?? null;
  };

  if (subBenefitCode) {
    const hit = await tryFetch(subBenefitCode);
    if (hit) return hit;
  }

  const subBenefits = await fetchClientSubBenefits(patientId, locationUuid);
  if (subBenefits.length === 0) {
    return null;
  }

  const ranked = [...subBenefits].sort((a, b) => {
    const score = (s: ClientSubBenefit) => {
      const c = (s.code ?? '').toUpperCase();
      const parent = (s.parentBenefitCode ?? '').toUpperCase();
      if (c === prefix || parent === prefix) return 0;
      if (c.startsWith(`${prefix}-`) || c.startsWith(prefix)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  for (const sb of ranked) {
    try {
      const hit = await tryFetch(sb.code);
      if (hit) return hit;
    } catch {
      // try next sub-benefit
    }
  }
  return null;
}

export const useBenefitUtilizations = (clientRegistryId: string, interventionCode: string, isCapitation: boolean, isPomsf: boolean) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url =
    clientRegistryId && interventionCode && !isCapitation && !isPomsf
      ? `${hieBaseUrl}/benefits-utilization?patient_id=${clientRegistryId}&locationUuid=${locationUuid}&intervention_code=${interventionCode}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: Array<BenefitUtilization> }>(url, openmrsFetch);

  const results = data?.data;

  if (results && 'error' in results && 'message' in results) {
    return {
      benefitUtilizations: null,
      error,
      isLoadingClientSubBenefits: isLoading,
    }
  }

  return {
    benefitUtilizations: results,
    error,
    isLoadingBenefitUtilization: isLoading,
  };
};

export const usePomsfBalance = (clientRegistryId: string, isPomsf: boolean) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url =
    clientRegistryId && isPomsf
      ? `${hieBaseUrl}/pomsf-balance?patient_id=${clientRegistryId}&locationUuid=${locationUuid}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: PomsfBalance }>(url, openmrsFetch);

  const results = data?.data;

  if (results && 'error' in results && 'message' in results) {
    return {
      pomsfBalance: null,
      error,
      isLoadingPomsfBalances: isLoading,
    }
  }

  return {
    pomsfBalance: results,
    error,
    isLoadingPomsfBalances: isLoading,
  };
};

export async function createClaimsVisit(
  interventionCode: string,
  crIdentifier: string,
  serviceType: ServiceType,
  locationUuid: string,
  { auth_guid, otp }: { auth_guid?: string; otp?: string } = {},
) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claims-visit`;

  let payload = {
    locationUuid,
    intervention_codes: [interventionCode],
    patient_id: crIdentifier,
    service_type: serviceType, // Type of service Options: CAPITATION, OUTPATIENT, INPATIENT, EMERGENCY
  };

  if (otp) {
    payload['otp'] = otp;
  }

  if (auth_guid) {
    payload['auth_guid'] = auth_guid;
  }

  const result = await openmrsFetch<ClaimResult>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // signal: abortController.signal,
    body: payload,
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

  return result.data;
}

export const usePreExistingIntervention = (patientUuid: string) => {
  const { hieBaseUrl } = useHie();
  const url = patientUuid
    ? `${hieBaseUrl}/bill-order/patient-claim-bill-order?patient_uuid=${patientUuid}`
    : null;

  const { data, error, isLoading } = useSWR<{ data: PreExistingIntervention[] }>(url, openmrsFetch);

  const results = data?.data;

  return {
    preExistingInterventions: results,
    error,
    isLoadingPreExistingIntervention: isLoading,
  };
};

export async function updateBillOrderConsentToken(
  id: number,
  consentToken: string,
) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/bill-order/${id}/consent-token`;

  let payload = {
    consent_token: consentToken
  };

  const result = await openmrsFetch<any>(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
  }).catch((error) => {
    const message = error?.responseBody?.message ?? '';
    if (typeof message === 'object') {
      throw `${message?.join(',')}`;
    }
    throw message;
  });

  return result.data;
}

export const usePatientVisit = (patientUuid: string) => {
  console.log('patientUuid');
  console.log(patientUuid);
  console.log('patientUuid');
  const sessionLocation = useSession();

  const url = patientUuid
    ? `${restBaseUrl}/visit?patient=${patientUuid}&${sessionLocation?.sessionLocation?.uuid}&includeInactive=false&fromStartDate=${dayjs().startOf('day').toISOString()}&v=full&limit=1`
    : null;

  const { data, error, isLoading } = useSWR<{
    data: {
      results: Array<Visit>;
    };
  }>(url, openmrsFetch);

  return {
    data: data?.data?.results,
    error,
    isLoading,
  };
};

export type PreauthAttachmentMeta = {
  document_title: string;
  document_type: string;
  file_field_name: string;
};

/** HIE multipart file field for attachment at zero-based index. */
export const preauthAttachmentFieldName = (index: number): string => `attachments_${index}_file_blob`;

/** Parse index from attachments_N_file_blob; returns null if invalid. */
export const parsePreauthAttachmentIndex = (fieldName: string): number | null => {
  const match = /^attachments_(\d+)_file_blob$/.exec(fieldName?.trim() ?? '');
  if (!match) return null;
  return Number(match[1]);
};

/**
 * Normalize attachment metadata + files to contiguous indexes 0..n-1.
 * Ensures attachments[i].file_field_name === attachments_i_file_blob and a matching file exists.
 */
export const normalizePreauthAttachments = (
  attachments: PreauthAttachmentMeta[] = [],
  files: Record<string, File | Blob> = {},
): { attachments: PreauthAttachmentMeta[]; files: Record<string, File | Blob> } => {
  const withFiles = attachments
    .map((meta, index) => {
      const declared = meta.file_field_name || preauthAttachmentFieldName(index);
      const file = files[declared] ?? files[preauthAttachmentFieldName(index)];
      if (!file) return null;
      return { meta, file, preferredIndex: parsePreauthAttachmentIndex(declared) ?? index };
    })
    .filter(Boolean) as Array<{ meta: PreauthAttachmentMeta; file: File | Blob; preferredIndex: number }>;

  // Stable order: by declared index, then original order
  withFiles.sort((a, b) => a.preferredIndex - b.preferredIndex);

  const normalizedMeta: PreauthAttachmentMeta[] = [];
  const normalizedFiles: Record<string, File | Blob> = {};

  withFiles.forEach(({ meta, file }, index) => {
    const field = preauthAttachmentFieldName(index);
    normalizedMeta.push({
      document_title: meta.document_title,
      document_type: meta.document_type,
      file_field_name: field,
    });
    normalizedFiles[field] = file;
  });

  return { attachments: normalizedMeta, files: normalizedFiles };
};

export type PreauthFormPayload = {
  service_start: string;
  service_end: string;
  items: Array<{ unit_price: string; name?: string; quantity?: string }>;
  diagnoses: Array<{ consent_token: string; icd_code: string }>;
  doctors: Array<{
    identification_number: string;
    identification_type: string;
    regulation_body: string;
    intervention_code: string;
    is_primary: boolean;
  }>;
  attachments: PreauthAttachmentMeta[];
  provider_notification_email: string;
  locationUuid: string;
  /** Binary files keyed by file_field_name (e.g. attachments_0_file_blob) */
  files?: Record<string, File | Blob>;
  // Specialty (Postman)
  clinical_indications?: string;
  carcinoma_staging?: string;
  comorbidity?: string;
  metastases?: string[] | string;
  treatment_setting?: string[] | string;
  number_of_sessions_required?: string | number;
  cost_per_session?: string | number;
  is_co_insured?: string | boolean;
  necessity_of_service?: string;
  lens_prescription?: string;
  lens_amount?: string | number;
  eye_examination_amount?: string | number;
  frame_amount?: string | number;
  new_or_replacement?: string;
  frequency_of_sessions?: string;
  start_date?: string;
  progress_report?: string;
  expected_service_start_date?: string;
  is_condition_related_to_employment?: string | boolean;
  is_condition_related_to_auto_or_other_accident?: string | boolean;
  co_insurance_details?: string;
  chief_complaint?: string;
  vital_signs?: string;
  history_of_present_illness?: string;
  physical_examination?: string;
  investigation_report_details?: string;
  type_of_anaesthesia?: string;
  surgery_date?: string;
};

/** Build multipart for POST {hieBaseUrl}/pre-auth/normal.
 * Matches HIE curl POST /api/v1/preauths (snake_case fields + attachments_N_file_blob).
 * Attachment indexes are normalized to 0..n-1 before send.
 */
export const generatePreauthFormData = (
  payload: PreauthFormPayload,
  intervention: Pick<
    Intervention,
    | 'code'
    | 'requiresRadiologyPreauth'
    | 'requiresOncologyPreauth'
    | 'requiresOpticalPreauth'
    | 'requiresRenalPreauth'
    | 'requiresSurgicalPreauth'
  >,
  consentToken: string,
) => {
  const formData = new FormData();
  const { attachments, files } = normalizePreauthAttachments(payload.attachments, payload.files ?? {});

  formData.append('consent_token', consentToken);
  formData.append('intervention_code', intervention.code);
  formData.append('service_start', payload.service_start);
  formData.append('service_end', payload.service_end);
  formData.append('items', JSON.stringify(payload.items));
  formData.append('diagnoses', JSON.stringify(payload.diagnoses));
  formData.append('doctors', JSON.stringify(payload.doctors));
  formData.append('attachments', JSON.stringify(attachments));
  formData.append('provider_notification_email', payload.provider_notification_email);
  formData.append('locationUuid', payload.locationUuid);

  // Append in index order: attachments_0_file_blob, attachments_1_file_blob, …
  attachments.forEach((meta) => {
    const file = files[meta.file_field_name];
    if (file) {
      formData.append(meta.file_field_name, file, (file as File).name ?? meta.file_field_name);
    }
  });

  if (intervention.requiresRadiologyPreauth && payload.clinical_indications) {
    formData.append('clinical_indications', payload.clinical_indications);
  }

  /** HIE expects JSON lists for metastases / treatment_setting (e.g. `["LUNG"]`). */
  const asJsonListField = (value: string | string[] | undefined | null): string | null => {
    if (value == null) return null;
    if (Array.isArray(value)) return JSON.stringify(value);
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[')) return trimmed;
    return JSON.stringify([trimmed]);
  };

  if (intervention.requiresOncologyPreauth) {
    if (payload.carcinoma_staging) formData.append('carcinoma_staging', payload.carcinoma_staging);
    if (payload.comorbidity) formData.append('comorbidity', payload.comorbidity);
    const metastasesJson = asJsonListField(payload.metastases);
    if (metastasesJson) formData.append('metastases', metastasesJson);
    const treatmentSettingJson = asJsonListField(payload.treatment_setting);
    if (treatmentSettingJson) formData.append('treatment_setting', treatmentSettingJson);
    if (payload.number_of_sessions_required != null) {
      formData.append('number_of_sessions_required', String(payload.number_of_sessions_required));
    }
    if (payload.cost_per_session != null) {
      formData.append('cost_per_session', String(payload.cost_per_session));
    }
    if (payload.is_co_insured != null) {
      formData.append('is_co_insured', String(payload.is_co_insured));
    }
    if (payload.start_date) formData.append('start_date', payload.start_date);
    if (payload.progress_report) formData.append('progress_report', payload.progress_report);
  }

  if (intervention.requiresOpticalPreauth) {
    if (payload.necessity_of_service) formData.append('necessity_of_service', payload.necessity_of_service);
    if (payload.lens_prescription) formData.append('lens_prescription', payload.lens_prescription);
    if (payload.lens_amount != null) formData.append('lens_amount', String(payload.lens_amount));
    if (payload.eye_examination_amount != null) {
      formData.append('eye_examination_amount', String(payload.eye_examination_amount));
    }
    if (payload.frame_amount != null) formData.append('frame_amount', String(payload.frame_amount));
    if (payload.new_or_replacement) formData.append('new_or_replacement', payload.new_or_replacement);
    if (payload.clinical_indications) formData.append('clinical_indications', payload.clinical_indications);
  }

  if (intervention.requiresRenalPreauth) {
    if (payload.number_of_sessions_required != null) {
      formData.append('number_of_sessions_required', String(payload.number_of_sessions_required));
    }
    if (payload.cost_per_session != null) {
      formData.append('cost_per_session', String(payload.cost_per_session));
    }
    if (payload.frequency_of_sessions) formData.append('frequency_of_sessions', payload.frequency_of_sessions);
    if (payload.clinical_indications) formData.append('clinical_indications', payload.clinical_indications);
    if (payload.start_date) formData.append('start_date', payload.start_date);
    if (payload.is_co_insured != null) formData.append('is_co_insured', String(payload.is_co_insured));
  }

  // Surgical clinical fields — send snake_case (HIE / gateway expects these keys)
  const hasSurgicalPayload = Boolean(
    payload.chief_complaint?.trim() ||
      payload.vital_signs?.trim() ||
      payload.history_of_present_illness?.trim() ||
      payload.physical_examination?.trim() ||
      payload.investigation_report_details?.trim() ||
      payload.type_of_anaesthesia?.trim() ||
      payload.surgery_date?.trim(),
  );
  if (intervention.requiresSurgicalPreauth || hasSurgicalPayload) {
    const chiefComplaint = (payload.chief_complaint ?? '').trim();
    const vitalSigns = (payload.vital_signs ?? '').trim();
    const historyOfPresentIllness = (payload.history_of_present_illness ?? '').trim();
    const physicalExamination = (payload.physical_examination ?? '').trim();
    const investigationReportDetails = (payload.investigation_report_details ?? '').trim();
    const typeOfAnaesthesia = (payload.type_of_anaesthesia || 'GENERAL').trim();
    const surgeryDate = (payload.surgery_date ?? '').trim();

    formData.append('chief_complaint', chiefComplaint);
    formData.append('vital_signs', vitalSigns);
    formData.append('history_of_present_illness', historyOfPresentIllness);
    formData.append('physical_examination', physicalExamination);
    formData.append('investigation_report_details', investigationReportDetails);
    formData.append('type_of_anaesthesia', typeOfAnaesthesia);
    if (surgeryDate) {
      formData.append('surgery_date', surgeryDate);
    }
    if (payload.is_condition_related_to_employment != null) {
      formData.append('is_condition_related_to_employment', String(payload.is_condition_related_to_employment));
    }
    if (payload.is_condition_related_to_auto_or_other_accident != null) {
      formData.append(
        'is_condition_related_to_auto_or_other_accident',
        String(payload.is_condition_related_to_auto_or_other_accident),
      );
    }
    if (payload.is_co_insured != null) {
      formData.append('is_co_insured', String(payload.is_co_insured));
    }
    if (payload.co_insurance_details) {
      formData.append('co_insurance_details', payload.co_insurance_details);
    }
  }

  if (payload.expected_service_start_date) {
    formData.append('expected_service_start_date', payload.expected_service_start_date);
  }

  return formData;
};

export async function createPreauth(
  payload: PreauthFormPayload,
  intervention: Pick<
    Intervention,
    | 'code'
    | 'requiresRadiologyPreauth'
    | 'requiresOncologyPreauth'
    | 'requiresOpticalPreauth'
    | 'requiresRenalPreauth'
    | 'requiresSurgicalPreauth'
  >,
  consentToken: string,
) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pre-auth/normal`;
  const formData = generatePreauthFormData(payload, intervention, consentToken);

  const result = await openmrsFetch(url, {
    method: 'POST',
    body: formData,
  }).catch((error) => {
    const message = error?.responseBody?.message ?? error?.message ?? 'Failed to create preauth';
    if (typeof message === 'object') {
      throw `${(message as string[])?.join?.(',') ?? JSON.stringify(message)}`;
    }
    throw message;
  });

  if (result?.data && typeof result.data === 'object' && 'error' in result.data) {
    throw (result.data as { message?: string }).message ?? 'Failed to create preauth';
  }

  return result?.data;
}

export async function getPreauthPreview(consentToken: string, locationUuid: string) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pre-auth/preview?consentToken=${encodeURIComponent(consentToken)}&locationUuid=${encodeURIComponent(locationUuid)}`;
  try {
    const result = await openmrsFetch(url);
    return result?.data ?? null;
  } catch (error: any) {
    const status = error?.response?.status ?? error?.status;
    // No preauth raised yet
    if (status === 404) {
      return null;
    }
    const message = error?.responseBody?.message ?? error?.message ?? 'Failed to get preauth preview';
    if (typeof message === 'object') {
      throw `${(message as string[])?.join?.(',') ?? JSON.stringify(message)}`;
    }
    throw message;
  }
}

/** Unwrap HIE preview: bare object, array, or paginated `{ results: [...] }`. */
export function unwrapPreauthPreviewItem(preview: unknown): Record<string, unknown> | null {
  const items = unwrapPreauthPreviewItems(preview);
  return items[0] ?? null;
}

/** All preauth rows from a preview response (paginated or single). */
export function unwrapPreauthPreviewItems(preview: unknown): Record<string, unknown>[] {
  if (!preview) {
    return [];
  }
  if (Array.isArray(preview)) {
    return preview.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  }
  if (typeof preview !== 'object') {
    return [];
  }
  const p = preview as Record<string, unknown>;
  if (Array.isArray(p.results)) {
    return p.results.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  }
  return [p];
}

const AWAITING_DOCTOR_STATUSES = new Set([
  'PENDING_DOCTOR_APPROVAL',
  'DOCTOR_REQUEST_SENT',
  'DOCTOR_REQUEST_FAILED',
]);

export function isAwaitingDoctorApproval(
  statusOrItem: string | Record<string, unknown> | null | undefined,
): boolean {
  if (!statusOrItem) return false;
  if (typeof statusOrItem === 'string') {
    return AWAITING_DOCTOR_STATUSES.has(statusOrItem.toUpperCase());
  }
  const status = String(statusOrItem.status ?? statusOrItem.preauth_status ?? '').toUpperCase();
  if (AWAITING_DOCTOR_STATUSES.has(status)) return true;
  const needs =
    statusOrItem.needsDoctorApproval === true ||
    statusOrItem.needs_doctor_approval === true;
  const approved =
    statusOrItem.doctorApproved === true || statusOrItem.doctor_approved === true;
  return needs && !approved && status !== 'FINALISED' && status !== 'FINALIZED';
}

export type PreauthPreviewRow = {
  id: string;
  consentToken: string;
  status: string;
  preauthType: string;
  interventionCode: string;
  interventionName: string;
  memberName: string;
  memberIdentifier: string;
  preauthToken: string;
  doctorName: string;
  practitionerRegistrationNumber: string;
  needsDoctorApproval: boolean;
  doctorApproved: boolean;
  serviceStart: string;
  raw: Record<string, unknown>;
};

function firstDoctorProfile(item: Record<string, unknown>): Record<string, unknown> | null {
  const doctors = item.preauthDoctors ?? item.preauth_doctors;
  if (!Array.isArray(doctors) || doctors.length === 0) return null;
  const first = doctors[0] as Record<string, unknown>;
  const profile = (first.doctorProfile ?? first.doctor_profile ?? first) as Record<string, unknown>;
  return profile && typeof profile === 'object' ? profile : null;
}

export function normalizePreauthPreviewItem(
  item: Record<string, unknown>,
  consentToken: string,
): PreauthPreviewRow {
  const interventionData = (item.interventionData ?? item.intervention_data ?? {}) as Record<
    string,
    unknown
  >;
  const profile = firstDoctorProfile(item);
  const interventionCode = String(
    item.interventionCode ??
      item.intervention_code ??
      interventionData.code ??
      '',
  ).trim();
  const interventionName = String(
    interventionData.name ?? item.interventionName ?? interventionCode,
  ).trim();
  const status = String(item.status ?? item.preauth_status ?? '').toUpperCase();
  const preauthType = String(
    item.preauthType ??
      item.preauth_type ??
      (item.isOncology || item.is_oncology
        ? 'ONCOLOGY'
        : item.isSurgical || item.is_surgical
          ? 'SURGICAL'
          : item.isRenal || item.is_renal
            ? 'RENAL'
            : item.isRadiology || item.is_radiology
              ? 'RADIOLOGY'
              : item.isOptical || item.is_optical
                ? 'OPTICAL'
                : 'NORMAL'),
  ).toUpperCase();
  const id = String(item.guid ?? item.id ?? `${consentToken}-${interventionCode}-${status}`);
  const practitionerRegistrationNumber = String(
    profile?.practitionerRegistrationNumber ??
      profile?.practitioner_registration_number ??
      profile?.nationalIdentifier ??
      '',
  ).trim();

  return {
    id,
    consentToken,
    status,
    preauthType,
    interventionCode,
    interventionName,
    memberName: String(item.memberName ?? item.member_name ?? '').trim(),
    memberIdentifier: String(item.memberIdentifier ?? item.member_identifier ?? '').trim(),
    preauthToken: String(item.token ?? item.preauth_code ?? item.preauthCode ?? '').trim(),
    doctorName: String(profile?.name ?? '').trim(),
    practitionerRegistrationNumber,
    needsDoctorApproval:
      item.needsDoctorApproval === true || item.needs_doctor_approval === true,
    doctorApproved: item.doctorApproved === true || item.doctor_approved === true,
    serviceStart: String(item.serviceStart ?? item.service_start ?? '').trim(),
    raw: item,
  };
}

export async function resendPreauthDoctorConsent(params: {
  practitionerRegistrationNumber: string;
  consentToken: string;
  interventionCode: string;
  locationUuid: string;
}) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pre-auth/doctor-consent`;
  const body = {
    practitioner_registration_number: params.practitionerRegistrationNumber,
    request_type: 'PREAUTH_DOCTOR_APPROVAL_REQUEST' as const,
    consent_token: params.consentToken,
    intervention_code: params.interventionCode,
    locationUuid: params.locationUuid,
  };
  try {
    const result = await openmrsFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return result?.data;
  } catch (error: any) {
    const message =
      error?.responseBody?.message ?? error?.message ?? 'Failed to resend doctor consent';
    if (typeof message === 'object') {
      throw `${(message as string[])?.join?.(',') ?? JSON.stringify(message)}`;
    }
    throw message;
  }
}

/**
 * Load all preauth preview rows for a set of claim-visit consent tokens.
 * Tokens without a preauth (404 / empty) are skipped.
 */
export async function fetchPreauthPreviewRowsForTokens(
  consentTokens: string[],
  locationUuid: string,
): Promise<PreauthPreviewRow[]> {
  const unique = [...new Set(consentTokens.map((t) => t.trim()).filter(Boolean))];
  const rows: PreauthPreviewRow[] = [];

  const CONCURRENCY = 4;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const chunk = unique.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      chunk.map(async (token) => {
        try {
          const preview = await getPreauthPreview(token, locationUuid);
          return unwrapPreauthPreviewItems(preview).map((item) =>
            normalizePreauthPreviewItem(item, token),
          );
        } catch {
          return [] as PreauthPreviewRow[];
        }
      }),
    );
    for (const batch of settled) {
      rows.push(...batch);
    }
  }

  return rows;
}

const PREAUTH_TERMINAL_FAILURE = new Set(['REJECTED', 'CANCELLED', 'FAILED', 'DECLINED']);

const PREAUTH_SUBMITTED = new Set([
  'ACTIVE',
  'PENDING_DOCTOR_APPROVAL',
  'FINALISED',
  'FINALIZED',
]);

function interventionCodeFromPreviewItem(item: Record<string, unknown>): string {
  const interventionData = (item.interventionData ?? item.intervention_data ?? {}) as Record<
    string,
    unknown
  >;
  return String(
    item.interventionCode ?? item.intervention_code ?? interventionData.code ?? '',
  ).trim();
}

function statusFromPreviewItem(item: Record<string, unknown>): string {
  const auth = item.authorizationDetails as Record<string, unknown> | undefined;
  // Prefer the row's own status — overallPreauthFinalised is visit-wide and misleading
  // when matching a single intervention.
  const status = String(item.status ?? item.preauth_status ?? '').toUpperCase();
  const doctorReview = String(item.doctorReviewStatus ?? item.doctor_review_status ?? '').toUpperCase();

  if (
    doctorReview &&
    PREAUTH_TERMINAL_FAILURE.has(doctorReview) &&
    status !== 'FINALISED' &&
    status !== 'FINALIZED'
  ) {
    return doctorReview;
  }

  if (!status && (auth?.overallPreauthFinalised === true || auth?.overall_preauth_finalised === true)) {
    return 'FINALISED';
  }

  return status;
}

/** Find the preview row for a specific intervention code (paginated `results[]`). */
export function findPreauthPreviewForIntervention(
  preview: unknown,
  interventionCode: string,
): Record<string, unknown> | null {
  const code = (interventionCode ?? '').trim();
  if (!code) return null;
  const items = unwrapPreauthPreviewItems(preview);
  return items.find((item) => interventionCodeFromPreviewItem(item) === code) ?? null;
}

export function extractPreauthStatusForIntervention(preview: unknown, interventionCode: string): string {
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return '';
  return statusFromPreviewItem(item);
}

export function extractPreauthCodeForIntervention(
  preview: unknown,
  interventionCode: string,
): string | undefined {
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return undefined;
  return extractPreauthCode(item);
}

/**
 * True when preview already has a non-failed preauth for this intervention —
 * Raise should be hidden (re-raise allowed after terminal failure).
 */
export function interventionHasBlockingPreauth(preview: unknown, interventionCode: string): boolean {
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return false;
  const status = statusFromPreviewItem(item);
  if (!status) return true; // row exists but status blank — treat as already raised
  return !isPreauthTerminalFailure(status);
}

export function extractPreauthStatus(preview: unknown): string {
  const item = unwrapPreauthPreviewItem(preview);
  if (!item) {
    return '';
  }

  const auth = item.authorizationDetails as Record<string, unknown> | undefined;
  if (auth?.overallPreauthFinalised === true || auth?.overall_preauth_finalised === true) {
    return 'FINALISED';
  }

  return statusFromPreviewItem(item);
}

export function extractPreauthCode(preview: unknown): string | undefined {
  const item = unwrapPreauthPreviewItem(preview);
  if (!item) {
    return undefined;
  }
  const auth = item.authorizationDetails as Record<string, unknown> | undefined;
  const fromAuth =
    (auth?.authCode as string) ||
    (auth?.auth_code as string) ||
    (auth?.token as string) ||
    undefined;

  return (
    (item.preauth_code as string) ||
    (item.preauthCode as string) ||
    (item.token as string) ||
    fromAuth ||
    (item.authCode as string) ||
    (item.id != null ? String(item.id) : undefined) ||
    (item.preauth_id != null ? String(item.preauth_id) : undefined)
  );
}

export function isPreauthFinalised(status: string): boolean {
  const s = (status || '').toUpperCase();
  return s === 'FINALISED' || s === 'FINALIZED';
}

export function isPreauthTerminalFailure(status: string): boolean {
  return PREAUTH_TERMINAL_FAILURE.has((status || '').toUpperCase());
}

/** Statuses that mean the preauth was accepted by HIE — form can close. */
export function isPreauthSubmitted(status: string): boolean {
  return PREAUTH_SUBMITTED.has((status || '').toUpperCase());
}

export type PreauthCheckKind = 'not_raised' | 'finalised' | 'pending' | 'failed' | 'error';

export type PreauthCheckResult = {
  status: string;
  preauthCode?: string;
  preview: unknown;
  kind: PreauthCheckKind;
  error?: string;
};

/** One-shot preauth status check for lists, gates, and non-React callers. */
export async function checkPreauthStatus(
  consentToken: string | null | undefined,
  locationUuid: string | null | undefined,
): Promise<PreauthCheckResult> {
  if (!consentToken?.trim()) {
    return {
      status: '',
      preview: null,
      kind: 'error',
      error: 'Missing consent token',
    };
  }
  if (!locationUuid?.trim()) {
    return {
      status: '',
      preview: null,
      kind: 'error',
      error: 'Missing location',
    };
  }

  try {
    const preview = await getPreauthPreview(consentToken.trim(), locationUuid.trim());
    const item = unwrapPreauthPreviewItem(preview);
    // Paginated empty results / null body → not raised
    if (!preview || !item) {
      return { status: '', preview, kind: 'not_raised' };
    }

    const status = extractPreauthStatus(preview);
    const preauthCode = extractPreauthCode(preview);

    if (!status) {
      return { status: '', preview, kind: 'not_raised', preauthCode };
    }
    if (isPreauthFinalised(status)) {
      return { status: 'FINALISED', preview, kind: 'finalised', preauthCode };
    }
    if (isPreauthTerminalFailure(status)) {
      return { status, preview, kind: 'failed', preauthCode };
    }
    return { status, preview, kind: 'pending', preauthCode };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e ?? 'Failed to get preauth preview');
    return {
      status: '',
      preview: null,
      kind: 'error',
      error: message,
    };
  }
}

export const preauthPreviewSwrKey = (consentToken: string, locationUuid: string) =>
  ['preauth-preview', consentToken, locationUuid] as const;

/** SWR hook for reusable preauth status elsewhere in the app. */
export function usePreauthPreview(consentToken: string | null | undefined, locationUuid: string | null | undefined) {
  const key =
    consentToken?.trim() && locationUuid?.trim()
      ? preauthPreviewSwrKey(consentToken.trim(), locationUuid.trim())
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, ([, token, loc]) =>
    checkPreauthStatus(token, loc),
  );

  return {
    preview: data?.preview ?? null,
    status: data?.status ?? '',
    preauthCode: data?.preauthCode,
    kind: data?.kind,
    check: data,
    error: error ?? (data?.kind === 'error' ? data.error : undefined),
    isLoading,
    isValidating,
    mutate,
  };
}

export async function invalidatePreauthPreview(consentToken: string, locationUuid: string) {
  if (!consentToken?.trim() || !locationUuid?.trim()) return;
  await globalMutate(preauthPreviewSwrKey(consentToken.trim(), locationUuid.trim()));
}

/** Poll GET /pre-auth/preview until FINALISED or a terminal failure. */
export async function pollPreauthUntilFinalised(
  consentToken: string,
  locationUuid: string,
  {
    intervalMs = 3000,
    maxAttempts = 40,
    signal,
  }: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal } = {},
): Promise<{ status: string; preview: unknown; preauthCode?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Preauth poll cancelled');
    }
    const preview = await getPreauthPreview(consentToken, locationUuid);
    const status = extractPreauthStatus(preview);
    if (isPreauthFinalised(status)) {
      return { status: 'FINALISED', preview, preauthCode: extractPreauthCode(preview) };
    }
    if (status && isPreauthTerminalFailure(status)) {
      throw new Error(`Preauth ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for preauth to reach FINALISED');
}

/**
 * Poll until the matching intervention's preauth is ACTIVE, PENDING_DOCTOR_APPROVAL,
 * or FINALISED — enough to close the Raise form without waiting on payer finalisation.
 */
export async function pollPreauthUntilSubmitted(
  consentToken: string,
  locationUuid: string,
  interventionCode: string,
  {
    intervalMs = 3000,
    maxAttempts = 40,
    signal,
  }: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal } = {},
): Promise<{ status: string; preview: unknown; preauthCode?: string }> {
  const code = (interventionCode ?? '').trim();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Preauth poll cancelled');
    }
    const preview = await getPreauthPreview(consentToken, locationUuid);
    const status = code
      ? extractPreauthStatusForIntervention(preview, code)
      : extractPreauthStatus(preview);
    if (status && isPreauthSubmitted(status)) {
      return {
        status: isPreauthFinalised(status) ? 'FINALISED' : status,
        preview,
        preauthCode: code
          ? extractPreauthCodeForIntervention(preview, code)
          : extractPreauthCode(preview),
      };
    }
    if (status && isPreauthTerminalFailure(status)) {
      throw new Error(`Preauth ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for preauth submission confirmation');
}

export const getServiceType = (selectedIntervention: Intervention, visitType?: VisitType): ServiceType => {
  const paymentMechanism = selectedIntervention.paymentMechanism;
  const accessPoint = selectedIntervention.accessPoint;

  if (paymentMechanism.trim().toUpperCase() === 'CAPITATION') {
    return 'CAPITATION';
  }
  if (paymentMechanism.trim().toUpperCase() === 'PER_DIEM') {
    return 'PER_DIEM';
  }
  if (accessPoint.trim().toUpperCase() === 'IP') {
    return 'INPATIENT';
  }
  if (accessPoint.trim().toUpperCase() === 'OP') {
    return 'OUTPATIENT';
  }
  if (paymentMechanism.trim().toUpperCase() === 'CASE BASED') {
    return 'INPATIENT';
  }
  if (accessPoint.trim().toUpperCase() === 'OP AND IP') {
    return visitType;
  }
  return visitType;
};

export const fetchConsentToken = async () => {
  return '';
};
