/**
 * Provider claim statuses, grouped the way the HIE documents them.
 * https://hie-docs.dha.go.ke/docs/claims/guides/understandingClaimStatuses
 *
 * Only the provider claim's two fields are modelled here — `workflow_state` (where the
 * claim is in its lifecycle) and `claim_auth_status` (whether the visit itself is
 * authorised). The payer-side outcomes (PAID, APPROVED, REJECTED…) live on the payer
 * claim, which this app never fetches, so nothing here should be read as a financial
 * result.
 */

/** Phase 1 — Preparation. The claim has not yet left our system. */
export const PREPARATION_STATES = [
  'DRAFT',
  'PENDING',
  'SUBMISSION_READY',
  'ON_HOLD',
  'TIME_BARRED',
] as const;

/** Phase 2 — Submission & dispatch. The hand-off to the payer. */
export const SUBMISSION_STATES = ['SUBMITTED', 'DISPATCHED', 'FAILED_TO_SUBMIT'] as const;

/** Phase 3 — Payer processing & feedback, including the states handed back to us. */
export const PAYER_STATES = [
  'SUBMITTED_PAYER',
  'AUTOMATIC_CHECKS_DONE',
  'DRAFT_RESUBMIT',
  'DRAFT_RESUBMIT_DOCUMENTS',
] as const;

/** Phase 4 — Final outcomes. */
export const FINAL_STATES = ['CLOSED'] as const;

export type ClaimWorkflowPhase = 'preparation' | 'submission' | 'payer' | 'final' | 'unknown';

const normalise = (value?: string): string => (value ?? '').trim().toUpperCase();

const PHASE_BY_STATE = new Map<string, ClaimWorkflowPhase>([
  ...PREPARATION_STATES.map((s) => [s, 'preparation'] as const),
  ...SUBMISSION_STATES.map((s) => [s, 'submission'] as const),
  ...PAYER_STATES.map((s) => [s, 'payer'] as const),
  ...FINAL_STATES.map((s) => [s, 'final'] as const),
]);

export function getClaimWorkflowPhase(workflowState?: string): ClaimWorkflowPhase {
  return PHASE_BY_STATE.get(normalise(workflowState)) ?? 'unknown';
}

/**
 * States in which the claim's clinical content — billing lines and diagnoses — can
 * still be changed.
 *
 * DRAFT is the obvious one. DRAFT_RESUBMIT matters just as much: it is the state a
 * claim enters when it has been pulled back to answer a payer clarification, and the
 * docs describe it as editable. Treating only DRAFT as open would lock the very claims
 * that were handed back to be corrected.
 */
const CONTENT_EDITABLE_STATES = new Set<string>(['DRAFT', 'DRAFT_RESUBMIT']);

/**
 * States that accept attachments. A superset of the above: DRAFT_RESUBMIT_DOCUMENTS
 * exists specifically so missing documents can be supplied, without reopening the
 * lines and diagnoses.
 */
const DOCUMENT_EDITABLE_STATES = new Set<string>([...CONTENT_EDITABLE_STATES, 'DRAFT_RESUBMIT_DOCUMENTS']);

/**
 * Whether billing lines and diagnoses can still be added to this claim.
 *
 * An unrecognised or empty state answers `false`. Callers should already be holding
 * back while the claim is still loading; once it has arrived, a state we cannot place
 * is not a licence to offer writes the payer will refuse.
 */
export function canEditClaimContent(workflowState?: string): boolean {
  return CONTENT_EDITABLE_STATES.has(normalise(workflowState));
}

/** Whether attachments can still be added to this claim. */
export function canEditClaimDocuments(workflowState?: string): boolean {
  return DOCUMENT_EDITABLE_STATES.has(normalise(workflowState));
}

/** Whether the claim can still be submitted or closed from here. */
export function canDispatchClaim(workflowState?: string): boolean {
  const state = normalise(workflowState);
  return CONTENT_EDITABLE_STATES.has(state) || state === 'SUBMISSION_READY' || state === 'FAILED_TO_SUBMIT';
}

/**
 * Tag colour for any claim, invoice, dispatch or authorisation status.
 *
 * green   settled and healthy — authorised, checked, dispatched, paid
 * red     needs attention — rejected, expired, timed out, failed
 * blue    in flight — being prepared, submitted, or awaiting a payer decision
 * gray    dormant — closed, held, or a status we don't recognise
 */
export function claimStatusTagType(value?: string): 'green' | 'red' | 'blue' | 'gray' {
  switch (normalise(value)) {
    // Healthy, settled states.
    case 'AUTHORIZED':
    case 'AUTHORIZED_PENDING_VISIT':
    case 'AUTHORIZED_MULTISESSION':
    case 'EMERGENCY_AUTHORIZED':
    case 'AUTOMATIC_CHECKS_DONE':
    case 'DISPATCHED':
    case 'APPROVED':
    case 'PAID':
    case 'VALID':
      return 'green';

    // Problem states needing someone to act.
    case 'REJECTED':
    case 'EXPIRED':
    case 'FAILED_TO_SUBMIT':
    case 'FAILED':
    case 'TIME_BARRED':
    case 'INVALID':
    case 'CANCELLED':
      return 'red';

    // In flight, nothing to do but wait or finish preparing.
    case 'DRAFT':
    case 'PENDING':
    case 'SUBMISSION_READY':
    case 'SUBMITTED':
    case 'SUBMITTED_PAYER':
    case 'SUBMITTED_CLAIM':
    case 'DRAFT_RESUBMIT':
    case 'DRAFT_RESUBMIT_DOCUMENTS':
      return 'blue';

    // Dormant: CLOSED, ON_HOLD and anything unrecognised.
    default:
      return 'gray';
  }
}

/** "DRAFT_RESUBMIT" -> "Draft resubmit", for display beside the raw code. */
export function humaniseClaimStatus(value?: string): string {
  const spaced = normalise(value).replace(/_/g, ' ').trim().toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}
