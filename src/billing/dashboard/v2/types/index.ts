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
};

export type PatientFacilityBillDetailsResponse = {
  results: PatientFacilityBillDetails[];
};

export enum BillingView{
  Bills = 'BILLS',
  BillDetails = 'Details'
}
