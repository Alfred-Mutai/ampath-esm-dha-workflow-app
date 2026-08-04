import React from 'react';
import { CheckmarkFilled, InformationFilled, WarningAltFilled } from '@carbon/react/icons';
import { InlineLoading, Tag, Tooltip } from '@carbon/react';
import { type ClaimsVisit } from '../../types';
import { claimStatusTagType, getClaimWorkflowPhase, humaniseClaimStatus } from '../../claim-statuses';
import styles from './claim-history.component.scss';

interface ClaimHistoryProps {
  claimsVisit: ClaimsVisit;
  /** No live `workflow_state` has arrived yet, so the current entry holds back rather
      than assert the copy stored when the visit was recorded. */
  claimStateUnconfirmed?: boolean;
}

type MilestoneTone = 'done' | 'warning';

interface Milestone {
  /** The chip's own word, kept to one or two so a claim's whole history fits on a line. */
  label: string;
  /** What qualifies it — a count, a retry, an outcome. Rendered dimmed beside the label. */
  note?: string;
  /** The unabbreviated sentence, for the chip's hover title. */
  detail: string;
  tone: MilestoneTone;
}

const PHASE_LABEL: Record<string, string> = {
  preparation: 'Being prepared',
  submission: 'Submission and dispatch',
  payer: 'With the payer',
  final: 'Closed',
};

const CAVEAT =
  'What the claim records having happened. The claims API returns no dates for these, and nothing here says the order they happened in.';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What has happened to this claim, as far as the claim itself evidences it.
 *
 * There is no transition log to read: `/claim-preview/provider` returns the claim's
 * current `workflow_state` and nothing about the states before it. So this is not a
 * progress bar through a fixed lifecycle — claims don't share one path, and a bar would
 * assert steps that never happened. Every chip below is instead derived from a field the
 * claim actually carries, so a claim that skipped a stage simply has no chip for it.
 *
 * It reads as a status line and a row of chips rather than a stacked list because the
 * entries have no order to preserve and no dates to align — being unordered, they lose
 * nothing by wrapping, and the section keeps to two or three lines inside a details pane
 * that has several more sections to get through.
 */
