import { type Location } from '@openmrs/esm-framework';

export type BillableService = {
  uuid: string;
  name?: string;
  display?: string;
  shortName: string;
  serviceStatus: 'ENABLED' | 'DISABLED';
  serviceType: ServiceType | null;
  servicePrices: ServicePrice[];
  resourceVersion: string;
};

export type ServiceType = {
  display: string;
  resourceVersion: string;
};

export type ServicePrice = {
  uuid: string;
  name: string;
  price: number;
  item: string;
  paymentMode: PaymentMode;
  billableService: BillableService;
  resourceVersion: string;
};

export type PaymentMode = {
  uuid: string;
  name: string;
  description: string | null;
  retired: boolean;
  retireReason: string;
  attributeTypes: unknown[];
  sortOrder: number | null;
  resourceVersion: string;
};

export type PayableBillableService = ServicePrice & {
  billableService: BillableService;
};

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export type LineItem = {
  uuid?: string;
  billableService: string;
  quantity: number;
  price: number;
  priceName: string;
  priceUuid: string;
  lineItemOrder: number;
  paymentStatus: PaymentStatus;
  voided?: boolean;
  voidedReason?: string;
};

export type CreateBillDto = {
  lineItems: LineItem[];
  cashPoint: string;
  patient: string;
  status: PaymentStatus;
  payments: any[];
};

export type CashPoint = {
  uuid: string;
  name: string;
  description: string;
  retired: boolean;
  location: Location;
};

export type CreateClientPaymentModeDto = {
  clientId: string;
  paymentModeUuid: string;
};
export type HieClientPaymentMode = {
  client_id: string;
  payment_mode_uuid: string;
};

export type HieBillPayment = {
  billUuid: string;
  paymentUuid: string;
  referenceNo: string;
};

export type ServiceQueueDailyReport = {
  queue_room_name: string;
  patients: number;
};

export type ServiceQueueDailyReportResp = {
  schemas: any;
  sqlQuery: string;
  size: number;
  result: ServiceQueueDailyReport[];
};

export type ServiceQueueReportPatientList = {
  queue_entry_id: number;
  patient_id: number;
  queue_id: number;
  queue_room_name: string;
  queue_room_id: number;
  service_name: string;
  patient_uuid: string;
  uuid: string;
  person_id: number;
  gender: string;
  birthdate: string;
  age: number;
  person_name: string;
  identifiers: string;
  phone_number: string;
  served_status: string;
};

export type ServiceQueueDailyPatientListReportResp = {
  schemas: any;
  sqlQuery: string;
  size: number;
  results: {
    results: ServiceQueueReportPatientList[];
  };
};

export type OrderAction = 'NEW';
export type OrderUrgency = 'ROUTINE';
export type Order = {
  action: OrderAction;
  type: string;
  patient: string;
  careSetting: string;
  orderer: string;
  encounter: string;
  concept: string;
  accessionNumber: string;
  urgency: OrderUrgency;
  scheduledDate: null;
};

export type CreateOrderEncounterDto = {
  patient: string;
  location: string;
  encounterType: string;
  visit: string;
  obs: any[];
  orders: Order[];
};
