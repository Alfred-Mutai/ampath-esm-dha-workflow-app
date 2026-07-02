export type FacilityBillsDto = {
  locationUuid: string;
  billingDate: string;
};

export type FacilityBillsResponse = {
  results: FacilityBill[];
};
export type FacilityBill = {
  patient_name: string;
  cash_point: string;
  bill_date: string;
  paid_status: string;
  patient_uuid: string;
};

export type PatientFacilityBillsDto = {
  locationUuid: string;
  billingDate: string;
  patientUuid: string;
};

export type PatientFacilityBillDetails = {
  bill_uuid: string;
  patient_name: string;
  cash_point: string;
  bill_date: string;
  paid_status: string;
  patient_uuid: string;
  bill_line_item_id: number;
  billable_service: string;
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
};

export type PatientFacilityBillDetailsResponse = {
  results: PatientFacilityBillDetails[];
};

export enum BillingView {
  Bills = 'BILLS',
  BillDetails = 'Details',
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
  lines: any[];
  doctors: any[];
  invoice_flags: any[];
  visit_start: string;
};

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
  applicable_document_types: any[];
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
}

export type BillPaymentDto = {
  instanceType: string; // paymentModeUuid
  amountTendered: number;
  amount: number;
}

export type BillPaymentResponse = {
   "uuid": string;
    "instanceType": {
        "uuid": string;
        "name": string;
        "description": string;
        "retired": boolean;
    },
    "attributes": [],
    "amount": number;
    "amountTendered": number;
    "dateCreated": number;
    "voided": boolean;
    "resourceVersion": string;
  }
