/**
 * SHA claims accounting — claim lifecycle data layer.
 *
 * NOTE: These are DEMO STUBS so the accounting tabs can be clicked end-to-end.
 * Replace each call with the real DHA/HIE eClaims endpoints when wiring the
 * backend (see the SHA integration architecture note):
 *   - list         -> your ETL/claims store, filtered by status
 *   - recall       -> POST /api/v1/claims/close (or your recall endpoint)
 *   - resubmit     -> POST /api/v1/claims/resubmit
 *   - preview      -> POST /api/v1/claims/preview
 */

export type ClaimStatus =
  | 'DRAFT'
  | 'PREAUTH_PENDING'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECALLED'
  | 'PAID';

export type ClaimFund = 'SHIF' | 'UHC' | 'ECCIF';
export type ClaimServiceType = 'OUTPATIENT' | 'INPATIENT';

export interface ClaimLine {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tariff: number;
}

export interface ClaimDiagnosis {
  icd11Code: string;
  display: string;
}

/** The internal bill married to a claim — SHA slice + copay slice of the charge. */
export interface ClaimBill {
  billNo: string;
  totalCharge: number;
  shaCovered: number;
  copay: number;
  copayPayer?: string; // Cash | <insurer>
  document: string; // copay receipt (if copay) or SHA invoice (if fully covered)
}

export interface ClaimEvent {
  at: string;
  label: string;
  by?: string;
}

