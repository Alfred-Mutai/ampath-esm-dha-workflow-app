/**
 * SHA / DHA eClaims status vocabulary for the facility-bills tabs.
 *
 * The claim lifecycle extends the codebase's original ClaimStatus set with the states
 * seen in live claim data (AUTHORIZED, VALID, DISPATCHED) and the terminal states a
 * claim/preauth can reach (CANCELLED, EXPIRED). Payment statuses (PENDING / PARTIALLY
 * PAID / PAID) are the cash side and get their own list.
 */

type TagType = 'gray' | 'blue' | 'green' | 'teal' | 'red' | 'magenta' | 'purple' | 'cyan' | 'warm-gray';

// Full SHA claim lifecycle, in workflow order.
export const CLAIM_STATUSES = [
  'DRAFT',
  'PREAUTH_PENDING',
  'SUBMITTED',
  'AUTHORIZED',
  'APPROVED',
  'VALID',
  'DISPATCHED',
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

// SHA claim buckets — mirrors the claims-accounting CLAIM_TABS, with the extra live
// states folded into the nearest bucket. Preauth-only states live in PREAUTH_BUCKETS.
export const CLAIM_BUCKETS: StatusBucket[] = [
  { key: 'draft', label: 'Drafts', statuses: ['DRAFT'] },
  { key: 'submitted', label: 'Submitted', statuses: ['SUBMITTED', 'AUTHORIZED'] },
  { key: 'approved', label: 'Approved', statuses: ['APPROVED', 'VALID', 'DISPATCHED'] },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
  { key: 'resubmission', label: 'Needs resubmission', statuses: ['RECALLED'] },
  { key: 'paid', label: 'Paid', statuses: ['PAID'] },
  { key: 'closed', label: 'Closed', statuses: ['CANCELLED', 'EXPIRED'] },
];

// Preauthorisation buckets — shown under the Preauths tab.
export const PREAUTH_BUCKETS: StatusBucket[] = [
  { key: 'pending', label: 'Pending', statuses: ['PREAUTH_PENDING'] },
  { key: 'submitted', label: 'Submitted', statuses: ['SUBMITTED'] },
  { key: 'approved', label: 'Approved', statuses: ['APPROVED'] },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
  { key: 'resubmission', label: 'Needs resubmission', statuses: ['RECALLED'] },
  { key: 'closed', label: 'Closed', statuses: ['CANCELLED', 'EXPIRED'] },
];

// Cash-side payment buckets. Partially paid bills sit under Pending (still owing).
export const PAYMENT_BUCKETS: StatusBucket[] = [
  { key: 'pending', label: 'Pending', statuses: ['PENDING', 'PARTIALLY PAID', 'POSTED'] },
  { key: 'paid', label: 'Paid', statuses: ['PAID'] },
];

/** Human label + Carbon Tag colour for any claim / preauth / payment status. */
export function statusMeta(status: string): { label: string; tag: TagType } {
  switch ((status ?? '').trim().toUpperCase()) {
    // Claim lifecycle
    case 'DRAFT':
      return { label: 'Draft', tag: 'gray' };
    case 'PREAUTH_PENDING':
      return { label: 'Preauth pending', tag: 'purple' };
    case 'SUBMITTED':
      return { label: 'Submitted', tag: 'blue' };
    case 'AUTHORIZED':
      return { label: 'Authorized', tag: 'cyan' };
    case 'APPROVED':
      return { label: 'Approved', tag: 'teal' };
    case 'VALID':
      return { label: 'Valid', tag: 'green' };
    case 'DISPATCHED':
      return { label: 'Dispatched', tag: 'blue' };
    case 'REJECTED':
      return { label: 'Rejected', tag: 'red' };
    case 'RECALLED':
      return { label: 'Recalled', tag: 'magenta' };
    case 'PAID':
      return { label: 'Paid', tag: 'green' };
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
