export type FacilityBillsDto = {
  locationUuid: string;
  billingDate: string;
};

export type FacilityBillsResponse = {
  results: FacilityBill[];
};
/** A row from /facility/bills. Every field bar the identifiers can come back null. */
export type FacilityBill = {
  bill_uuid: string;
  receipt_number: string | null;
  patient_name: string;
  cash_point: string | null;
  bill_date: string | null;
  /** Comma-separated per-line-item statuses, e.g. "PENDING,PENDING". */
  paid_status: string;
  patient_uuid: string;
  /** Present once the visit has an SHA/HIE authorisation. */
  consent_token: string | null;
  national_id: string | null;
  cr_id: string | null;
  visit_type: string | null;
  /** SHA claim lifecycle status for this bill, when the eClaims status feed provides
      it. Absent until the backend supplies it — used by the SHA-bills claim-status
      filter. */
  claim_status?: string | null;
};

export type PatientFacilityBillsDto = {
  locationUuid: string;
  billingDate: string;
  patientUuid: string;
};

export type PatientFacilityBillDetails = {
  bill_uuid: string;
  receipt_number: string;
  patient_name: string;
  cash_point: string;
  bill_date: string;
  paid_status: string;
  patient_uuid: string;
  bill_line_item_id: number;
  billable_service: string | null;
  item_price: number;
  payment_scheme: string;
  payment_status: string;
  item_quantity: number;
  item_total_price: number;
  cashier_bill_line_item_uuid: string;
  bill_item_time: string;
  cr_no: string;
  amrs_universal_id: string;
  intervention_code: string;
  consent_token: string;
  order_no: string;
  service_type: string;
  has_claim_line: number;
};

export type PatientFacilityBillDetailsResponse = {
  results: PatientFacilityBillDetails[];
};

export enum BillingView {
  Bills = 'BILLS',
  BillDetails = 'Details',
  /** A claim opened on its own, without a bill behind it. */
  ClaimDetails = 'ClaimDetails',
}

export type ClaimVisitsDto = {
  locationUuid?: string;
  consentToken?: string;
  visitDate?: string;
  patientId?: string;
};

export type ClaimVisitInvoince = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  dispatch_status: string;
  workflow_state: string;
  created_by_name: string;
  patient_name: string;
  patient_number: string;
  provider_name: string;
  scheme_code: string;
  scheme_name: string;
  service_type: string;
  total_inv_amount: string;
  total_inv_net_amount: string;
  total_inv_copay: string;
  total_inv_discount: string;
  lines: ClaimInvoiceLine[];
  doctors: any[];
  invoice_flags: any[];
  visit_start: string;
};

export enum ApplicableDocumentType {
  BIRTH_NOTIFICATION = 'BIRTH_NOTIFICATION',
  CLAIM_FORM = 'CLAIM_FORM',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
  INVOICE = 'INVOICE',
  FINAL_BILL = 'FINAL_BILL',
}

export type VisitIntervention = {
  id: string;
  intervention_code: string;
  intervention_name: string;
  intervention_payment_mechanism: string;
  keph_level_tarrif: string;
  accrued_per_diem_amount: string;
  accrued_per_diem_days: number;
  workflow_state: string;
  preauth_exist: boolean;
  is_switched_intervention: boolean;
  supported_scheme: string;
  switched_lines_retained: boolean;
  sub_benefit_code: string;
  active_for_uhc: boolean;
  intervention_fund: string;
  requires_surgical_preauth: boolean;
  requires_renal_preauth: boolean;
  requires_oncology_preauth: boolean;
  requires_radiology_preauth: boolean;
  requires_optical_preauth: boolean;
  optional_document_type: unknown;
  required_preauth_document_types: unknown;
  optional_preauth_document_types: unknown;
  applicable_document_types: ApplicableDocumentType[];
  needs_preauth: boolean;
};

export type VisitDiagnosis = {
  claim: string;
  diagnosis: string;
  recorded_on: string;
  patient_number: string;
  diagnosis_name: string;
  diagnosis_code: string;
  is_flagged_diagnosis: boolean;
  intervention_code: string;
};

export type ClaimAttachment = {
  id: string;
  title: string;
  data: string;
  attachment_type: string;
  retry_count: number;
  intervention_code: string;
  claim: string;
  attachment: string;
};

export type ClaimDoctor = {
  id: string;
  claim: string;
  doctor_name: string;
};

export type ClaimsVisit = {
  id: string;
  payer_code: string;
  payer_name: string;
  provider_slade_code: string;
  provider_name: string;
  patient_name: string;
  patient_number: string;
  member_number: string;
  member_number_has_token: boolean;
  service_type: string;
  scheme_code: string;
  scheme_name: string;
  currency: string;
  visit_number: string;
  visit_start: string;
  authorization_code: string;
  authorization_guid: string;
  beneficiary_id: number;
  beneficiary_guid: string;
  beneficiary_is_fuzzy_matched: boolean;
  workflow_state: string;
  is_charge_master_mapped: boolean;
  is_resubmitted: boolean;
  is_negative: boolean;
  is_zero: boolean;
  has_reviewed_claim: boolean;
  initial_intervention: string;
  interventions: VisitIntervention[];
  invoices: ClaimVisitInvoince[];
  claim_attachments_count: number;
  claim_auth_status: string;
  claim_diagnoses: VisitDiagnosis[];
  diagnoses_count: number;
  claim_attachments: ClaimAttachment[];
  claim_doctors: ClaimDoctor[];
  invoice_attachments_count: number;
  invoice_id: string;
  invoice_number: string;
  number_of_invoices: number;
  total_claim_amount: string;
  total_claim_copay: string;
  total_claim_discount: string;
  total_claim_net_amount: string;
  total_claim_splits: string;
  retry_count: number;
  created_by_name: string;
  updated_by_name: string;
  notes: string;
};