export interface ShaClaim {
  id: string;
  claimCode: string;
  patientName: string;
  crNumber: string;
  fund: ClaimFund;
  serviceType: ClaimServiceType;
  interventions: string[];
  amount: number;
  status: ClaimStatus;
  updatedAt: string;
  rejectionReason?: string;
  remittanceRef?: string;
  paidAmount?: number;
  lines: ClaimLine[];
  diagnoses?: ClaimDiagnosis[];
  attachments?: string[];
  bill?: ClaimBill;
  timeline: ClaimEvent[];
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const KES = (n: number) => n;

// In-memory demo claims covering every lifecycle state, so each tab has content.
let CLAIMS: ShaClaim[] = [
  {
    id: 'c-1001',
    claimCode: 'CLM-2026-1001',
    patientName: 'Christian Mkuru Gray',
    crNumber: 'CR4098636401452-9',
    fund: 'SHIF',
    serviceType: 'OUTPATIENT',
    interventions: ['SHA-02-011 · General consultation'],
    amount: KES(1200),
    status: 'DRAFT',
    updatedAt: '2026-07-10T08:15:00',
    lines: [{ code: 'SHA-02-011', description: 'General consultation', quantity: 1, unitPrice: 1200, tariff: 1500 }],
    timeline: [{ at: '2026-07-10T08:15:00', label: 'Claim created', by: 'A. Mutai' }],
  },
  {
    id: 'c-1002',
    claimCode: 'CLM-2026-1002',
    patientName: 'Wanjiru Njeri Kamau',
    crNumber: 'CR7781245900031-4',
    fund: 'SHIF',
    serviceType: 'OUTPATIENT',
    interventions: ['SHA-05-104 · Diagnostic imaging (X-ray)'],
    amount: KES(3500),
    status: 'PREAUTH_PENDING',
    updatedAt: '2026-07-10T09:02:00',
    lines: [{ code: 'SHA-05-104', description: 'Chest X-ray', quantity: 1, unitPrice: 4500, tariff: 3500 }],
    bill: {
      billNo: 'INV-2026-1002',
      totalCharge: 4500,
      shaCovered: 3500,
      copay: 1000,
      copayPayer: 'Cash',
      document: 'cash-copay-receipt.pdf',
    },
    attachments: ['referral-letter.pdf', 'lab-request.pdf'],
    timeline: [
      { at: '2026-07-10T08:40:00', label: 'Claim created', by: 'A. Mutai' },
      { at: '2026-07-10T09:02:00', label: 'Preauth raised — awaiting FINALISED', by: 'A. Mutai' },
    ],
  },
  {
    id: 'c-1003',
    claimCode: 'CLM-2026-1003',
    patientName: 'Otieno Brian Odhiambo',
    crNumber: 'CR3390017764522-1',
    fund: 'SHIF',
    serviceType: 'INPATIENT',
    interventions: ['SHA-01-002 · General ward (per diem)'],
    amount: KES(9000),
    status: 'SUBMITTED',
    updatedAt: '2026-07-09T17:30:00',
    lines: [{ code: 'SHA-01-002', description: 'General ward · 3 days', quantity: 3, unitPrice: 3000, tariff: 3000 }],
    timeline: [
      { at: '2026-07-06T11:00:00', label: 'Claim created', by: 'J. Achieng' },
      { at: '2026-07-09T17:30:00', label: 'Discharged & submitted to SHA', by: 'J. Achieng' },
    ],
  },
  {
    id: 'c-1004',
    claimCode: 'CLM-2026-1004',
    patientName: 'Fatuma Ali Hassan',
    crNumber: 'CR5567234110098-7',
    fund: 'UHC',
    serviceType: 'OUTPATIENT',
    interventions: ['UHC-OP-001 · Primary care (capitation)'],
    amount: KES(800),
    status: 'REJECTED',
    updatedAt: '2026-07-09T14:12:00',
    rejectionReason: 'Diagnosis (ICD-11) does not support the billed intervention. Attach a valid diagnosis and resubmit.',
    lines: [{ code: 'UHC-OP-001', description: 'Primary care visit', quantity: 1, unitPrice: 800, tariff: 800 }],
    attachments: ['referral-letter.pdf', 'lab-request.pdf'],
    timeline: [
      { at: '2026-07-08T10:00:00', label: 'Claim created', by: 'A. Mutai' },
      { at: '2026-07-08T10:20:00', label: 'Submitted to SHA', by: 'A. Mutai' },
      { at: '2026-07-09T14:12:00', label: 'Rejected by payer' },
    ],
  },
  {
    id: 'c-1005',
    claimCode: 'CLM-2026-1005',
    patientName: 'Mwangi Peter Kariuki',
    crNumber: 'CR1123098776541-3',
    fund: 'SHIF',
    serviceType: 'OUTPATIENT',
    interventions: ['SHA-05-220 · Ultrasound'],
    amount: KES(2500),
    status: 'RECALLED',
    updatedAt: '2026-07-10T07:45:00',
    rejectionReason: 'Recalled by accounts to correct the unit price (was above tariff).',
    lines: [{ code: 'SHA-05-220', description: 'Abdominal ultrasound', quantity: 1, unitPrice: 2500, tariff: 3000 }],
    timeline: [
      { at: '2026-07-09T09:00:00', label: 'Claim created', by: 'J. Achieng' },
      { at: '2026-07-09T16:00:00', label: 'Submitted to SHA', by: 'J. Achieng' },
      { at: '2026-07-10T07:45:00', label: 'Recalled for correction', by: 'A. Mutai' },
    ],
  },
  {
    id: 'c-1006',
    claimCode: 'CLM-2026-1006',
    patientName: 'Akinyi Grace Awuor',
    crNumber: 'CR8890123456778-2',
    fund: 'SHIF',
    serviceType: 'OUTPATIENT',
    interventions: ['SHA-02-011 · General consultation'],
    amount: KES(1500),
    status: 'PAID',
    updatedAt: '2026-07-05T12:00:00',
    remittanceRef: 'RMT-2026-0417',
    paidAmount: KES(1500),
    lines: [{ code: 'SHA-02-011', description: 'General consultation', quantity: 1, unitPrice: 1500, tariff: 1500 }],
    bill: {
      billNo: 'INV-2026-1006',
      totalCharge: 1500,
      shaCovered: 1500,
      copay: 0,
      document: 'sha-invoice.pdf',
    },
    timeline: [
      { at: '2026-07-01T09:00:00', label: 'Claim created', by: 'A. Mutai' },
      { at: '2026-07-01T09:15:00', label: 'Submitted to SHA', by: 'A. Mutai' },
      { at: '2026-07-05T12:00:00', label: 'Paid · remittance RMT-2026-0417' },
    ],
  },
  {
    id: 'c-1007',
    claimCode: 'CLM-2026-1007',
    patientName: 'Kiptoo Daniel Rono',
    crNumber: 'CR2245098331120-6',
    fund: 'SHIF',
    serviceType: 'OUTPATIENT',
    interventions: ['SHA-05-104 · Diagnostic imaging (X-ray)'],
    amount: KES(3800),
    status: 'APPROVED',
    updatedAt: '2026-07-09T18:05:00',
    lines: [{ code: 'SHA-05-104', description: 'Chest X-ray', quantity: 1, unitPrice: 3800, tariff: 4000 }],
    timeline: [
      { at: '2026-07-09T15:00:00', label: 'Claim created', by: 'A. Mutai' },
      { at: '2026-07-09T15:20:00', label: 'Submitted to SHA', by: 'A. Mutai' },
      { at: '2026-07-09T18:05:00', label: 'Approved by payer — awaiting remittance' },
    ],
  },
  {
    id: 'c-1008',
    claimCode: 'CLM-2026-1008',
    patientName: 'Naliaka Sarah Wekesa',
    crNumber: 'CR6634128870094-8',
    fund: 'SHIF',
    serviceType: 'INPATIENT',
    interventions: ['SHA-01-002 · General ward (per diem)'],
    amount: KES(6000),
    status: 'PAID',
    updatedAt: '2026-07-05T12:00:00',
    remittanceRef: 'RMT-2026-0417',
    paidAmount: KES(6000),
    lines: [{ code: 'SHA-01-002', description: 'General ward · 2 days', quantity: 2, unitPrice: 3000, tariff: 3000 }],
    timeline: [
      { at: '2026-06-30T10:00:00', label: 'Claim created', by: 'J. Achieng' },
      { at: '2026-07-02T09:00:00', label: 'Discharged & submitted to SHA', by: 'J. Achieng' },
      { at: '2026-07-05T12:00:00', label: 'Paid · remittance RMT-2026-0417' },
    ],
  },
  {
    id: 'c-1009',
    claimCode: 'CLM-2026-1009',
    patientName: 'Mumo Esther Nduku',
    crNumber: 'CR9910223344556-0',
    fund: 'UHC',
    serviceType: 'OUTPATIENT',
    interventions: ['UHC-OP-001 · Primary care (capitation)'],
    amount: KES(800),
    status: 'PAID',
    updatedAt: '2026-07-07T14:30:00',
    remittanceRef: 'RMT-2026-0421',
    paidAmount: KES(800),
    lines: [{ code: 'UHC-OP-001', description: 'Primary care visit', quantity: 1, unitPrice: 800, tariff: 800 }],
    timeline: [
      { at: '2026-07-03T09:00:00', label: 'Claim created', by: 'A. Mutai' },
      { at: '2026-07-03T09:10:00', label: 'Submitted to SHA', by: 'A. Mutai' },
      { at: '2026-07-07T14:30:00', label: 'Paid · remittance RMT-2026-0421' },
    ],
  },
];

/**
 * Claim lifecycle tabs, ordered as a workflow: a claim is drafted, submitted and
 * sits Pending a payer decision, then lands in Approved (awaiting remittance),
 * Rejected (payer declined) or Needs resubmission (recalled to correct), and finally
 * Paid once a remittance settles it. Each tab maps to one or more claim statuses.
 */
export const CLAIM_TABS: { key: string; label: string; statuses: ClaimStatus[] }[] = [
  { key: 'draft', label: 'Drafts', statuses: ['DRAFT'] },
  { key: 'pending', label: 'Pending', statuses: ['PREAUTH_PENDING', 'SUBMITTED'] },
  { key: 'approved', label: 'Approved', statuses: ['APPROVED'] },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
  { key: 'resubmission', label: 'Needs resubmission', statuses: ['RECALLED'] },
  { key: 'remittances', label: 'Paid', statuses: ['PAID'] },
];

export async function getClaimsByStatuses(statuses: ClaimStatus[]): Promise<ShaClaim[]> {
  await wait(300);
  return CLAIMS.filter((c) => statuses.includes(c.status)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getClaimCounts(): Promise<Record<string, number>> {
  await wait(50);
  const counts: Record<string, number> = {};
  for (const tab of CLAIM_TABS) {
    counts[tab.key] = CLAIMS.filter((c) => tab.statuses.includes(c.status)).length;
  }
  return counts;
}

/** Insert a claim built by the claim-creation workspace into the store. */
export function pushClaim(claim: ShaClaim): void {
  CLAIMS = [claim, ...CLAIMS];
}

/** GET claims paid by a given remittance. */
export async function getClaimsPaidByRemittance(ref: string): Promise<ShaClaim[]> {
  await wait(250);
  return CLAIMS.filter((c) => c.remittanceRef === ref);
}

/** Recall a submitted claim so it can be corrected and resubmitted. */
export async function recallClaim(id: string, reason: string): Promise<void> {
  await wait(400);
  CLAIMS = CLAIMS.map((c) =>
    c.id === id
      ? {
          ...c,
          status: 'RECALLED',
          rejectionReason: reason || 'Recalled by accounts for correction.',
          updatedAt: new Date().toISOString(),
          timeline: [...c.timeline, { at: new Date().toISOString(), label: 'Recalled for correction', by: 'You' }],
        }
      : c,
  );
}

/** Resubmit a recalled or rejected claim after corrections. */
export async function resubmitClaim(id: string, note: string): Promise<void> {
  await wait(500);
  CLAIMS = CLAIMS.map((c) =>
    c.id === id
      ? {
          ...c,
          status: 'SUBMITTED',
          rejectionReason: undefined,
          updatedAt: new Date().toISOString(),
          timeline: [
            ...c.timeline,
            { at: new Date().toISOString(), label: `Resubmitted to SHA${note ? ` — ${note}` : ''}`, by: 'You' },
          ],
        }
      : c,
  );
}
