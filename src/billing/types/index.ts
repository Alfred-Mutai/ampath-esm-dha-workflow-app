import { type CashPoint, type BillableService, type LineItem } from '../../shared/types';

export interface ApiLink {
  rel: string;
  uri: string;
  resourceAlias: string;
}

export interface Cashier {
  uuid: string;
  display: string;
  links: ApiLink[];
}

export interface Patient {
  uuid: string;
  display: string;
  voided: boolean;
  links: ApiLink[];
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | string;
export type BillStatus = 'PENDING' | 'PAID' | 'CANCELLED' | string;

export type Payment = {
  uuid: string;
  instanceType: {
    uuid: string;
    name: string;
    description: string | null;
    retired: boolean;
  };
  attributes: any[];
  amount: number;
  amountTendered: number;
  dateCreated: number;
  voided: boolean;
  resourceVersion: string;
};

export interface Bill {
  uuid: string;
  receiptNumber: string;
  status: BillStatus;
  adjustmentReason: string | null;
  adjustedBy: any[];
  billAdjusted: string | null;
  cashPoint: CashPoint;
  cashier: Cashier;
  dateCreated: string;
  lineItems: LineItem[];
  patient: Patient;
  payments: Payment[];
  resourceVersion: string;
}

export type PayBillDto = {
  instanceType: string;
  amountTendered: number;
  amount: number;
};
export type EditLineItem = {
  uuid: string;
  display: string;
  voided: boolean;
  voidReason: string | null;
  item: '';
  billableService: string;
  quantity: number;
  price: number;
  priceName: string;
  priceUuid: string;
  lineItemOrder: 0;
  status: PaymentStatus;
  resourceVersion: string;
};
export type EditBillLineItemDto = {
  cashPoint: string;
  cashier: string;
  lineItems: EditLineItem[];
  patient: string;
  status: BillStatus;
  uuid: string;
};

export type AmrsVisitDiagnosis = {
  patient_id: number;
  encounter_id: number;
  encounter_datetime: string;
  facility: string;
  encounter_type: string;
  concept_id?: number | null;
  value_coded?: number | null;
  /** Encounter diagnosis coded concept (/patient/encounter-diagnosis). */
  diagnosis_coded?: number | null;
  concept_source_name: string;
  hl7_code: string;
  icd11_code: string;
  provider_id: string | number;
  national_id: string;
  speciality?: string | null;
  uuid: string;
  practioner_nat_id: string;
  practitioner_speciality: string;
  practitioner_identifier_type: string;
  practitioner_body: string;
};

export type AmrsVisitDiagnosisDto = {
  visitDate: string;
  patientUuid: string;
  locationUuid: string;
};
export type AmrsVisitDiagnosisResponse = {
  results: AmrsVisitDiagnosis[];
};

export type AmrsMaternityDiagnosis = {
  uuid: string;
  encounter_id: number;
  encounter_datetime: string;
  encounter_type: string;
  icd11_code: string;
  hl7_code: string;
  concept_source_name: string;
  practioner_nat_id: string;
  practitioner_speciality: string;
  practitioner_body: string;
  practitioner_identifier_type: string;
  patient_id: string;
  facility: string;
  concept_id: string;
  value_coded: string;
};

export type AmrsMaternityDiagnosisDto = {
  billingDate: string;
  patientUuid: string;
};
export type AmrsMaternityDiagnosisResponse = {
  results: AmrsMaternityDiagnosis[];
};

export interface FacilityPreauth {
  cash_point: string;
  bill_date: string;
  patient_name: string;
  patient_uuid: string;
  status: string;
  cr_no: string;
  amrs_universal_id: string;
  intervention_code: string;
  consent_token: string | null;
  order_no: string;
  service_type: string;
  requires_preauth: number;
  normal_preauth: number;
  elective_preauth: number;
  preauth_approved: number;
  required_documents: string | null;
  applicable_document_types: string;
  required_preauth_document_types: string;
}

export interface FacilityPreauthsResponse {
  results: FacilityPreauth[];
}

export type BedOccupancyRate = {
    total_ip_visits: number;
    icu_visits: number;
    hdu_visits: number;
    normal_ip_visits: number;
    newborn_visits: number;
    dialysis_visits: number;
    total_number_of_bed: number;
    number_of_normal_bed: number;
    number_of_icu_bed: number;
    number_of_hdu_bed: number;
    number_of_dialysis_bed: number;
    number_of_baby_cot: number;
}

export type BedOccupancy = {
  name: string;
  bp_level: string;
  bed_occupancy_rate: BedOccupancyRate
};
