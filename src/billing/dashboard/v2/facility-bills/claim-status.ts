/**
 * SHA / DHA eClaims status vocabulary for the facility-bills tabs.
 *
 * The claim lifecycle extends the codebase's original ClaimStatus set with the states
 * seen in live claim data (AUTHORIZED, VALID, DISPATCHED) and the terminal states a
 * claim/preauth can reach (CANCELLED, EXPIRED). Payment statuses (PENDING / PARTIALLY
 * PAID / PAID) are the cash side and get their own list.
 */

type TagType = 'gray' | 'blue' | 'green' | 'teal' | 'red' | 'magenta' | 'purple' | 'cyan' | 'warm-gray';

// Full SHA claim lifecycle, in workflow order. The provider workflow_state values come
// from the HIE's own phase grouping —
// https://hie-docs.dha.go.ke/docs/claims/guides/understandingClaimStatuses — and the
// rest are values this codebase already saw in live bill and preauth data.
export const CLAIM_STATUSES = [
  // Phase 1 — preparation, still ours to change.
  'DRAFT',
  'PENDING',
  'SUBMISSION_READY',
  'ON_HOLD',
  'TIME_BARRED',
  // Phase 2 — submission & dispatch.
  'SUBMITTED',
  'DISPATCHED',
  'FAILED_TO_SUBMIT',
  // Phase 3 — with the payer, including what it hands back.
  'SUBMITTED_PAYER',
  'AUTOMATIC_CHECKS_DONE',
  'DRAFT_RESUBMIT',
  'DRAFT_RESUBMIT_DOCUMENTS',
  // Phase 4 — final.
  'CLOSED',
  // Seen in live data / carried over from the earlier vocabulary.
  'PREAUTH_PENDING',
  'AUTHORIZED',
  'APPROVED',
  'VALID',
  'REJECTED',
  'RECALLED',
  'PAID',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// Preauthorisation lifecycle.
export const PREAUTH_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const;
export type PreauthStatus = (typeof PREAUTH_STATUSES)[number];

// Cash-side payment statuses (derived from a bill's paid_status).
export const PAYMENT_STATUSES = ['PENDING', 'PARTIALLY PAID', 'PAID'] as const;

/** A status sub-tab grouping one or more raw statuses under a single label. */
export interface StatusBucket {
  key: string;
  label: string;
  statuses: string[];
}

/**
 * SHA claim buckets. A SHA bill takes its status from the matched claim's
 * `workflow_state`, so every value the HIE can return has to land in exactly one bucket
 * — a status in none of them makes the bill disappear from every sub-tab.
 *
 * The buckets follow the HIE's own phases, folded into the labels this page already
 * uses: preparation → Drafts, submission and payer receipt → Submitted, checks passed →
 * Approved, anything handed back to us → Needs resubmission, and the terminal states →
 * Closed.
 */
export const CLAIM_BUCKETS: StatusBucket[] = [
  {
    key: 'draft',
    label: 'Drafts',
    // Phase 1: still ours, not yet dispatched.
    statuses: ['DRAFT', 'PENDING', 'SUBMISSION_READY', 'ON_HOLD'],
  },
  {
    key: 'submitted',
    label: 'Submitted',
    // Phase 2 and the payer's acknowledgement of receipt. DISPATCHED sits here rather
    // than under Approved: it means forwarded to the payer, not adjudicated.
    statuses: ['SUBMITTED', 'DISPATCHED', 'SUBMITTED_PAYER', 'AUTHORIZED'],
  },
  {
    key: 'approved',
    label: 'Approved',
    statuses: ['AUTOMATIC_CHECKS_DONE', 'APPROVED', 'VALID'],
  },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
  {
    key: 'resubmission',
    label: 'Needs resubmission',
    // Everything sitting back with us to fix — a payer clarification, a missing
    // document, or a dispatch that never went through.
    statuses: ['DRAFT_RESUBMIT', 'DRAFT_RESUBMIT_DOCUMENTS', 'FAILED_TO_SUBMIT', 'RECALLED'],
  },
  { key: 'paid', label: 'Paid', statuses: ['PAID'] },
  {
    key: 'closed',
    label: 'Closed',
    statuses: ['CLOSED', 'CANCELLED', 'EXPIRED', 'TIME_BARRED'],
  },
];

// Preauthorisation buckets — shown under the Preauths tab (HIE preview statuses).
export const PREAUTH_BUCKETS: StatusBucket[] = [
  {
    key: 'pending',
    label: 'Pending',
    // Awaiting doctor SMS approval (and other not-yet-payer-review states).
    statuses: [
      'PENDING_DOCTOR_APPROVAL',
      'DOCTOR_REQUEST_SENT',
      'DOCTOR_REQUEST_FAILED',
      'DRAFT',
      'PREAUTH_PENDING',
    ],
  },
  {
    key: 'submitted',
    label: 'Submitted',
    // Doctor approved; with payer for review.
    statuses: ['ACTIVE', 'SUBMITTED', 'PENDING'],
  },
  {
    key: 'approved',
    label: 'Approved',
    statuses: ['FINALISED', 'FINALIZED', 'APPROVED'],
  },
  {
    key: 'rejected',
    label: 'Rejected',
    statuses: ['REJECTED', 'DECLINED', 'FAILED'],
  },
  {
    key: 'resubmission',
    label: 'Needs resubmission',
    statuses: ['RECALLED', 'PENDING_CLARIFICATION'],
  },
  {
    key: 'closed',
    label: 'Closed',
    statuses: ['CANCELLED', 'EXPIRED'],
  },
];

/** Which Preauthorizations bucket a HIE preview status belongs to. */
export function preauthBucketKeyForStatus(status: string): string {
  const s = (status || '').trim().toUpperCase();
  for (const bucket of PREAUTH_BUCKETS) {
    if (bucket.statuses.some((x) => x.toUpperCase() === s)) {
      return bucket.key;
    }
  }
  return 'pending';
}

// Cash-side payment buckets. Partially paid bills sit under Pending (still owing).
export const PAYMENT_BUCKETS: StatusBucket[] = [
  { key: 'pending', label: 'Pending', statuses: ['PENDING', 'PARTIALLY PAID', 'POSTED'] },
  { key: 'paid', label: 'Paid', statuses: ['PAID'] },
];

/**
 * Buckets for the "All bills" tab, which lists both payers together. A bill's status
 * comes from whichever side settles it — a claim's workflow_state for SHA, the payment
 * status for cash — so that tab has to recognise both vocabularies or the rows whose
 * status it doesn't cover drop out of every bucket.
 *
 * Claim buckets lead, since they're the longer journey; buckets sharing a key (Paid)
 * merge their statuses rather than appearing twice.
 */
export const ALL_BILL_BUCKETS: StatusBucket[] = (() => {
  const byKey = new Map<string, StatusBucket>();
  for (const bucket of [...CLAIM_BUCKETS, ...PAYMENT_BUCKETS]) {
    const existing = byKey.get(bucket.key);
    byKey.set(
      bucket.key,
      existing
        ? { ...existing, statuses: Array.from(new Set([...existing.statuses, ...bucket.statuses])) }
        : { ...bucket },
    );
  }
  return Array.from(byKey.values());
})();

/** Human label + Carbon Tag colour for any claim / preauth / payment status. */
export function statusMeta(status: string): { label: string; tag: TagType } {
  switch ((status ?? '').trim().toUpperCase()) {
    // Phase 1 — preparation, still ours.
    case 'DRAFT':
      return { label: 'Draft', tag: 'gray' };
    case 'SUBMISSION_READY':
      return { label: 'Ready to submit', tag: 'cyan' };
    case 'ON_HOLD':
      return { label: 'On hold', tag: 'warm-gray' };
    case 'TIME_BARRED':
      return { label: 'Time barred', tag: 'red' };
    case 'PREAUTH_PENDING':
      return { label: 'Preauth pending', tag: 'purple' };
    // Phase 2 — submission & dispatch.
    case 'SUBMITTED':
      return { label: 'Submitted', tag: 'blue' };
    case 'DISPATCHED':
      return { label: 'Dispatched', tag: 'blue' };
    case 'FAILED_TO_SUBMIT':
      return { label: 'Failed to submit', tag: 'red' };
    // Phase 3 — with the payer, and what it hands back.
    case 'SUBMITTED_PAYER':
      return { label: 'With payer', tag: 'blue' };
    case 'AUTOMATIC_CHECKS_DONE':
      return { label: 'Checks passed', tag: 'teal' };
    case 'DRAFT_RESUBMIT':
      return { label: 'Awaiting resubmission', tag: 'magenta' };
    case 'DRAFT_RESUBMIT_DOCUMENTS':
      return { label: 'Awaiting documents', tag: 'magenta' };
    case 'AUTHORIZED':
      return { label: 'Authorized', tag: 'cyan' };
    case 'APPROVED':
      return { label: 'Approved', tag: 'teal' };
    case 'VALID':
      return { label: 'Valid', tag: 'green' };
    case 'REJECTED':
      return { label: 'Rejected', tag: 'red' };
    case 'RECALLED':
      return { label: 'Recalled', tag: 'magenta' };
    case 'PAID':
      return { label: 'Paid', tag: 'green' };
    // Phase 4 — terminal.
    case 'CLOSED':
      return { label: 'Closed', tag: 'warm-gray' };
    case 'CANCELLED':
      return { label: 'Cancelled', tag: 'warm-gray' };
    case 'EXPIRED':
      return { label: 'Expired', tag: 'red' };
    // Payment (cash) side
    case 'PENDING':
      return { label: 'Pending', tag: 'gray' };
    case 'POSTED':
    case 'PARTIALLY PAID':
      return { label: 'Partially paid', tag: 'teal' };
    default:
      return { label: status || '—', tag: 'gray' };
  }
}
