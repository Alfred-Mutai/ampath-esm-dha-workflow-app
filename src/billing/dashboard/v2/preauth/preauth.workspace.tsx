import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  ButtonSet,
  Checkbox,
  ComboBox,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Form,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Tag,
  TextArea,
  TextInput,
} from '@carbon/react';
import { showSnackbar, useSession, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  createPreauth,
  fetchShaInterventionByCode,
  pollPreauthUntilSubmitted,
  preauthAttachmentFieldName,
  type PreauthFormPayload,
} from '../../../../claims/claims.resource';
import { cancelAllPendingAuthorizations, sendClaimsOTP, authorizeClaimsWithOtp } from '../../../../registry/hie.resource';
import { addClaimDiagnosis, fetchPatientDiagnosesForBilling } from '../../../billing-claims.resource';
import { ensureInterventionOnVisit } from '../../../../claims/interventions.resource';
import { type AmrsVisitDiagnosis } from '../../../types';
import { type PatientFacilityBillDetails } from '../types';
import PreauthAttachments, { type PreauthAttachmentRow } from './preauth-attachments.component';
import {
  billingDateToVisitDate,
  dateToServiceIso,
  fetchPreauthFormValues,
  mergeSpecialtyFlags,
  preauthFormLabel,
  readSpecialtyFlags,
  resolveUnitPriceFromPatientBills,
  searchDiagnosisConcepts,
  searchHealthWorkerRegistry,
  searchOpenMrsProviders,
  storePreauthCode,
  type DiagnosisConceptHit,
  type HwrSearchResult,
  type OpenMrsProviderHit,
  type PreauthFormFieldKey,
  type PreauthInterventionProps,
} from './preauth.resource';
import styles from './preauth.workspace.scss';

export type { PreauthInterventionProps };

/** ComboBox row: visit diagnosis (ETL) or concept-dictionary hit. */
type DiagnosisPick =
  | { kind: 'visit'; key: string; dx: AmrsVisitDiagnosis }
  | { kind: 'concept'; key: string; hit: DiagnosisConceptHit };

const visitDxPick = (dx: AmrsVisitDiagnosis): DiagnosisPick => ({
  kind: 'visit',
  key: `visit-${dx.encounter_id}-${dx.icd11_code}-${dx.diagnosis_coded ?? dx.value_coded ?? ''}`,
  dx,
});

const conceptDxPick = (hit: DiagnosisConceptHit): DiagnosisPick => ({
  kind: 'concept',
  key: `concept-${hit.uuid}-${hit.icd11Code}`,
  hit,
});

const diagnosisPickLabel = (item: DiagnosisPick | null) => {
  if (!item) return '';
  if (item.kind === 'visit') {
    const d = item.dx;
    return `${d.icd11_code ?? '—'} · ${d.concept_source_name || d.encounter_type || 'Visit diagnosis'}`;
  }
  return `${item.hit.icd11Code} · ${item.hit.display}`;
};

const diagnosisPickCode = (item: DiagnosisPick | null) => {
  if (!item) return '';
  return item.kind === 'visit' ? item.dx.icd11_code ?? '' : item.hit.icd11Code;
};

const DEFAULT_DOCTOR_ID_TYPE = 'National ID' as const;

type FormFieldLoadStatus = 'idle' | 'loading' | 'from_form' | 'missing';

const FORM_MISSING_HINT =
  'Missing on the Pre-authorization form. Complete the form on the patient chart, then reopen Raise preauth.';

const SURGICAL_FORM_KEYS: PreauthFormFieldKey[] = [
  'chiefComplaint',
  'hpi',
  'physicalExam',
  'investigations',
  'anaesthesia',
  'surgeryDate',
  'relatedToEmployment',
  'relatedToAccident',
  'isCoInsured',
  'coInsuranceDetails',
];

const RENAL_FORM_KEYS: PreauthFormFieldKey[] = [
  'clinicalIndications',
  'startDate',
  'sessionsRequired',
  'frequency',
  'isCoInsured',
  'coInsuranceDetails',
];

interface PreauthWorkspaceProps extends DefaultWorkspaceProps {
  consentToken: string;
  patientUuid?: string;
  locationUuid: string;
  /** Elective (pre-visit) mode — uses authorize token + expected_service_start_date */
  isElective?: boolean;
  billItem: Partial<PatientFacilityBillDetails> & {
    intervention_code: string;
    patient_uuid?: string;
    cr_no?: string;
    service_type?: string;
  };
  intervention: PreauthInterventionProps;
  onSuccess?: (result: { consentToken: string; preauthCode?: string; status: string }) => void;
}

const ANAESTHESIA = ['GENERAL', 'LOCAL', 'SPINAL', 'SEDATION'];
const FREQUENCY = ['TWICE_A_WEEK', 'ONCE_A_WEEK', 'ONCE_EVERY_2_WEEKS', 'ONCE_EVERY_3_WEEKS', 'ONCE_A_MONTH'];
const STAGING = ['STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4'];
const METASTASES = ['LUNG', 'BRAIN', 'LIVER', 'OTHER'];
const TREATMENT = ['DAY_WARD', 'RECLINING_CHAIR', 'SIDE_ROOM'];
const LENS = ['FRAMES_LENSES', 'FRAMED', 'CONTACT'];
const NEW_OR_REPL = ['NEW', 'REPLACEMENT'];

const DOC_TYPE_OPTIONS = [
  'LAB_TESTS',
  'LAB_RESULTS',
  'DISCHARGE_SUMMARY',
  'INVOICE',
  'FINAL_BILL',
  'CLINICAL_DOCUMENTATION',
  'MEDICAL_REPORT',
  'IMAGING_RESULT',
  'RADIOLOGICAL_EXAM',
  'STAGING_RESULTS',
  'TREATMENT_PLAN',
  'THEATRE_LIST',
  'DIALYSIS_CHART',
  'PREAUTH_FORM',
  'OTHER',
];

const toIsoLocal = (d: Date = new Date()) => dayjs(d).format('YYYY-MM-DDTHH:mm:ssZ');

/** HIE regulation bodies (abbreviated): COC = Clinical Officers Council, NCK = Nursing Council of Kenya */
const REGULATION_BODIES = ['KMPDC', 'COC', 'NCK'] as const;
type RegulationBody = (typeof REGULATION_BODIES)[number];

