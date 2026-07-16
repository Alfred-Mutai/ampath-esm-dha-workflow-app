/**
 * Cash payments — bills payable at the cash point before service.
 *
 * A bill stays OPEN while services keep adding line items. Each item can be paid
 * in full or in part (never over its balance); every payment is recorded with a
 * receipt. When there is no balance the bill can be CLOSED, which marks it Paid.
 * Covers pure cash clients and the SHA copay slice a SHA patient settles in cash.
 *
 * DEMO STUB: in-memory store. Replace with the real cashier bill + line-item
 * payment endpoints when wiring the backend.
 */
import { getClaimsByStatuses } from '../claims-accounting/claims-accounting.resource';
import { splitBillForSha } from '../claims-accounting/bill-utils';

export type BillSource = 'CASH' | 'SHA_COPAY';
export type LineStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type BillStatus = 'OPEN' | 'PARTIAL' | 'SETTLED' | 'PAID';

export interface BillLineItem {
  id: string;
  service: string; // Consultation, Laboratory, Pharmacy, Radiology…
  code: string;
  amount: number;
  paidAmount: number;
}

export type PaymentMethod = 'M-Pesa' | 'SHA' | 'Cash';

export interface PaymentEntry {
  id: string;
  itemId: string;
  service: string;
  amount: number;
  method: PaymentMethod;
  /** M-Pesa transaction reference (entered manually pre-integration). */
  reference?: string;
  receiptNo: string;
  at: string;
}