const ClaimHistory: React.FC<ClaimHistoryProps> = ({ claimsVisit, claimStateUnconfirmed }) => {
  if (!claimsVisit) {
    return null;
  }

  const diagnoses = Number(claimsVisit.diagnoses_count ?? 0);
  const attachments = Number(claimsVisit.claim_attachments_count ?? 0);
  const invoiceCount = Number(claimsVisit.number_of_invoices ?? 0);
  const retries = Number(claimsVisit.retry_count ?? 0);
  const dispatched = (claimsVisit.invoices ?? []).some(
    (invoice) => (invoice?.dispatch_status ?? '').trim().toUpperCase() === 'DISPATCHED',
  );

  const milestones: Milestone[] = [];

  // --- What was assembled, each counted from the claim's own totals.
  if (diagnoses > 0) {
    milestones.push({
      label: 'Diagnoses',
      note: String(diagnoses),
      detail: `${plural(diagnoses, 'diagnosis', 'diagnoses')} recorded`,
      tone: 'done',
    });
  }
  if (invoiceCount > 0) {
    milestones.push({
      label: 'Invoiced',
      note: String(invoiceCount),
      detail: `${plural(invoiceCount, 'invoice', 'invoices')} raised`,
      tone: 'done',
    });
  }
  if (attachments > 0) {
    milestones.push({
      label: 'Documents',
      note: String(attachments),
      detail: `${plural(attachments, 'document', 'documents')} attached`,
      tone: 'done',
    });
  }
  if (claimsVisit.is_charge_master_mapped) {
    milestones.push({ label: 'Charges mapped', detail: 'Charges mapped to the charge master', tone: 'done' });
  }

  // --- The visit's authorisation, in the payer's own words.
  if ((claimsVisit.claim_auth_status ?? '').trim()) {
    const authStatus = humaniseClaimStatus(claimsVisit.claim_auth_status);
    milestones.push({
      label: 'Visit auth',
      note: authStatus,
      detail: `Visit authorisation: ${authStatus}`,
      tone: claimStatusTagType(claimsVisit.claim_auth_status) === 'red' ? 'warning' : 'done',
    });
  }

  // --- The hand-off. A dispatched invoice is the evidence the claim reached the payer;
  // a retry count is evidence it took more than one attempt.
  if (dispatched) {
    milestones.push({
      label: 'Dispatched',
      note: retries > 0 ? `after ${retries}` : undefined,
      detail:
        retries > 0
          ? `Dispatched to the payer after ${plural(retries, 'failed attempt', 'failed attempts')}`
          : 'Dispatched to the payer',
      tone: 'done',
    });
  } else if (retries > 0) {
    milestones.push({
      label: 'Dispatch failed',
      note: `${retries}×`,
      detail: `${plural(retries, 'failed attempt', 'failed attempts')} to dispatch, not yet dispatched`,
      tone: 'warning',
    });
  }

  // --- What came back.
  if (claimsVisit.has_reviewed_claim) {
    milestones.push({ label: 'Reviewed', detail: 'Reviewed by the payer', tone: 'done' });
  }
  if (claimsVisit.is_resubmitted) {
    milestones.push({ label: 'Resubmitted', detail: 'Sent to the payer more than once', tone: 'done' });
  }

  // --- Anomalies the payer will act on, worth surfacing beside the rest.
  if (claimsVisit.is_zero) {
    milestones.push({ label: 'Zero value', detail: 'Zero-value claim', tone: 'warning' });
  }
  if (claimsVisit.is_negative) {
    milestones.push({ label: 'Negative value', detail: 'Negative-value claim', tone: 'warning' });
  }

  const phase = getClaimWorkflowPhase(claimsVisit.workflow_state);
  const phaseLabel = PHASE_LABEL[phase] ?? '';

  return (
    <div className={styles.history}>
      {/* Where the claim stands now, leading and always shown — even on a claim that
          evidences nothing else, which is exactly what a fresh draft looks like. The
          "Now" label is what separates this from the settled facts below it, standing in
          for the divider a wider column would have used. */}
      <div className={styles.status}>
        <span className={styles.statusLabel}>Now</span>
        {claimStateUnconfirmed ? (
          <InlineLoading status="active" description="Confirming…" className={styles.confirming} />
        ) : (
          <>
            <Tag size="sm" type={claimStatusTagType(claimsVisit.workflow_state)} className={styles.statusTag}>
              {claimsVisit.workflow_state || 'Unknown'}
            </Tag>
            {phaseLabel ? <span className={styles.statusNote}>{phaseLabel}</span> : null}
          </>
        )}

        {/* The caveat that used to sit under the list as a sentence. It qualifies the
            chips rather than adding to them, so it hides behind the icon and stops
            costing a line of its own. */}
        <Tooltip align="bottom-right" label={CAVEAT} className={styles.caveat}>
          <button type="button" className={styles.caveatTrigger} aria-label="About this history">
            <InformationFilled size={16} />
          </button>
        </Tooltip>
      </div>

      {/* Unordered by nature: each chip is one fact the claim carries, not a step that
          led to the next. */}
      {milestones.length ? (
        <ul className={styles.chips}>
          {milestones.map((milestone, index) => (
            <li
              className={`${styles.chip} ${milestone.tone === 'warning' ? styles.chipWarning : styles.chipDone}`}
              key={`${milestone.label}-${index}`}
              title={milestone.detail}
            >
              {milestone.tone === 'warning' ? <WarningAltFilled size={16} /> : <CheckmarkFilled size={16} />}
              <span className={styles.chipLabel}>{milestone.label}</span>
              {milestone.note ? <span className={styles.chipNote}>{milestone.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default ClaimHistory;
