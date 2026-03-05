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
