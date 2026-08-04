/**
 * Types for the patient Case Summary.
 *
 * Mirrors the `hie-saf` package's `GET /case-summary` response verbatim
 * (`packages/hie-saf/src/case-summary/types/index.ts`) — this endpoint now
 * does the AMRS join server-side, so there is nothing left to assemble here.
 * See `packages/hie-saf/docs/case-summary-endpoint.md` for the full contract.
 */

export type CaseSummaryVisit = {
  uuid: string;
  display?: string;
  visitType?: string;
  startDatetime?: string;
  stopDatetime?: string;
};

export type CaseSummaryDemographics = {
  name: string;
  birthDate?: string;
  gender?: string;
  age?: string;
  patientId?: string;
  nationalId?: string;
  crNumber?: string;
};

export type CaseSummaryAllergy = {
  substance: string;
  criticality?: string;
  reaction?: string;
};

export type CaseSummaryCondition = {
  code?: string;
  description: string;
  certainty?: string;
  /** Present only for a rank-1 diagnosis. */
  primary?: true;
  onsetDate?: string;
};

/** Keyed, not an array of `{label, value}` pairs — display labels belong here in the view, via `VITAL_ROWS`. */
export type CaseSummaryVitals = {
  temperature?: string;
  bloodPressure?: string;
  pulse?: string;
  respiratoryRate?: string;
  spo2?: string;
  height?: string;
  weight?: string;
  bmi?: string;
  tewScore?: string;
};

export type CaseSummaryMedication = {
  date?: string;
  drug: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

/**
 * One encounter's non-vital obs. Kept in the type for parity with the wire
 * contract, but deliberately not rendered by `CaseSummaryPrintable` — see the
 * note there. The SOAP note is the intended replacement for this section.
 */
export type CaseSummaryClinicalNote = {
  encounterUuid: string;
  encounterType?: string;
  datetime?: string;
  fields: Array<{ label: string; value: string }>;
};

/** Present only when there is something to say — `'--'`/`NORMAL` are never sent. */
export type CaseSummaryLabInterpretation =
  | 'LOW'
  | 'HIGH'
  | 'CRITICALLY_LOW'
  | 'CRITICALLY_HIGH'
  | 'OFF_SCALE_LOW'
  | 'OFF_SCALE_HIGH';

export type CaseSummaryLabResult = {
  test: string;
  /** Immediate parent panel name when nested; absent at root. */
  panel?: string;
  value: string;
  units?: string;
  datetime?: string;
  range?: string;
  interpretation?: CaseSummaryLabInterpretation;
};

export type CaseSummaryLabOrder = {
  uuid: string;
  test: string;
  orderNumber?: string;
  orderedDate?: string;
  /** Present only when no in-window result was found. */
  pending?: true;
  /** OpenMRS `order_action` — e.g. `NEW`, `RENEW`, `DISCONTINUE`. */
  action?: string;
  /** OpenMRS's own fulfiller workflow status — e.g. `RECEIVED`, `COMPLETED`, `EXCEPTION`. */
  fulfillerStatus?: string;
  results: Array<CaseSummaryLabResult>;
};

export type CaseSummaryInpatientDetails = {
  admissionDate?: string;
  ward?: string;
  doctor?: string;
  status?: string;
  dischargeDate?: string;
};

/**
 * A SOAP note assembled server-side from everything else in this response —
 * narrative text, not a new source of clinical data. Deterministic and
 * template-based, not model-generated. Each section is absent when nothing
 * categorised into it.
 */
export type CaseSummarySoapNote = {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
};

export type CaseSummaryResponse = {
  /** Anchor visit; the merged span when several same-day visits were folded in. */
  visit: CaseSummaryVisit;
  /** All folded-in visit uuids, anchor first. Length > 1 ⇒ the view says "N visits combined". */
  visitUuids: Array<string>;
  demographics: CaseSummaryDemographics;
  allergies: Array<CaseSummaryAllergy>;
  /** Active diagnoses. */
  conditions: Array<CaseSummaryCondition>;
  vitals: CaseSummaryVitals;
  /** Active drug orders only — inactive ones are filtered server-side. */
  medications: Array<CaseSummaryMedication>;
  clinicalNotes: Array<CaseSummaryClinicalNote>;
  labOrders: Array<CaseSummaryLabOrder>;
  /** Present only when orders existed but the lab results query failed. */
  labResultsUnavailable?: true;
  /** Present only for a visit with an ADT encounter — absent entirely for outpatient. */
  inpatientDetails?: CaseSummaryInpatientDetails;
  soapNote: CaseSummarySoapNote;
};