const normalizeRegulationBody = (value?: string | null): RegulationBody => {
  if (!value) return 'KMPDC';
  const raw = value.trim();
  const exact = REGULATION_BODIES.find((b) => b.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const upper = raw.toUpperCase();
  if (upper.includes('KMPDC') || upper.includes('MEDICAL PRACTITIONER') || upper.includes('DOCTOR')) {
    return 'KMPDC';
  }
  if (
    upper.includes('CLINICAL OFFICER') ||
    upper === 'COC' ||
    upper.includes('CLINICAL OFFICERS COUNCIL')
  ) {
    return 'COC';
  }
  if (upper.includes('NURS') || upper === 'NCK' || upper.includes('NURSING COUNCIL')) {
    return 'NCK';
  }
  return 'KMPDC';
};

const PreauthForm: React.FC<PreauthWorkspaceProps> = ({
  closeWorkspace,
  promptBeforeClosing,
  consentToken: consentTokenProp,
  patientUuid,
  locationUuid,
  isElective = false,
  billItem,
  intervention,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [consentMethod, setConsentMethod] = useState<'biometric' | 'otp'>('otp');
  const [consentDone, setConsentDone] = useState(Boolean(consentTokenProp) && !isElective);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [activeConsentToken, setActiveConsentToken] = useState(consentTokenProp || '');
  const [expectedServiceStartDate, setExpectedServiceStartDate] = useState(toIsoLocal());
  const abortRef = useRef<AbortController | null>(null);

  // Specialty from launch props + bill item; SHA coverage may enrich after mount
  // (visit/claim payloads often omit requires_*_preauth even for oncology codes).
  const [specialty, setSpecialty] = useState(() =>
    mergeSpecialtyFlags(readSpecialtyFlags(intervention), readSpecialtyFlags(billItem)),
  );
  const specialtyLabel = preauthFormLabel(specialty);
  const interventionForSubmit = useMemo(
    () => ({
      ...intervention,
      ...specialty,
    }),
    [intervention, specialty],
  );

  const [serviceStart, setServiceStart] = useState(toIsoLocal());
  const [serviceEnd, setServiceEnd] = useState(toIsoLocal(dayjs().add(30, 'minute').toDate()));
  const [providerEmail, setProviderEmail] = useState(session?.user?.username?.includes('@') ? session.user.username : '');
  const [unitPrice, setUnitPrice] = useState(() =>
    String(billItem.item_price ?? billItem.item_total_price ?? '').trim(),
  );

  // Diagnosis: prefill from ETL encounter-diagnosis; search uses concept dictionary (ICD-11).
  const [visitDiagnoses, setVisitDiagnoses] = useState<AmrsVisitDiagnosis[]>([]);
  const [conceptDxHits, setConceptDxHits] = useState<DiagnosisConceptHit[]>([]);
  const [loadingDx, setLoadingDx] = useState(false);
  const [searchingDx, setSearchingDx] = useState(false);
  const [selectedDx, setSelectedDx] = useState<DiagnosisPick | null>(null);
  const [icdCode, setIcdCode] = useState('');
  const dxSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Provider — National ID for doctor; HWR for regulation body
  const [providerHits, setProviderHits] = useState<OpenMrsProviderHit[]>([]);
  const [searchingProviders, setSearchingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<OpenMrsProviderHit | null>(null);
  const providerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchingHwr, setSearchingHwr] = useState(false);
  const [hwrHit, setHwrHit] = useState<HwrSearchResult | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [regulationBody, setRegulationBody] = useState<RegulationBody>('KMPDC');

  // Specialty fields — empty until Pre-authorization form obs (or bill unit price) loads.
  const [clinicalIndications, setClinicalIndications] = useState('');
  const [formLoadState, setFormLoadState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [formFound, setFormFound] = useState<Set<PreauthFormFieldKey>>(() => new Set());
  const [formRelevant, setFormRelevant] = useState<Set<PreauthFormFieldKey>>(() => new Set());
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [vitalSigns, setVitalSigns] = useState('');
  const [hpi, setHpi] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [anaesthesia, setAnaesthesia] = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [sessionsRequired, setSessionsRequired] = useState('');
  const [costPerSession, setCostPerSession] = useState('');
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isCoInsured, setIsCoInsured] = useState(false);
  const [necessity, setNecessity] = useState('');
  const [lensPrescription, setLensPrescription] = useState('');
  const [lensAmount, setLensAmount] = useState('');
  const [eyeExamAmount, setEyeExamAmount] = useState('');
  const [frameAmount, setFrameAmount] = useState('');
  const [newOrReplacement, setNewOrReplacement] = useState('');
  const [carcinomaStaging, setCarcinomaStaging] = useState('');
  const [comorbidity, setComorbidity] = useState('');
  const [metastases, setMetastases] = useState('');
  const [treatmentSetting, setTreatmentSetting] = useState('');
  const [progressReport, setProgressReport] = useState('');
  const [relatedToEmployment, setRelatedToEmployment] = useState(false);
  const [relatedToAccident, setRelatedToAccident] = useState(false);
  const [coInsuranceDetails, setCoInsuranceDetails] = useState('');

  const formFieldStatus = (key: PreauthFormFieldKey): FormFieldLoadStatus => {
    if (formLoadState === 'idle') return 'idle';
    if (formLoadState === 'loading') return 'loading';
    if (!formRelevant.has(key)) return 'idle';
    return formFound.has(key) ? 'from_form' : 'missing';
  };

  const formFieldLocked = (key: PreauthFormFieldKey) => {
    const s = formFieldStatus(key);
    return s === 'from_form' || s === 'missing' || s === 'loading';
  };

  const formFieldInvalid = (key: PreauthFormFieldKey) => formFieldStatus(key) === 'missing';

  const patientName = billItem.patient_name ?? '';
  const crNo = billItem.cr_no ?? '';
  const billableService = billItem.billable_service ?? intervention.name ?? intervention.code;
  const requiredDocs = useMemo(
    () => [...new Set(intervention.requiredPreauthDocumentTypes ?? [])],
    [intervention.requiredPreauthDocumentTypes],
  );
  const optionalDocs = useMemo(() => {
    const required = new Set(requiredDocs);
    return [...new Set(intervention.applicableDocumentTypes ?? [])].filter((d) => !required.has(d));
  }, [intervention.applicableDocumentTypes, requiredDocs]);

  const [attachments, setAttachments] = useState<PreauthAttachmentRow[]>(() => {
    const required = requiredDocs.map((document_type) => ({
      id: crypto.randomUUID(),
      document_type,
      document_title: document_type.replace(/_/g, ' '),
      required: true,
    }));
    if (required.length === 0) {
      return [
        {
          id: crypto.randomUUID(),
          document_type: 'LAB_TESTS',
          document_title: 'Lab Results',
          required: false,
        },
      ];
    }
    return required;
  });

  useEffect(() => {
    // Normal preauth requires an existing claim token. Elective obtains one via authorize.
    if (!isElective && !consentTokenProp) {
      showSnackbar({
        kind: 'error',
        title: t('missingConsentToken', 'Missing claim token'),
        subtitle: t('missingConsentTokenDetail', 'A preexisting visit claim token is required to raise preauth.'),
      });
      closeWorkspace?.();
    }
  }, [consentTokenProp, isElective, closeWorkspace, t]);

  const consentToken = activeConsentToken;

  // Enrich specialty flags from SHA interventions coverage when launch props lack them.
  useEffect(() => {
    const patientId = (billItem.cr_no ?? '').trim();
    const code = (intervention.code || billItem.intervention_code || '').trim();
    if (!patientId || !locationUuid || !code) return;

    let cancelled = false;
    (async () => {
      try {
        const sha = await fetchShaInterventionByCode(patientId, locationUuid, code);
        if (cancelled || !sha) return;
        const fromSha = readSpecialtyFlags(sha);
        setSpecialty((prev) => {
          const next = mergeSpecialtyFlags(prev, fromSha);
          if (
            next.requiresSurgicalPreauth === prev.requiresSurgicalPreauth &&
            next.requiresRenalPreauth === prev.requiresRenalPreauth &&
            next.requiresOncologyPreauth === prev.requiresOncologyPreauth &&
            next.requiresRadiologyPreauth === prev.requiresRadiologyPreauth &&
            next.requiresOpticalPreauth === prev.requiresOpticalPreauth
          ) {
            return prev;
          }
          return next;
        });
        // Do not seed specialty field defaults — obs / bill loaders fill real values.
      } catch {
        // Keep launch-prop flags if coverage lookup fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [billItem.cr_no, billItem.intervention_code, intervention.code, locationUuid]);

  useEffect(() => {
    promptBeforeClosing?.(() => dirty || submitting || polling);
  }, [dirty, submitting, polling, promptBeforeClosing]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (providerSearchTimer.current) clearTimeout(providerSearchTimer.current);
    if (dxSearchTimer.current) clearTimeout(dxSearchTimer.current);
  }, []);

  const markDirty = () => setDirty(true);

  const applyDiagnosisPick = (pick: DiagnosisPick | null, opts?: { fromUser?: boolean }) => {
    // Prefill from visit load must not trip "unsaved changes" on close.
    if (opts?.fromUser !== false) {
      markDirty();
    }
    setSelectedDx(pick);
    const code = diagnosisPickCode(pick);
    if (code) {
      setIcdCode(code);
    }
    if (pick?.kind === 'visit') {
      const dx = pick.dx;
      if (dx.practioner_nat_id) {
        setDoctorId(dx.practioner_nat_id);
      }
      if (dx.practitioner_body) {
        setRegulationBody(normalizeRegulationBody(dx.practitioner_body));
      }
    }
  };

  // Prefill from visit + maternity + encounter diagnoses (same three ETL sources as bill details).
  useEffect(() => {
    const uuid = patientUuid || billItem.patient_uuid;
    if (!uuid || !locationUuid) return;
    let cancelled = false;
    const run = async () => {
      setLoadingDx(true);
      try {
        const visitDate = billingDateToVisitDate(billItem.bill_date);
        const billingDate = visitDate;
        const results = await fetchPatientDiagnosesForBilling({
          visitDate,
          billingDate,
          patientUuid: uuid,
          locationUuid,
        });
        if (!cancelled) {
          setVisitDiagnoses(results ?? []);
          const withIcd = (results ?? []).filter((d) => d.icd11_code);
          if (withIcd.length === 1) {
            applyDiagnosisPick(visitDxPick(withIcd[0]), { fromUser: false });
          }
        }
      } catch {
        if (!cancelled) {
          showSnackbar({
            kind: 'warning',
            title: 'Could not load diagnoses',
            subtitle: 'Search the concept dictionary, or retry after the visit has ICD-11 coded diagnoses.',
          });
        }
      } finally {
        if (!cancelled) setLoadingDx(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUuid, billItem.patient_uuid, billItem.bill_date, locationUuid]);

  const diagnosisItems = useMemo((): DiagnosisPick[] => {
    const base =
      conceptDxHits.length > 0
        ? conceptDxHits.map(conceptDxPick)
        : visitDiagnoses.filter((d) => d.icd11_code).map(visitDxPick);
    if (!selectedDx) return base;
    if (!base.some((i) => i.key === selectedDx.key)) {
      return [selectedDx, ...base];
    }
    return base.map((i) => (i.key === selectedDx.key ? selectedDx : i));
  }, [conceptDxHits, visitDiagnoses, selectedDx]);

  const handleDiagnosisInputChange = (inputValue: string) => {
    const selectedLabel = diagnosisPickLabel(selectedDx);
    if (inputValue === selectedLabel) {
      return;
    }
    if (selectedDx) {
      setSelectedDx(null);
    }
    if (dxSearchTimer.current) {
      clearTimeout(dxSearchTimer.current);
    }
    const q = (inputValue ?? '').trim();
    if (q.length < 2) {
      setConceptDxHits([]);
      setSearchingDx(false);
      return;
    }
    dxSearchTimer.current = setTimeout(async () => {
      setSearchingDx(true);
      try {
        const hits = await searchDiagnosisConcepts(q);
        setConceptDxHits(hits);
      } catch {
        setConceptDxHits([]);
      } finally {
        setSearchingDx(false);
      }
    }, 300);
  };
  // Resolve unit_price from patient facility bill lines (match intervention + service name).
  useEffect(() => {
    const uuid = patientUuid || billItem.patient_uuid;
    const code = (intervention.code || billItem.intervention_code || '').trim();
    if (!uuid || !locationUuid || !code) return;

    let cancelled = false;
    (async () => {
      const { unitPrice: fromBills, billLine } = await resolveUnitPriceFromPatientBills({
        patientUuid: uuid,
        locationUuid,
        billingDate: billItem.bill_date,
        interventionCode: code,
        serviceHint: billItem.billable_service || intervention.name || code,
      });
      if (cancelled || !fromBills) return;
      setUnitPrice(fromBills);
      setCostPerSession((prev) => (prev.trim() ? prev : fromBills));
      // Prefer matched billable_service label when launch used intervention name only
      if (billLine?.billable_service && !(billItem.billable_service || '').trim()) {
        // billItem is a prop — display uses billableService derived from it; unit price is enough
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    patientUuid,
    billItem.patient_uuid,
    billItem.bill_date,
    billItem.intervention_code,
    billItem.billable_service,
    intervention.code,
    intervention.name,
    locationUuid,
    specialty.requiresRenalPreauth,
  ]);

  // Prefill specialty fields from POC Pre-authorization form (encounter, else latest obs).
  useEffect(() => {
    const needsForm =
      specialty.requiresSurgicalPreauth ||
      specialty.requiresRenalPreauth ||
      specialty.requiresRadiologyPreauth ||
      specialty.requiresOpticalPreauth;
    const uuid = patientUuid || billItem.patient_uuid;
    if (!needsForm || !uuid) {
      setFormLoadState('idle');
      setFormFound(new Set());
      setFormRelevant(new Set());
      return;
    }

    let cancelled = false;
    setFormLoadState('loading');
    (async () => {
      const values = await fetchPreauthFormValues(uuid);
      if (cancelled) return;

      // Apply every mapped value found on the form — do not gate on specialty flags here.
      // Specialty only controls which keys are required / shown as missing below.
      // (Gating on flags raced with SHA enrichment and skipped renal fields.)
      if (values.found.has('clinicalIndications')) {
        setClinicalIndications(values.clinicalIndications);
      }
      if (values.found.has('startDate')) setStartDate(values.startDate);
      if (values.found.has('sessionsRequired')) setSessionsRequired(values.sessionsRequired);
      if (values.found.has('frequency')) setFrequency(values.frequency);
      if (values.found.has('chiefComplaint')) setChiefComplaint(values.chiefComplaint);
      if (values.found.has('hpi')) setHpi(values.hpi);
      if (values.found.has('physicalExam')) setPhysicalExam(values.physicalExam);
      if (values.found.has('investigations')) setInvestigations(values.investigations);
      if (values.found.has('anaesthesia')) setAnaesthesia(values.anaesthesia);
      if (values.found.has('surgeryDate')) setSurgeryDate(values.surgeryDate);
      if (values.found.has('relatedToEmployment') && values.relatedToEmployment !== null) {
        setRelatedToEmployment(values.relatedToEmployment);
      }
      if (values.found.has('relatedToAccident') && values.relatedToAccident !== null) {
        setRelatedToAccident(values.relatedToAccident);
      }
      if (values.found.has('isCoInsured') && values.isCoInsured !== null) {
        setIsCoInsured(values.isCoInsured);
      }
      if (values.found.has('coInsuranceDetails')) {
        setCoInsuranceDetails(values.coInsuranceDetails);
      }

      // Always prefer bill line price resolved from facility patient bills (see resolve effect).
      // Do not overwrite with launch billItem.item_price (often keph tariff / wrong line).

      const relevant = new Set<PreauthFormFieldKey>();
      if (
        specialty.requiresRadiologyPreauth ||
        specialty.requiresOpticalPreauth ||
        specialty.requiresRenalPreauth
      ) {
        relevant.add('clinicalIndications');
      }
      if (specialty.requiresRenalPreauth) {
        RENAL_FORM_KEYS.forEach((k) => relevant.add(k));
      }
      if (specialty.requiresSurgicalPreauth) {
        SURGICAL_FORM_KEYS.forEach((k) => relevant.add(k));
      }
      // coInsuranceDetails only required when patient is co-insured
      if (values.isCoInsured !== true) {
        relevant.delete('coInsuranceDetails');
      }

      setFormRelevant(relevant);
      setFormFound(new Set([...relevant].filter((k) => values.found.has(k))));
      setFormLoadState('done');
    })();

    return () => {
      cancelled = true;
    };
  }, [
    patientUuid,
    billItem.patient_uuid,
    specialty.requiresSurgicalPreauth,
    specialty.requiresRenalPreauth,
    specialty.requiresRadiologyPreauth,
    specialty.requiresOpticalPreauth,
  ]);

  const clinicalIndicationsFieldProps = {
    labelText: 'Clinical indications',
    value: formFieldStatus('clinicalIndications') === 'loading' ? '' : clinicalIndications,
    readOnly: formFieldLocked('clinicalIndications'),
    placeholder: formFieldStatus('clinicalIndications') === 'loading' ? 'Loading clinical notes…' : undefined,
    invalid: formFieldInvalid('clinicalIndications'),
    invalidText: formFieldInvalid('clinicalIndications') ? FORM_MISSING_HINT : undefined,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (formFieldLocked('clinicalIndications')) return;
      markDirty();
      setClinicalIndications(e.target.value);
    },
  };

  const providerItemLabel = (item: OpenMrsProviderHit | null) =>
    item ? (item.nationalId ? `${item.display} · ${item.nationalId}` : item.display) : '';

  const applyProviderSelection = (hit: OpenMrsProviderHit | null) => {
    setSelectedProvider(hit);
    if (!hit) return;
    markDirty();
    if (hit.nationalId) {
      setDoctorId(hit.nationalId);
      void handleSearchHwr(hit.nationalId);
    } else {
      setDoctorId('');
      setHwrHit(null);
      showSnackbar({
        kind: 'warning',
        title: 'No National ID on provider',
        subtitle: 'Enter the doctor National ID, then Search HWR for the regulation body.',
      });
    }
  };

  const handleSearchHwr = async (idOverride?: string) => {
    const idValue = (idOverride ?? doctorId).trim();
    if (!idValue) {
      showSnackbar({
        kind: 'error',
        title: 'Enter National ID',
        subtitle: 'Doctor National ID is required to look up the regulation body in HWR.',
      });
      return;
    }
    setSearchingHwr(true);
    try {
      const results = await searchHealthWorkerRegistry({
        identifierType: DEFAULT_DOCTOR_ID_TYPE,
        identifierValue: idValue,
        locationUuid,
      });
      const hit = results[0];
      if (!hit) {
        setHwrHit(null);
        showSnackbar({ kind: 'warning', title: 'No health worker found' });
        return;
      }
      setHwrHit(hit);
      // Keep doctor ID as National ID; only take regulation body (and email) from HWR
      const body = normalizeRegulationBody(hit.membership?.licensing_body);
      setRegulationBody(body);
      if (hit.contacts?.email) {
        setProviderEmail(hit.contacts.email);
      }
      markDirty();
      showSnackbar({
        kind: 'success',
        title: 'Regulation body from HWR',
        subtitle: `${hit.membership?.full_name || 'Match'} · ${body}`,
      });
    } catch (e: any) {
      showSnackbar({ kind: 'error', title: 'HWR search failed', subtitle: String(e?.message ?? e) });
    } finally {
      setSearchingHwr(false);
    }
  };

  const handleProviderInputChange = (inputValue: string) => {
    const selectedLabel = providerItemLabel(selectedProvider);
    if (inputValue === selectedLabel) {
      return;
    }
    if (selectedProvider) {
      setSelectedProvider(null);
    }
    if (providerSearchTimer.current) {
      clearTimeout(providerSearchTimer.current);
    }
    if (!inputValue || inputValue.trim().length < 2) {
      setProviderHits([]);
      setSearchingProviders(false);
      return;
    }
    providerSearchTimer.current = setTimeout(async () => {
      setSearchingProviders(true);
      try {
        const hits = await searchOpenMrsProviders(inputValue);
        setProviderHits(hits);
      } catch (e: any) {
        setProviderHits([]);
        showSnackbar({ kind: 'error', title: 'Provider search failed', subtitle: String(e?.message ?? e) });
      } finally {
        setSearchingProviders(false);
      }
    }, 300);
  };

  const requiredAttachmentsReady = useMemo(() => {
    return attachments.filter((a) => a.required).every((a) => Boolean(a.file));
  }, [attachments]);

  const handleSendOtp = async () => {
    if (!crNo) {
      showSnackbar({ kind: 'error', title: 'Missing CR number', subtitle: 'Cannot send OTP without patient CR id.' });
      return;
    }
    setSendingOtp(true);
    try {
      await cancelAllPendingAuthorizations(locationUuid, crNo);
      const response = await sendClaimsOTP(crNo, locationUuid, intervention.code);
      if (response?.message?.includes('OTP') || response) {
        setOtpSent(true);
        showSnackbar({ kind: 'success', title: 'OTP sent' });
      }
    } catch (e: any) {
      showSnackbar({ kind: 'error', title: 'Failed to send OTP', subtitle: String(e?.message ?? e) });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      showSnackbar({ kind: 'error', title: 'Enter OTP' });
      return;
    }
    if (isElective) {
      if (!crNo) {
        showSnackbar({ kind: 'error', title: 'Missing CR number', subtitle: 'Cannot authorize without patient CR id.' });
        return;
      }
      setSendingOtp(true);
      try {
        const auth = await authorizeClaimsWithOtp({
          patientId: crNo,
          otp: otp.trim(),
          interventions: [intervention.code],
          serviceType: (billItem.service_type as string) || 'OUTPATIENT',
          locationUuid,
        });
        const token = String(auth?.token ?? auth?.consent_token ?? '').trim();
        if (!token) {
          throw new Error('Authorize succeeded but no token was returned.');
        }
        setActiveConsentToken(token);
        setConsentDone(true);
        showSnackbar({ kind: 'success', title: 'Pre-visit authorization complete' });
      } catch (e: any) {
        showSnackbar({ kind: 'error', title: 'Authorize failed', subtitle: String(e?.message ?? e) });
      } finally {
        setSendingOtp(false);
      }
      return;
    }
    setConsentDone(true);
    showSnackbar({ kind: 'success', title: 'OTP verified' });
  };

  const handleConfirmBiometric = () => {
    if (isElective && !activeConsentToken) {
      showSnackbar({
        kind: 'info',
        title: 'Use OTP for elective',
        subtitle: 'Elective pre-visit authorize currently uses OTP. Biometrics authorize is available via the Claims widget.',
      });
      return;
    }
    setConsentDone(true);
    showSnackbar({ kind: 'success', title: 'Biometric consent recorded' });
  };

  const handleAttachmentsChange = (updater: (prev: PreauthAttachmentRow[]) => PreauthAttachmentRow[]) => {
    markDirty();
    setAttachments(updater);
  };

  const addableDocTypes = useMemo(() => {
    const attached = new Set(attachments.map((a) => a.document_type));
    const base = optionalDocs.length > 0 ? optionalDocs : DOC_TYPE_OPTIONS;
    return [...new Set(base)].filter((d) => !attached.has(d));
  }, [attachments, optionalDocs]);

  useEffect(
    () => () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const buildPayload = (): PreauthFormPayload => {
    // Contiguous indexes: attachments[i] → attachments_i_file_blob
    const withFiles = attachments.filter((a) => a.file);
    const files: Record<string, File> = {};
    const attachmentMeta = withFiles.map((a, index) => {
      const field = preauthAttachmentFieldName(index);
      files[field] = a.file!;
      return {
        document_title: a.document_title,
        document_type: a.document_type,
        file_field_name: field,
      };
    });

    const billUnitPrice = String(billItem.item_price ?? billItem.item_total_price ?? unitPrice ?? '').trim();
    const resolvedUnitPrice = billUnitPrice;

    const payload: PreauthFormPayload = {
      service_start: serviceStart,
      service_end: serviceEnd,
      items: [{ unit_price: resolvedUnitPrice || '0' }],
      diagnoses: [{ consent_token: consentToken, icd_code: icdCode.trim() }],
      doctors: [
        {
          identification_number: doctorId.trim(),
          identification_type: DEFAULT_DOCTOR_ID_TYPE,
          regulation_body: normalizeRegulationBody(regulationBody),
          intervention_code: intervention.code,
          is_primary: true,
        },
      ],
      attachments: attachmentMeta,
      provider_notification_email: providerEmail.trim(),
      locationUuid,
      files,
    };

    if (specialty.requiresSurgicalPreauth) {
      payload.chief_complaint = chiefComplaint.trim();
      payload.vital_signs = vitalSigns.trim();
      payload.history_of_present_illness = hpi.trim();
      payload.physical_examination = physicalExam.trim();
      payload.investigation_report_details = investigations.trim();
      payload.type_of_anaesthesia = anaesthesia;
      payload.surgery_date = surgeryDate;
      payload.is_condition_related_to_employment = relatedToEmployment;
      payload.is_condition_related_to_auto_or_other_accident = relatedToAccident;
      payload.is_co_insured = isCoInsured;
      if (isCoInsured && coInsuranceDetails.trim()) {
        payload.co_insurance_details = coInsuranceDetails.trim();
      }
    }

    if (specialty.requiresRenalPreauth) {
      const sessionsNum = Number(sessionsRequired);
      payload.number_of_sessions_required = Number.isFinite(sessionsNum) ? sessionsNum : sessionsRequired;
      payload.cost_per_session = String(costPerSession || billUnitPrice || '').trim();
      payload.frequency_of_sessions = frequency;
      payload.clinical_indications = clinicalIndications.trim();
      payload.start_date = startDate;
      payload.is_co_insured = isCoInsured;
      if (isCoInsured && coInsuranceDetails.trim()) {
        payload.co_insurance_details = coInsuranceDetails.trim();
      }
    }

    if (specialty.requiresOpticalPreauth) {
      payload.necessity_of_service = necessity.trim();
      payload.lens_prescription = lensPrescription;
      payload.lens_amount = lensAmount;
      payload.eye_examination_amount = eyeExamAmount;
      payload.frame_amount = frameAmount;
      payload.new_or_replacement = newOrReplacement;
      payload.clinical_indications = clinicalIndications.trim();
    }

    if (specialty.requiresOncologyPreauth) {
      payload.carcinoma_staging = carcinomaStaging;
      payload.comorbidity = comorbidity.trim();
      // Always arrays — HIE: "Expected a JSON list for metastases and treatment_setting"
      payload.metastases = [metastases];
      payload.treatment_setting = [treatmentSetting];
      {
        const sessionsNum = Number(sessionsRequired);
        payload.number_of_sessions_required = Number.isFinite(sessionsNum) ? sessionsNum : sessionsRequired;
      }
      payload.cost_per_session = costPerSession;
      payload.is_co_insured = isCoInsured;
      payload.start_date = startDate;
      if (progressReport.trim()) {
        payload.progress_report = progressReport.trim();
      }
    }

    if (specialty.requiresRadiologyPreauth) {
      payload.clinical_indications = clinicalIndications.trim();
    }

    if (isElective) {
      payload.expected_service_start_date = expectedServiceStartDate;
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (!consentToken) {
      showSnackbar({
        kind: 'error',
        title: 'Missing authorization',
        subtitle: isElective
          ? 'Complete pre-visit OTP authorize before submitting the elective preauth.'
          : 'A claim token is required.',
      });
      return;
    }
    if (!consentDone) {
      showSnackbar({ kind: 'error', title: 'Consent required', subtitle: 'Complete OTP or biometric consent first.' });
      return;
    }
    const billUnitPrice = String(billItem.item_price ?? billItem.item_total_price ?? unitPrice ?? '').trim();
    const resolvedUnitPrice = billUnitPrice;
    const needsClinicalIndications =
      specialty.requiresRadiologyPreauth ||
      specialty.requiresRenalPreauth ||
      specialty.requiresOpticalPreauth;
    const missingFormFields = [...formRelevant].filter((k) => !formFound.has(k));
    const missingRequired = [
      !icdCode.trim() && 'ICD-11 diagnosis',
      !doctorId.trim() && 'Doctor National ID',
      !providerEmail.trim() && 'Provider notification email',
      !resolvedUnitPrice && 'Unit price (from bill)',
      isElective && !expectedServiceStartDate && 'Expected service start date',
      needsClinicalIndications &&
        !clinicalIndications.trim() &&
        'Clinical indications (complete Pre-authorization form on the patient chart)',
      missingFormFields.length > 0 &&
        `Pre-authorization form fields (${missingFormFields.join(', ')})`,
    ].filter(Boolean);
    if (missingRequired.length) {
      showSnackbar({
        kind: 'error',
        title: 'Missing required fields',
        subtitle: `Fill: ${missingRequired.join(', ')}`,
      });
      return;
    }
    if (!requiredAttachmentsReady) {
      showSnackbar({
        kind: 'error',
        title: 'Attachments required',
        subtitle: 'Generate or add a file for every required document, then Submit preauth.',
      });
      return;
    }

    setSubmitting(true);
    abortRef.current = new AbortController();
    try {
      if (!isElective) {
        await ensureInterventionOnVisit(consentToken, intervention.code, locationUuid);
      }
      const payload = buildPayload();
      await createPreauth(
        payload,
        {
          code: interventionForSubmit.code,
          requiresRadiologyPreauth: interventionForSubmit.requiresRadiologyPreauth,
          requiresOncologyPreauth: interventionForSubmit.requiresOncologyPreauth,
          requiresOpticalPreauth: interventionForSubmit.requiresOpticalPreauth,
          requiresRenalPreauth: interventionForSubmit.requiresRenalPreauth,
          requiresSurgicalPreauth: interventionForSubmit.requiresSurgicalPreauth,
        },
        consentToken,
      );

      setPolling(true);
      const polled = await pollPreauthUntilSubmitted(
        consentToken,
        locationUuid,
        intervention.code,
        { signal: abortRef.current.signal },
      );
      const status = polled.status;
      const preauthCode = polled.preauthCode;

      if (preauthCode) {
        storePreauthCode(consentToken, intervention.code, preauthCode);
      }

      // Sync selected ICD onto the claim (normal / post-claim only).
      if (!isElective) {
        try {
          const visitDx = selectedDx?.kind === 'visit' ? selectedDx.dx : null;
          await addClaimDiagnosis({
            consentToken,
            interventionCode: intervention.code,
            icdCode: icdCode.trim(),
            locationUuid,
            practitionerIdentificationNumber: (visitDx?.practioner_nat_id || doctorId || '').trim(),
            practitionerIdentificationType: DEFAULT_DOCTOR_ID_TYPE,
            practitionerRegulationBody: normalizeRegulationBody(
              visitDx?.practitioner_body || regulationBody,
            ),
          });
        } catch {
          // Preauth succeeded; claim diagnosis can still be added from bill details.
        }
      }

      const awaitingDoctor = status === 'PENDING_DOCTOR_APPROVAL';
      showSnackbar({
        kind: 'success',
        title: awaitingDoctor
          ? isElective
            ? 'Elective preauth submitted'
            : 'Preauth submitted'
          : status === 'FINALISED' || status === 'FINALIZED'
            ? 'Preauth finalised'
            : 'Preauth submitted',
        subtitle: awaitingDoctor
          ? 'Awaiting doctor approval. Track progress on the Preauthorizations Status tab.'
          : preauthCode
            ? `Code: ${preauthCode}`
            : `Status: ${status}`,
      });
      onSuccess?.({ consentToken, preauthCode, status });
      setDirty(false);
      closeWorkspace?.();
    } catch (e: any) {
      showSnackbar({
        kind: 'error',
        title: 'Preauth failed',
        subtitle: String(e?.message ?? e),
      });
    } finally {
      setSubmitting(false);
      setPolling(false);
    }
  };

  if (!isElective && !consentToken) {
    return null;
  }

  return (
    <Form className={styles.form}>
      <div className={styles.body}>
        <div className={styles.header}>
          <div>
            <h4>{t('raisePreauth', 'Raise preauth')}</h4>
            <p className={styles.muted}>
              {patientName} · {intervention.code} · {billableService}
            </p>
          </div>
          <Tag type={isElective ? 'magenta' : 'blue'} size="md">
            {isElective ? 'Elective' : specialtyLabel} preauth
          </Tag>
        </div>

        {isElective ? (
          <section className={styles.section}>
            <h5>Expected service start</h5>
            <DatePicker
              datePickerType="single"
              dateFormat="Y-m-d"
              value={expectedServiceStartDate ? dayjs(expectedServiceStartDate).toDate() : undefined}
              onChange={(dates: Date[]) => {
                markDirty();
                if (dates?.[0]) setExpectedServiceStartDate(dateToServiceIso(dates[0]));
              }}
            >
              <DatePickerInput
                id="expected-service-start"
                labelText="Expected service start date"
                placeholder="yyyy-mm-dd"
              />
            </DatePicker>
          </section>
        ) : null}

        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={isElective ? 'Pre-visit authorization token' : 'Claim token'}
          subtitle={
            consentToken
              ? `${consentToken.slice(0, 8)}…${consentToken.slice(-4)}`
              : isElective
                ? 'Complete OTP authorize below to obtain a pre-visit token.'
                : '—'
          }
        />

        <section className={styles.section}>
          <h5>Consent</h5>
          <RadioButtonGroup
            legendText="Consent method"
            name="consent-method"
            valueSelected={consentMethod}
            onChange={(v) => {
              setConsentMethod(v as 'biometric' | 'otp');
              setConsentDone(false);
            }}
          >
            <RadioButton labelText="OTP" value="otp" id="preauth-otp" />
            <RadioButton labelText="Biometrics" value="biometric" id="preauth-bio" />
          </RadioButtonGroup>
          {consentMethod === 'otp' ? (
            <div className={styles.row}>
              <Button kind="tertiary" size="sm" onClick={handleSendOtp} disabled={sendingOtp || consentDone}>
                {sendingOtp ? <InlineLoading description="Sending…" /> : 'Send OTP'}
              </Button>
              <TextInput
                id="preauth-otp-input"
                labelText="OTP"
                value={otp}
                disabled={!otpSent || consentDone}
                onChange={(e) => setOtp(e.target.value)}
              />
              <Button kind="primary" size="sm" onClick={handleVerifyOtp} disabled={!otpSent || consentDone}>
                Verify
              </Button>
            </div>
          ) : (
            <div className={styles.row}>
              <p className={styles.muted}>
                Complete biometric capture on the patient device, then confirm below.
              </p>
              <Button kind="primary" size="sm" onClick={handleConfirmBiometric} disabled={consentDone}>
                Confirm biometric consent
              </Button>
            </div>
          )}
          {consentDone ? <Tag type="green" size="sm">Consent complete</Tag> : null}
        </section>

        <section className={styles.section}>
          <h5>Service &amp; provider</h5>
          <div className={styles.row}>
            <DatePicker
              datePickerType="single"
              dateFormat="Y-m-d"
              value={serviceStart ? dayjs(serviceStart).toDate() : undefined}
              onChange={([date]) => {
                if (!date) return;
                markDirty();
                setServiceStart(dateToServiceIso(date, dayjs(serviceStart).format('HH:mm:ss')));
              }}
            >
              <DatePickerInput id="preauth-service-start" labelText="Service start" placeholder="yyyy-mm-dd" />
            </DatePicker>
            <TextInput
              id="preauth-service-start-time"
              type="time"
              labelText="Start time"
              value={dayjs(serviceStart).format('HH:mm')}
              onChange={(e) => {
                markDirty();
                setServiceStart(dateToServiceIso(dayjs(serviceStart).toDate(), `${e.target.value}:00`));
              }}
            />
          </div>
          <div className={styles.row}>
            <DatePicker
              datePickerType="single"
              dateFormat="Y-m-d"
              value={serviceEnd ? dayjs(serviceEnd).toDate() : undefined}
              onChange={([date]) => {
                if (!date) return;
                markDirty();
                setServiceEnd(dateToServiceIso(date, dayjs(serviceEnd).format('HH:mm:ss')));
              }}
            >
              <DatePickerInput id="preauth-service-end" labelText="Service end" placeholder="yyyy-mm-dd" />
            </DatePicker>
            <TextInput
              id="preauth-service-end-time"
              type="time"
              labelText="End time"
              value={dayjs(serviceEnd).format('HH:mm')}
              onChange={(e) => {
                markDirty();
                setServiceEnd(dateToServiceIso(dayjs(serviceEnd).toDate(), `${e.target.value}:00`));
              }}
            />
          </div>

          <TextInput
            id="provider-email"
            labelText="Provider notification email"
            value={providerEmail}
            onChange={(e) => {
              markDirty();
              setProviderEmail(e.target.value);
            }}
          />
          <TextInput
            id="unit-price"
            labelText="Unit price (from bill)"
            type="number"
            value={unitPrice}
            readOnly
          />

          <div className={styles.searchBlock}>
            <p className={styles.fieldHint}>
              Diagnosis (ICD-11)
            </p>
            {loadingDx ? (
              <InlineLoading description="Loading patient diagnoses…" />
            ) : (
              <ComboBox
                id="preauth-diagnosis"
                titleText="Select diagnosis"
                placeholder="Search diagnosis / ICD-11 code"
                items={diagnosisItems}
                itemToString={diagnosisPickLabel}
                selectedItem={selectedDx}
                shouldFilterItem={() => true}
                onInputChange={handleDiagnosisInputChange}
                onChange={({ selectedItem }) => {
                  applyDiagnosisPick(selectedItem as DiagnosisPick | null, { fromUser: true });
                  if (selectedItem) {
                    setConceptDxHits([]);
                  }
                }}
              />
            )}
            {searchingDx ? <InlineLoading description="Searching concepts…" /> : null}
            <TextInput
              id="preauth-icd11"
              labelText="ICD-11 code"
              placeholder="Filled from selection (or type manually)"
              value={icdCode}
              onChange={(e) => {
                markDirty();
                setIcdCode(e.target.value.trim());
              }}
            />
          </div>

          <div className={styles.searchBlock}>
            <p className={styles.fieldHint}>Search OpenMRS providers</p>
            <ComboBox
              id="preauth-provider"
              titleText="Provider"
              placeholder="Type at least 2 characters to search"
              items={providerHits}
              itemToString={providerItemLabel}
              selectedItem={selectedProvider}
              shouldFilterItem={() => true}
              onInputChange={handleProviderInputChange}
              onChange={({ selectedItem }) => applyProviderSelection(selectedItem as OpenMrsProviderHit | null)}
            />
            {searchingProviders ? <InlineLoading description="Searching providers…" /> : null}
          </div>

          <div className={styles.row}>
            <TextInput
              id="doctor-id"
              labelText="Doctor National ID"
              value={doctorId}
              onChange={(e) => {
                markDirty();
                setDoctorId(e.target.value);
                setHwrHit(null);
              }}
            />
            <TextInput
              id="doctor-id-type"
              labelText="Doctor ID type"
              value={DEFAULT_DOCTOR_ID_TYPE}
              readOnly
            />
            <Button kind="tertiary" size="md" onClick={() => handleSearchHwr()} disabled={searchingHwr || !doctorId.trim()}>
              {searchingHwr ? 'Searching HWR…' : 'Search HWR (body)'}
            </Button>
          </div>
          {hwrHit ? (
            <Tag type="green" size="sm">
              {hwrHit.membership?.full_name || 'Match'} · {normalizeRegulationBody(hwrHit.membership?.licensing_body)}
            </Tag>
          ) : null}
          <div className={styles.row}>
            <Dropdown
              id="reg-body"
              titleText="Regulation body"
              label="Select regulation body"
              items={[...REGULATION_BODIES]}
              selectedItem={normalizeRegulationBody(regulationBody)}
              onChange={({ selectedItem }) => {
                markDirty();
                setRegulationBody(normalizeRegulationBody(selectedItem));
              }}
            />
            <p className={styles.fieldHint}>COC = Clinical Officers Council · NCK = Nursing Council of Kenya</p>
          </div>
        </section>

        {specialty.requiresSurgicalPreauth ? (
          <section className={styles.section}>
            <h5>Surgical preauth</h5>
            <TextArea
              id="chief-complaint"
              labelText="Chief complaint"
              value={formFieldStatus('chiefComplaint') === 'loading' ? '' : chiefComplaint}
              readOnly={formFieldLocked('chiefComplaint')}
              invalid={formFieldInvalid('chiefComplaint')}
              invalidText={formFieldInvalid('chiefComplaint') ? FORM_MISSING_HINT : undefined}
              onChange={(e) => {
                if (formFieldLocked('chiefComplaint')) return;
                markDirty();
                setChiefComplaint(e.target.value);
              }}
            />
            <TextInput
              id="vital-signs"
              labelText="Vital signs"
              value={vitalSigns}
              onChange={(e) => {
                markDirty();
                setVitalSigns(e.target.value);
              }}
            />
            <TextArea
              id="hpi"
              labelText="History of present illness"
              value={formFieldStatus('hpi') === 'loading' ? '' : hpi}
              readOnly={formFieldLocked('hpi')}
              invalid={formFieldInvalid('hpi')}
              invalidText={formFieldInvalid('hpi') ? FORM_MISSING_HINT : undefined}
              onChange={(e) => {
                if (formFieldLocked('hpi')) return;
                markDirty();
                setHpi(e.target.value);
              }}
            />
            <TextArea
              id="physical-exam"
              labelText="Physical examination"
              value={formFieldStatus('physicalExam') === 'loading' ? '' : physicalExam}
              readOnly={formFieldLocked('physicalExam')}
              invalid={formFieldInvalid('physicalExam')}
              invalidText={formFieldInvalid('physicalExam') ? FORM_MISSING_HINT : undefined}
              onChange={(e) => {
                if (formFieldLocked('physicalExam')) return;
                markDirty();
                setPhysicalExam(e.target.value);
              }}
            />
            <TextArea
              id="investigations"
              labelText="Investigation report details"
              value={formFieldStatus('investigations') === 'loading' ? '' : investigations}
              readOnly={formFieldLocked('investigations')}
              invalid={formFieldInvalid('investigations')}
              invalidText={formFieldInvalid('investigations') ? FORM_MISSING_HINT : undefined}
              onChange={(e) => {
                if (formFieldLocked('investigations')) return;
                markDirty();
                setInvestigations(e.target.value);
              }}
            />
            <div className={styles.row}>
              <Dropdown
                id="anaesthesia"
                titleText="Type of anaesthesia"
                label="Select"
                items={ANAESTHESIA}
                selectedItem={anaesthesia || null}
                disabled={formFieldLocked('anaesthesia')}
                invalid={formFieldInvalid('anaesthesia')}
                invalidText={formFieldInvalid('anaesthesia') ? FORM_MISSING_HINT : undefined}
                onChange={({ selectedItem }) => {
                  if (formFieldLocked('anaesthesia')) return;
                  markDirty();
                  setAnaesthesia(selectedItem ?? '');
                }}
              />
              <DatePicker
                datePickerType="single"
                dateFormat="Y-m-d"
                value={surgeryDate ? dayjs(surgeryDate).toDate() : undefined}
                onChange={(dates: Date[]) => {
                  if (formFieldLocked('surgeryDate')) return;
                  markDirty();
                  if (dates?.[0]) setSurgeryDate(dateToServiceIso(dates[0]));
                }}
              >
                <DatePickerInput
                  id="surgery-date"
                  labelText="Surgery date"
                  placeholder="yyyy-mm-dd"
                  readOnly={formFieldLocked('surgeryDate')}
                  invalid={formFieldInvalid('surgeryDate')}
                  invalidText={formFieldInvalid('surgeryDate') ? FORM_MISSING_HINT : undefined}
                />
              </DatePicker>
            </div>
            <div className={styles.row}>
              <Checkbox
                id="related-employment"
                labelText="Related to employment"
                checked={relatedToEmployment}
                readOnly={formFieldLocked('relatedToEmployment')}
                onChange={(_, { checked }) => {
                  if (formFieldLocked('relatedToEmployment')) return;
                  markDirty();
                  setRelatedToEmployment(checked);
                }}
              />
              <Checkbox
                id="related-accident"
                labelText="Related to auto/other accident"
                checked={relatedToAccident}
                readOnly={formFieldLocked('relatedToAccident')}
                onChange={(_, { checked }) => {
                  if (formFieldLocked('relatedToAccident')) return;
                  markDirty();
                  setRelatedToAccident(checked);
                }}
              />
              <Checkbox
                id="surgical-co-insured"
                labelText="Is co-insured"
                checked={isCoInsured}
                readOnly={formFieldLocked('isCoInsured')}
                onChange={(_, { checked }) => {
                  if (formFieldLocked('isCoInsured')) return;
                  markDirty();
                  setIsCoInsured(checked);
                }}
              />
            </div>
            {formFieldInvalid('relatedToEmployment') ||
            formFieldInvalid('relatedToAccident') ||
            formFieldInvalid('isCoInsured') ? (
              <InlineNotification
                kind="error"
                lowContrast
                hideCloseButton
                title="Missing Pre-authorization form answers"
                subtitle={FORM_MISSING_HINT}
              />
            ) : null}
            {isCoInsured ? (
              <TextArea
                id="co-insurance-details"
                labelText="Co-insurance details"
                value={formFieldStatus('coInsuranceDetails') === 'loading' ? '' : coInsuranceDetails}
                readOnly={formFieldLocked('coInsuranceDetails')}
                invalid={formFieldInvalid('coInsuranceDetails')}
                invalidText={formFieldInvalid('coInsuranceDetails') ? FORM_MISSING_HINT : undefined}
                onChange={(e) => {
                  if (formFieldLocked('coInsuranceDetails')) return;
                  markDirty();
                  setCoInsuranceDetails(e.target.value);
                }}
              />
            ) : null}
          </section>
        ) : null}

        {specialty.requiresRenalPreauth ? (
          <section className={styles.section}>
            <h5>Renal preauth</h5>
            <div className={styles.row}>
              <TextInput
                id="sessions-required"
                labelText="Number of sessions required"
                value={formFieldStatus('sessionsRequired') === 'loading' ? '' : sessionsRequired}
                readOnly={formFieldLocked('sessionsRequired')}
                invalid={formFieldInvalid('sessionsRequired')}
                invalidText={formFieldInvalid('sessionsRequired') ? FORM_MISSING_HINT : undefined}
                onChange={(e) => {
                  if (formFieldLocked('sessionsRequired')) return;
                  markDirty();
                  setSessionsRequired(e.target.value);
                }}
              />
              <TextInput
                id="cost-per-session"
                labelText="Cost per session"
                value={costPerSession}
                onChange={(e) => {
                  markDirty();
                  setCostPerSession(e.target.value);
                }}
              />
              <Dropdown
                id="frequency"
                titleText="Frequency of sessions"
                label="Select"
                items={FREQUENCY}
                selectedItem={frequency || null}
                disabled={formFieldLocked('frequency')}
                invalid={formFieldInvalid('frequency')}
                invalidText={formFieldInvalid('frequency') ? FORM_MISSING_HINT : undefined}
                onChange={({ selectedItem }) => {
                  if (formFieldLocked('frequency')) return;
                  markDirty();
                  setFrequency(selectedItem ?? '');
                }}
              />
            </div>
            <TextArea id="renal-indications" {...clinicalIndicationsFieldProps} />
            <div className={styles.row}>
              <DatePicker
                datePickerType="single"
                dateFormat="Y-m-d"
                value={startDate ? dayjs(startDate).toDate() : undefined}
                onChange={(dates: Date[]) => {
                  if (formFieldLocked('startDate')) return;
                  markDirty();
                  if (dates?.[0]) setStartDate(dateToServiceIso(dates[0]));
                }}
              >
                <DatePickerInput
                  id="renal-start"
                  labelText="Start date"
                  placeholder="yyyy-mm-dd"
                  readOnly={formFieldLocked('startDate')}
                  invalid={formFieldInvalid('startDate')}
                  invalidText={formFieldInvalid('startDate') ? FORM_MISSING_HINT : undefined}
                />
              </DatePicker>
              <Checkbox
                id="renal-co-insured"
                labelText="Is co-insured"
                checked={isCoInsured}
                readOnly={formFieldLocked('isCoInsured')}
                onChange={(_, { checked }) => {
                  if (formFieldLocked('isCoInsured')) return;
                  markDirty();
                  setIsCoInsured(checked);
                }}
              />
            </div>
            {formFieldInvalid('isCoInsured') ? (
              <InlineNotification
                kind="error"
                lowContrast
                hideCloseButton
                title="Missing co-insured answer"
                subtitle={FORM_MISSING_HINT}
              />
            ) : null}
            {isCoInsured ? (
              <TextArea
                id="renal-co-insurance-details"
                labelText="Co-insurance details"
                value={formFieldStatus('coInsuranceDetails') === 'loading' ? '' : coInsuranceDetails}
                readOnly={formFieldLocked('coInsuranceDetails')}
                invalid={formFieldInvalid('coInsuranceDetails')}
                invalidText={formFieldInvalid('coInsuranceDetails') ? FORM_MISSING_HINT : undefined}
                onChange={(e) => {
                  if (formFieldLocked('coInsuranceDetails')) return;
                  markDirty();
                  setCoInsuranceDetails(e.target.value);
                }}
              />
            ) : null}
          </section>
        ) : null}

        {specialty.requiresOpticalPreauth ? (
          <section className={styles.section}>
            <h5>Optical preauth</h5>
            <TextArea id="optical-indications" {...clinicalIndicationsFieldProps} />
            <TextArea
              id="necessity"
              labelText="Necessity of service"
              value={necessity}
              onChange={(e) => {
                markDirty();
                setNecessity(e.target.value);
              }}
            />
            <div className={styles.row}>
              <Dropdown
                id="lens-rx"
                titleText="Lens prescription"
                label="Select"
                items={LENS}
                selectedItem={lensPrescription || null}
                onChange={({ selectedItem }) => {
                  markDirty();
                  setLensPrescription(selectedItem ?? '');
                }}
              />
              <Dropdown
                id="new-or-repl"
                titleText="New or replacement"
                label="Select"
                items={NEW_OR_REPL}
                selectedItem={newOrReplacement || null}
                onChange={({ selectedItem }) => {
                  markDirty();
                  setNewOrReplacement(selectedItem ?? '');
                }}
              />
            </div>
            <div className={styles.row}>
              <TextInput
                id="lens-amount"
                labelText="Lens amount"
                value={lensAmount}
                onChange={(e) => {
                  markDirty();
                  setLensAmount(e.target.value);
                }}
              />
              <TextInput
                id="eye-exam-amount"
                labelText="Eye examination amount"
                value={eyeExamAmount}
                onChange={(e) => {
                  markDirty();
                  setEyeExamAmount(e.target.value);
                }}
              />
              <TextInput
                id="frame-amount"
                labelText="Frame amount"
                value={frameAmount}
                onChange={(e) => {
                  markDirty();
                  setFrameAmount(e.target.value);
                }}
              />
            </div>
          </section>
        ) : null}

        {specialty.requiresOncologyPreauth ? (
          <section className={styles.section}>
            <h5>Oncology preauth</h5>
            <div className={styles.row}>
              <Dropdown
                id="carcinoma-staging"
                titleText="Carcinoma staging"
                label="Select"
                items={STAGING}
                selectedItem={carcinomaStaging || null}
                onChange={({ selectedItem }) => {
                  markDirty();
                  setCarcinomaStaging(selectedItem ?? '');
                }}
              />
              <Dropdown
                id="metastases"
                titleText="Metastases"
                label="Select"
                items={METASTASES}
                selectedItem={metastases || null}
                onChange={({ selectedItem }) => {
                  markDirty();
                  setMetastases(selectedItem ?? '');
                }}
              />
              <Dropdown
                id="treatment-setting"
                titleText="Treatment setting"
                label="Select"
                items={TREATMENT}
                selectedItem={treatmentSetting || null}
                onChange={({ selectedItem }) => {
                  markDirty();
                  setTreatmentSetting(selectedItem ?? '');
                }}
              />
            </div>
            <TextArea
              id="comorbidity"
              labelText="Comorbidity"
              value={comorbidity}
              onChange={(e) => {
                markDirty();
                setComorbidity(e.target.value);
              }}
            />
            <TextArea
              id="progress-report"
              labelText="Progress report"
              value={progressReport}
              onChange={(e) => {
                markDirty();
                setProgressReport(e.target.value);
              }}
            />
            <div className={styles.row}>
              <DatePicker
                datePickerType="single"
                dateFormat="Y-m-d"
                value={startDate ? dayjs(startDate).toDate() : undefined}
                onChange={(dates: Date[]) => {
                  markDirty();
                  if (dates?.[0]) setStartDate(dateToServiceIso(dates[0]));
                }}
              >
                <DatePickerInput id="oncology-start" labelText="Start date" placeholder="yyyy-mm-dd" />
              </DatePicker>
            </div>
            <div className={styles.row}>
              <TextInput
                id="onc-sessions"
                labelText="Number of sessions required"
                value={sessionsRequired}
                onChange={(e) => {
                  markDirty();
                  setSessionsRequired(e.target.value);
                }}
              />
              <TextInput
                id="onc-cost"
                labelText="Cost per session"
                value={costPerSession}
                onChange={(e) => {
                  markDirty();
                  setCostPerSession(e.target.value);
                }}
              />
              <Checkbox
                id="onc-co-insured"
                labelText="Is co-insured"
                checked={isCoInsured}
                onChange={(_, { checked }) => {
                  markDirty();
                  setIsCoInsured(checked);
                }}
              />
            </div>
          </section>
        ) : null}

        {specialty.requiresRadiologyPreauth ? (
          <section className={styles.section}>
            <h5>Imaging / radiology preauth</h5>
            <TextArea id="imaging-indications" {...clinicalIndicationsFieldProps} />
          </section>
        ) : null}

        <PreauthAttachments
          attachments={attachments}
          onChange={handleAttachmentsChange}
          addableDocTypes={addableDocTypes}
          billItem={billItem as Record<string, unknown>}
          intervention={interventionForSubmit}
          disabled={submitting || polling}
        />
      </div>

      <ButtonSet className={styles.buttonSet}>
        <Button kind="secondary" onClick={() => closeWorkspace()} disabled={submitting || polling}>
          Cancel
        </Button>
        <Button kind="primary" onClick={handleSubmit} disabled={!consentDone || submitting || polling}>
          {polling ? (
            <InlineLoading description="Confirming submission…" />
          ) : submitting ? (
            <InlineLoading description="Submitting…" />
          ) : (
            t('submitPreauth', 'Submit preauth')
          )}
        </Button>
      </ButtonSet>
    </Form>
  );
};

const PreauthWorkspace: React.FC<PreauthWorkspaceProps> = (props) => (
  <PreauthForm key={`${props.consentToken}::${props.intervention?.code ?? ''}`} {...props} />
);

export default PreauthWorkspace;
