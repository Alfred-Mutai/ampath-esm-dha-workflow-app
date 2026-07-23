/**
 * Consultation clearance — links the triage queue to accounts.
 *
 * When a visit starts and the patient joins the triage/walk-in queue, a
 * consultation bill is raised here. The patient sits in the queue "Awaiting
 * clearance" until the fee is settled (cash) — or is auto-cleared when exempt.
 * Once cleared, they can be called from the queue.
 *
 * DEMO STUB: an in-memory store shared across the registry and billing screens.
 * Replace createConsultationClearance with the real bill-creation call and the
 * getters with your billing/queue read endpoints.
 */

export type ClearanceStatus = 'AWAITING_PAYMENT' | 'CLEARED';

export interface ConsultationClearance {
  id: string;
  patientName: string;
  crNumber: string;
  locationUuid: string;
  queue: string; // triage / walk-in room
  visitType: string;
  payer: string; // Cash | Exempt | SHA | <insurer>
  amount: number;
  status: ClearanceStatus;
  createdAt: string;
}

/** Standard consultation fee (demo). Replace with the billable-service price. */
export const CONSULTATION_FEE = 1500;

// DEMO persistence: kept in localStorage so records survive the full-page
// redirect from registration to the triage queue / accounting screens.
const STORAGE_KEY = 'dha_consultation_clearance';

function load(): ConsultationClearance[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as ConsultationClearance[];
  } catch {
    return [];
  }
}

function save(records: ConsultationClearance[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface CreateClearanceInput {
  patientName: string;
  crNumber: string;
  locationUuid: string;
  queue: string;
  visitType: string;
  payer: string;
  exempt: boolean;
  /** Already settled (e.g. a prepaid return visit) — clears without a new fee. */
  preCleared?: boolean;
  amountOverride?: number;
}

/** Raise the consultation bill when the visit starts. Exempt/prepaid patients clear immediately. */
export function createConsultationClearance(input: CreateClearanceInput): ConsultationClearance {
  const cleared = input.exempt || input.preCleared;
  const record: ConsultationClearance = {
    id: `cc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientName: input.patientName,
    crNumber: input.crNumber,
    locationUuid: input.locationUuid,
    queue: input.queue,
    visitType: input.visitType,
    payer: input.payer,
    amount: input.preCleared ? input.amountOverride ?? 0 : input.exempt ? 0 : CONSULTATION_FEE,
    status: cleared ? 'CLEARED' : 'AWAITING_PAYMENT',
    createdAt: new Date().toISOString(),
  };
  save([record, ...load()]);
  return record;
}

/* ---- Prepaid / scheduled services (paid today, delivered on a return visit) ---- */

export type PrepaidStatus = 'OPEN' | 'FULFILLED';

export interface PrepaidService {
  id: string;
  crNumber: string;
  patientName: string;
  locationUuid: string;
  service: string;
  amount: number;
  payer: string;
  paidOn: string;
  dueDate: string;
  status: PrepaidStatus;
}

const PREPAID_KEY = 'dha_prepaid_services';

function loadPrepaid(): PrepaidService[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return JSON.parse(window.localStorage.getItem(PREPAID_KEY) ?? '[]') as PrepaidService[];
  } catch {
    return [];
  }
}

function savePrepaid(records: PrepaidService[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(PREPAID_KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

export interface AddPrepaidInput {
  crNumber: string;
  patientName: string;
  locationUuid: string;
  service: string;
  amount: number;
  payer: string;
  dueDate: string;
}

/** Record a service paid for today but delivered on a later visit. */
export function addPrepaidService(input: AddPrepaidInput): PrepaidService {
  const record: PrepaidService = {
    id: `pp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    crNumber: input.crNumber,
    patientName: input.patientName,
    locationUuid: input.locationUuid,
    service: input.service,
    amount: input.amount,
    payer: input.payer,
    paidOn: new Date().toISOString(),
    dueDate: input.dueDate,
    status: 'OPEN',
  };
  savePrepaid([record, ...loadPrepaid()]);
  return record;
}

export async function getPrepaidServices(status?: PrepaidStatus, locationUuid?: string): Promise<PrepaidService[]> {
  await wait(200);
  return loadPrepaid()
    .filter((p) => (!status || p.status === status) && (!locationUuid || p.locationUuid === locationUuid))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

/** Find an open prepaid service for a patient (consumed on their return visit). */
export function findOpenPrepaidService(crNumber: string): PrepaidService | undefined {
  return loadPrepaid().find((p) => p.crNumber === crNumber && p.status === 'OPEN');
}

/** Mark a prepaid service delivered — done when the return visit starts. */
export function fulfillPrepaidService(id: string): void {
  savePrepaid(loadPrepaid().map((p) => (p.id === id ? { ...p, status: 'FULFILLED' } : p)));
}

export async function getConsultationClearances(
  status?: ClearanceStatus,
  locationUuid?: string,
): Promise<ConsultationClearance[]> {
  await wait(250);
  return load()
    .filter((r) => (!status || r.status === status) && (!locationUuid || r.locationUuid === locationUuid))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getClearanceCounts(
  locationUuid?: string,
  date?: string,
): Promise<{ awaiting: number }> {
  await wait(50);
  // Filter by date (createdAt) so the tab counts match the date-filtered tables.
  const scoped = load().filter(
    (r) =>
      (!locationUuid || r.locationUuid === locationUuid) &&
      (!date || new Date(r.createdAt).toLocaleDateString('en-CA') === date),
  );
  // Awaiting payment is the CASH queue (SHA is cleared under Pending clearance),
  // so the count must exclude SHA payers to match the rows shown in the table.
  return {
    awaiting: scoped.filter((r) => r.status === 'AWAITING_PAYMENT' && !/sha|shif/i.test(r.payer)).length,
  };
}

/** Mark the consultation fee paid — releases the patient to be seen at the queue. */
export async function clearConsultation(id: string): Promise<void> {
  await wait(300);
  save(load().map((r) => (r.id === id ? { ...r, status: 'CLEARED' } : r)));
}
