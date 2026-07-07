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
  paymentStatus: PaymentStatus;
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
  concept_id: number;
  value_coded: number;
  concept_source_name: string;
  hl7_code: string;
  icd11_code: string;
  provider_id: string;
  national_id: string;
  speciality: string;
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
}