export interface CashBill {
  id: string;
  billNo: string;
  patientName: string;
  crNumber: string;
  locationUuid: string;
  date: string; // yyyy-mm-dd
  source: BillSource;
  claimCode?: string;
  closed: boolean;
  lineItems: BillLineItem[];
  payments: PaymentEntry[];
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const TODAY = new Date().toLocaleDateString('en-CA');

let receiptSeq = 4100;
const nextReceiptNo = () => `RCT-2026-${(receiptSeq += 1)}`;

export const itemBalance = (i: BillLineItem) => i.amount - i.paidAmount;

export function itemStatus(i: BillLineItem): LineStatus {
  if (i.paidAmount <= 0) return 'UNPAID';
  if (i.paidAmount >= i.amount) return 'PAID';
  return 'PARTIAL';
}

export const billBalance = (b: CashBill) => b.lineItems.reduce((sum, i) => sum + itemBalance(i), 0);
export const billPaid = (b: CashBill) => b.lineItems.reduce((sum, i) => sum + i.paidAmount, 0);
export const billTotal = (b: CashBill) => b.lineItems.reduce((sum, i) => sum + i.amount, 0);

export function billStatus(b: CashBill): BillStatus {
  if (b.closed) return 'PAID';
  if (billBalance(b) === 0) return 'SETTLED'; // fully paid, open — ready to close
  if (billPaid(b) > 0) return 'PARTIAL';
  return 'OPEN';
}

type CashBillSeed = Omit<CashBill, 'source'>;

// SHA copays settled at the cash point this session (demo persistence).
const copayState = new Map<string, { paidAmount: number; payments: PaymentEntry[]; closed: boolean }>();

let CASH_BILLS: CashBillSeed[] = [
  {
    id: 'cb-1',
    billNo: 'CASH-2026-0001',
    patientName: 'James Otieno Onyango',
    crNumber: 'CR4471290083321-5',
    locationUuid: '',
    date: TODAY,
    closed: false,
    lineItems: [
      { id: 'cb-1-1', service: 'Consultation', code: 'SVC-CONS', amount: 500, paidAmount: 500 },
      { id: 'cb-1-2', service: 'Laboratory · Full haemogram', code: 'LAB-CBC', amount: 800, paidAmount: 0 },
      { id: 'cb-1-3', service: 'Pharmacy · Dispensing', code: 'PHA-DISP', amount: 350, paidAmount: 0 },
    ],
    payments: [
      { id: 'p-cb-1-1', itemId: 'cb-1-1', service: 'Consultation', amount: 500, method: 'M-Pesa', reference: 'SFH3Q9K1AA', receiptNo: 'RCT-2026-4001', at: `${TODAY}T08:12:00` },
    ],
  },
  {
    id: 'cb-2',
    billNo: 'CASH-2026-0002',
    patientName: 'Mary Wanjiku Njoroge',
    crNumber: 'CR9982130045567-1',
    locationUuid: '',
    date: TODAY,
    closed: false,
    lineItems: [
      { id: 'cb-2-1', service: 'Consultation', code: 'SVC-CONS', amount: 500, paidAmount: 0 },
      { id: 'cb-2-2', service: 'Radiology · Chest X-ray', code: 'RAD-CXR', amount: 1200, paidAmount: 0 },
    ],
    payments: [],
  },
  {
    id: 'cb-3',
    billNo: 'CASH-2026-0003',
    patientName: 'Peter Kamau Mwangi',
    crNumber: 'CR1120983344215-7',
    locationUuid: '',
    date: TODAY,
    closed: true,
    lineItems: [
      { id: 'cb-3-1', service: 'Consultation', code: 'SVC-CONS', amount: 500, paidAmount: 500 },
      { id: 'cb-3-2', service: 'Laboratory · Malaria RDT', code: 'LAB-MRDT', amount: 300, paidAmount: 300 },
    ],
    payments: [
      { id: 'p-cb-3-1', itemId: 'cb-3-1', service: 'Consultation', amount: 500, method: 'M-Pesa', reference: 'SFH3Q9K2BB', receiptNo: 'RCT-2026-4002', at: `${TODAY}T07:41:00` },
      { id: 'p-cb-3-2', itemId: 'cb-3-2', service: 'Laboratory · Malaria RDT', amount: 300, method: 'M-Pesa', reference: 'SFH3Q9K3CC', receiptNo: 'RCT-2026-4003', at: `${TODAY}T07:55:00` },
    ],
  },
];

const clone = (b: CashBillSeed): CashBill => ({
  ...b,
  source: 'CASH',
  lineItems: b.lineItems.map((i) => ({ ...i })),
  payments: b.payments.map((p) => ({ ...p })),
});

/** Pure cash bills (patient pays every line before service). */
export async function getCashBills(_locationUuid?: string): Promise<CashBill[]> {
  await wait(200);
  return CASH_BILLS.map(clone);
}

/** The copay slice of SHA claims — the cash portion settled at the cash point. */
export async function getCopayBills(): Promise<CashBill[]> {
  const claims = await getClaimsByStatuses([
    'DRAFT',
    'PREAUTH_PENDING',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'RECALLED',
    'PAID',
  ]);
  return claims
    .map((c) => ({ c, copay: c.bill?.copay ?? splitBillForSha(c.lines).copay }))
    .filter(({ copay }) => copay > 0)
    .map(({ c, copay }) => {
      const itemId = `copay-${c.id}`;
      const state = copayState.get(itemId) ?? { paidAmount: 0, payments: [], closed: false };
      return {
        id: `copaybill-${c.id}`,
        billNo: c.bill?.billNo ?? c.claimCode.replace('CLM', 'INV'),
        patientName: c.patientName,
        crNumber: c.crNumber,
        locationUuid: '',
        date: TODAY,
        source: 'SHA_COPAY' as const,
        claimCode: c.claimCode,
        closed: state.closed,
        lineItems: [{ id: itemId, service: `SHA copay · ${c.fund}`, code: c.claimCode, amount: copay, paidAmount: state.paidAmount }],
        payments: state.payments.map((p) => ({ ...p })),
      };
    });
}

/** Every payable-at-cash-point bill: pure cash + SHA copays. */
export async function getPayableBills(locationUuid?: string): Promise<CashBill[]> {
  const [cash, copay] = await Promise.all([getCashBills(locationUuid), getCopayBills()]);
  return [...cash, ...copay].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface PayInput {
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

/** Pay an amount against a bill line item (partial allowed, never over its balance). */
export async function payItem(billId: string, itemId: string, input: PayInput): Promise<PaymentEntry> {
  await wait(300);
  const now = new Date().toISOString();
  const receiptNo = nextReceiptNo();
  const { method, reference } = input;

  if (itemId.startsWith('copay-')) {
    const state = copayState.get(itemId) ?? { paidAmount: 0, payments: [], closed: false };
    const entry: PaymentEntry = { id: `p-${receiptNo}`, itemId, service: 'SHA copay', amount: input.amount, method, reference, receiptNo, at: now };
    copayState.set(itemId, { ...state, paidAmount: state.paidAmount + input.amount, payments: [...state.payments, entry] });
    return entry;
  }

  let entry: PaymentEntry | undefined;
  CASH_BILLS = CASH_BILLS.map((b) => {
    if (b.id !== billId) {
      return b;
    }
    const item = b.lineItems.find((i) => i.id === itemId);
    if (!item) {
      return b;
    }
    const amount = Math.min(input.amount, itemBalance(item));
    entry = { id: `p-${receiptNo}`, itemId, service: item.service, amount, method, reference, receiptNo, at: now };
    return {
      ...b,
      lineItems: b.lineItems.map((i) => (i.id === itemId ? { ...i, paidAmount: i.paidAmount + amount } : i)),
      payments: [...b.payments, entry as PaymentEntry],
    };
  });
  return entry ?? { id: `p-${receiptNo}`, itemId, service: '', amount: 0, method, reference, receiptNo, at: now };
}

/** Close a fully-settled bill — marks it Paid and stops new items being added. */
export async function closeBill(billId: string): Promise<void> {
  await wait(250);
  if (billId.startsWith('copaybill-')) {
    const itemId = billId.replace('copaybill-', 'copay-');
    const state = copayState.get(itemId) ?? { paidAmount: 0, payments: [], closed: false };
    copayState.set(itemId, { ...state, closed: true });
    return;
  }
  CASH_BILLS = CASH_BILLS.map((b) =>
    b.id === billId && b.lineItems.reduce((s, i) => s + (i.amount - i.paidAmount), 0) === 0 ? { ...b, closed: true } : b,
  );
}
