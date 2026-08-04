import React from 'react';
import { Button, Tag } from '@carbon/react';
import { closeWorkspace } from '@openmrs/esm-framework';
import { type VisitIntervention } from '../../types';
import { asBool } from '../../preauth/preauth.resource';
import InterventionAttachments, { type InterventionAttachmentsProps } from './intervention-attachments.component';
import { RECORD_DETAILS_WORKSPACE } from '../shared/record-details.workspace';
import styles from './claim-intervention-panel.component.scss';

/** What the claim page states above this panel, so the panel doesn't restate it. */
export interface InterventionClaimFacts {
  schemeCode?: string;
  schemeName?: string;
}

interface ClaimInterventionPanelProps {
  intervention: VisitIntervention;
  /** Context for the required-documents section; absent when documents don't apply. */
  attachmentOpts?: Omit<InterventionAttachmentsProps, 'intervention'>;
  claimFacts?: InterventionClaimFacts;
  canSwitch?: boolean;
  canRaisePreauth?: boolean;
  onSwitch?: () => void;
  onRaisePreauth?: () => void;
  /** Why Raise preauth is unavailable, when it is. */
  raisePreauthReason?: string;
}

const money = (n: number | string) => {
  const value = Number(n ?? 0);
  return value ? `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
};

const sameValue = (a?: string | null, b?: string | null): boolean =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

/**
 * The specialties an intervention needs a preauth for. The five flags are false on most
 * interventions, so they are collected into one list of the ones that are set rather than
 * five rows of "No".
 */
const specialtyFlags = (iv: VisitIntervention): string[] =>
  [
    { label: 'Surgical', on: asBool(iv.requires_surgical_preauth ?? (iv as any).requiresSurgicalPreauth) },
    { label: 'Renal', on: asBool(iv.requires_renal_preauth ?? (iv as any).requiresRenalPreauth) },
    { label: 'Oncology', on: asBool(iv.requires_oncology_preauth ?? (iv as any).requiresOncologyPreauth) },
    { label: 'Radiology', on: asBool(iv.requires_radiology_preauth ?? (iv as any).requiresRadiologyPreauth) },
    { label: 'Optical', on: asBool(iv.requires_optical_preauth ?? (iv as any).requiresOpticalPreauth) },
  ]
    .filter((flag) => flag.on)
    .map((flag) => flag.label);

/**
 * An intervention as the side panel shows it.
 *
 * The generic card gave all fifteen fields the same weight, eleven of which were the same
 * word on every intervention — five "No"s for the specialty preauths, a scheme the claim
 * had already named, per-diem figures that are nil unless the visit accrued any. Here the
 * particulars that vary lead, the flags that are set are collected into one line and the
 * ones that aren't stay silent, and the documents the intervention needs follow.
 */
const ClaimInterventionPanel: React.FC<ClaimInterventionPanelProps> = ({
  intervention,
  attachmentOpts,
  claimFacts,
  canSwitch,
  canRaisePreauth,
  onSwitch,
  onRaisePreauth,
  raisePreauthReason,
}) => {
  const perDiemAmount = Number(intervention.accrued_per_diem_amount ?? 0);
  const perDiemDays = Number(intervention.accrued_per_diem_days ?? 0);
  const specialties = specialtyFlags(intervention);

  // Each is shown only when it says something this intervention alone can say: not blank,
  // and not the scheme the claim above already named.
  const facts = [
    { label: 'Code', value: intervention.intervention_code },
    { label: 'Payment mechanism', value: intervention.intervention_payment_mechanism },
    { label: 'Fund', value: intervention.intervention_fund },
    { label: 'Sub benefit code', value: intervention.sub_benefit_code },
    { label: 'Keph level tariff', value: money(intervention.keph_level_tarrif) },
    ...(perDiemAmount > 0 ? [{ label: 'Accrued per diem', value: money(perDiemAmount) }] : []),
    ...(perDiemDays > 0 ? [{ label: 'Per diem days', value: String(perDiemDays) }] : []),
    ...(sameValue(intervention.supported_scheme, claimFacts?.schemeCode) ||
    sameValue(intervention.supported_scheme, claimFacts?.schemeName)
      ? []
      : [{ label: 'Scheme', value: intervention.supported_scheme }]),
  ].filter((fact) => Boolean((fact.value ?? '').trim()));

  const showActions = Boolean(onSwitch || onRaisePreauth);

  return (
    <div className={styles.panel}>
      <dl className={styles.meta}>
        <div>
          <dt>Status</dt>
          <dd className={styles.tags}>
            {intervention.workflow_state ? (
              <Tag size="sm" type={intervention.workflow_state.toUpperCase() === 'ACTIVE' ? 'teal' : 'gray'}>
                {intervention.workflow_state}
              </Tag>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {/* Only the flags that are set. An intervention with none of them says so once,
          rather than five times over. */}
      <div className={styles.flagsRow}>
        <span className={styles.flagsLabel}>Preauth</span>
        <span className={styles.tags}>
          {intervention.needs_preauth ? (
            <Tag size="sm" type="blue">
              Required
            </Tag>
          ) : (
            <Tag size="sm" type="gray">
              Not required
            </Tag>
          )}
          {specialties.map((specialty) => (
            <Tag size="sm" type="purple" key={specialty}>
              {specialty}
            </Tag>
          ))}
          {intervention.active_for_uhc ? (
            <Tag size="sm" type="green">
              Active for UHC
            </Tag>
          ) : null}
        </span>
      </div>

      {attachmentOpts ? (
        <section className={styles.documents}>
          <h6 className={styles.documentsTitle}>Required claim documents</h6>
          <InterventionAttachments intervention={intervention} {...attachmentOpts} />
        </section>
      ) : null}

      {/* Held to the bottom of the panel however short the intervention is, and staying
          there when the documents list scrolls. This panel is rendered from a record model
          rather than as a child of the workspace, so it has no closeWorkspace prop to
          call — it dismisses the panel by name instead. */}
      <div className={styles.footer}>
        <Button kind="secondary" size="sm" onClick={() => closeWorkspace(RECORD_DETAILS_WORKSPACE)}>
          Close
        </Button>
        {showActions ? (
          <>
            {onSwitch ? (
              <Button kind="tertiary" size="sm" disabled={!canSwitch} onClick={onSwitch}>
                Switch intervention
              </Button>
            ) : null}
            {onRaisePreauth ? (
              <Button
                kind="primary"
                size="sm"
                disabled={!canRaisePreauth}
                title={canRaisePreauth ? 'Raise normal preauth for this intervention' : raisePreauthReason}
                onClick={onRaisePreauth}
              >
                Raise preauth
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ClaimInterventionPanel;