export type ClaimVisitReponse = {
  id: number;
  locationUuid: string;
  patientId: string;
  serviceType: string;
  claimVisitId: string;
  claimVisitNumber: string;
  visitStart: string;
  authorizationCode: string;
  authorizationGuid: string;
  visitResponse: ClaimsVisit;
  createdBy?: string | null;
  /** When this snapshot of the claim was recorded locally. The same claim is returned
      once per local visit, so this is what tells the snapshots apart. */
  dateCreated?: string | null;
};

export type ProviderClaimPreviewDto = {
  consentToken: string;
  locationUuid: string;
};

export type PatientPaymentsDto = {
  billingDate: string;
  patientUuid: string;
};

export type PatientPayment = {
  bill_id: number;
  receipt_number: string;
  patient_id: number;
  status: string;
  patient_uuid: string;
  cashier_bill_payment_uuid: string;
  payment_mode_id: number;
  amount: number;
  amount_tendered: number;
  payment_time: string;
  payment_mode: string;
};

export type PatientPaymentReponse = {
  results: PatientPayment[];
};

export type BillPaymentDto = {
  instanceType: string; // paymentModeUuid
  amountTendered: number;
  amount: number;
};

export type BillPaymentResponse = {
  uuid: string;
  instanceType: {
    uuid: string;
    name: string;
    description: string;
    retired: boolean;
  };
  attributes: [];
  amount: number;
  amountTendered: number;
  dateCreated: number;
  voided: boolean;
  resourceVersion: string;
};

export type AddClaimLineDto = {
  consentToken: string;
  interventionCode: string;
  unitPrice: string;
  quantity: string;
  locationUuid: string;
};

export type RemoveClaimLineDto = {
  consentToken: string;
  lineGuid: string;
  locationUuid: string;
};

export type CloseClaimDto = {
  consentToken: string;
  locationUuid: string;
  cancelReasonType: string;
  cancelReasonText: string;
};

export type SubmitClaimDto = {
  consentToken: string;
  invoiceNumber: string;
  locationUuid: string;
};

export enum ClaimCloseReasonType {
  WrongPatient = 'WRONG_PATIENT',
  NoServiceGiven = 'NO_SERVICE_GIVEN',
  WringBenefit = 'WRONG_BENEFIT',
  ExpiredVisit = 'EXPIRED_VISIT',
  ExhaustedBenefit = 'EXHAUSTED_BENEFIT',
  TimeBarred = 'TIME_BARRED',
  OtherReasons = 'OTHER_REASONS',
}

export enum DischargeReasonType {
  RECOVERED = 'RECOVERED',
  REFERRED = 'REFERRED',
  ABSCONDED = 'ABSCONDED',
  OTHER = 'OTHER',
}

export type ClaimInvoiceLine = {
  id: string;
  item_code: string;
  item_name: string;
  invoice: string;
  intervention_code: string;
  line_total_amount: string;
  line_net_amount: string;
  quantity: number;
  unit: string;
  unit_price: string;
  is_active: boolean;
  is_cancellation: boolean;
  is_return: boolean;
  uhc_exceeded: boolean;
  charge_date: string;
  line_number: string;
  scheme_code: string;
  scheme_name: string;
  discount: string;
};

export type AddClaimDiagnosisDto = {
  consentToken: string;
  interventionCode: string;
  icdCode: string;
  locationUuid: string;
  practitionerIdentificationNumber: string;
  practitionerIdentificationType: string;
  practitionerRegulationBody: string;
};

// Switch the claim's current intervention to another eligible one (not
// restricted to the same sub-benefit). `retainBillItems` aligns with
// VisitIntervention.switched_lines_retained; `billFrom` / `billTo` are the
// bill-period date range (ISO `YYYY-MM-DD`) used only when bill items are
// retained (empty strings otherwise).
// TODO(backend): `billedAmount` is not yet confirmed against the
// `/interventions/switch` contract (that route itself is still a backend
// TODO — see switchClaimIntervention). It's the selected service type's
// SHA-tariff price. Confirm the field name/acceptance with the backend
// before this ships. The OpenMRS order for the switch is created only
// *after* this call succeeds (see switch-intervention.workspace.tsx), so
// there is no order number to attach to this DTO at submit time.
export type SwitchInterventionDto = {
  consentToken: string;
  existingInterventionCode: string;
  newInterventionCode: string;
  retainBillItems: boolean;
  billFrom: string;
  billTo: string;
  locationUuid: string;
  billedAmount: string;
};

export interface ActiveVisit {
  identifiers: string;
  patient_name: string;
  payment_method: string;
  payment_method_uuid: string;
  payment_status: 'CLEARED' | 'PENDING' | string;
  person_id: number;
  visit_date: string; // ISO date string
  visit_id: number;
  visit_type: string;
  visit_uuid: string;
}
