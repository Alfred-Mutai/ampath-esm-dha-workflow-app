export interface ClientSubBenefit {
  id: number;
  code: string;
  name: string;
  accessPoint: string;
  fund: string;
  parentBenefit: string;
  parentBenefitCode: string;
}

export interface ClientSubBenefitResults {
  results: ClientSubBenefit[];
}

export interface Intervention {
  id: number;
  accessPoint: string;
  name: string;
  code: string;
  paymentMechanism: string;
  needsPreauth: boolean;
  needsManualPreauthApproval: boolean;
  overallTariff: string;
  kephLevelTarriff: string;
  fund: string;
  fallBackOverallTariff: string;
  tariffPerAdditionalKilometer: string;
  level2Tariff: string;
  level3Tariff: string;
  level4Tariff: string;
  level5Tariff: string;
  level6Tariff: string;
  requiresSurgicalPreauth: boolean;
  requiresRenalPreauth: boolean;
  requiresOncologyPreauth: boolean;
  requiresRadiologyPreauth: boolean;
  requiresOpticalPreauth: boolean;
  applicableSchemes: string[];
  requiredPreauthDocumentTypes: string[];
  applicableDocumentTypes: string[];
}

export interface InterventionResults {
  results: Intervention[];
}

export interface FundUtilizationLimit {
  fundType: string;
  utilisedAmount: string;
  maxAmount: string;
  availableAmount: string;
}

export interface IntermediatePeriodUsage {
  individualUtilisedDuringPeriod: number;
  individualMaxDuringPeriod: number;
  period: string;
  lastUsageDate: string;
}

export interface ComputationalDetail {
  individualLimitAvailableCount: number;
  householdLimitAvailableCount: number;
  coverageStartDate: string;
  coverageEndDate: string;
  limitAvailableAmount: string;
  nextAvailableDate: string;
  eligibility: boolean;
  intermediatePeriodUsage: IntermediatePeriodUsage;
}

export interface BenefitUtilization {
  crId: string;
  code: string;
  limitScope: string;
  nextAvailability: string;
  utilizationDays: number;
  individualMaxLimit: number;
  householdMaxLimit: number;
  individualUtilisedLimit: number;
  householdUtilisedLimit: number;
  fundUtilizationLimit: FundUtilizationLimit[];
  computationalDetail: ComputationalDetail;
}

export type ServiceType = "CAPITATION" | "OUTPATIENT" | "INPATIENT" | "EMERGENCY" | "PER_DIEM";

export type PreauthType = "NORMAL" | "SURGICAL" | "ONCOLOGY" | "RENAL" | "IMAGING" | "OPTICAL";

export type VisitType = "INPATIENT" | "OUTPATIENT";

// Claim visit
export interface ClaimIntervention {
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
  optional_document_type: string | null;
  required_preauth_document_types: string[] | null;
  optional_preauth_document_types: string[] | null;
  applicable_document_types: string[];
  needs_preauth: boolean;
}

interface InvoiceLine {
  [key: string]: unknown;
}

interface InvoiceDoctor {
  [key: string]: unknown;
}

interface InvoiceFlag {
  [key: string]: unknown;
}

interface ClaimInvoice {
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
  service_type: ServiceType;
  total_inv_amount: string;
  total_inv_net_amount: string;
  total_inv_copay: string;
  total_inv_discount: string;
  lines: InvoiceLine[];
  doctors: InvoiceDoctor[];
  invoice_flags: InvoiceFlag[];
  visit_start: string;
}

interface ClaimDiagnosis {
  [key: string]: unknown;
}

export interface ClaimResult {
  id: string;
  payer_code: string;
  payer_name: string;
  payer_slade_code: string;
  provider_slade_code: string;
  provider_name: string;
  patient_name: string;
  patient_number: string;
  member_number: string;
  member_number_has_token: boolean;
  service_type: ServiceType;
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
  interventions: ClaimIntervention[];
  invoices: ClaimInvoice[];
  claim_attachments_count: number;
  claim_auth_status: string;
  claim_diagnoses: ClaimDiagnosis[];
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
}