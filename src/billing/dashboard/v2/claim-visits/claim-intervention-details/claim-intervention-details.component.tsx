import React from 'react';
import { Button, Tag } from '@carbon/react';
import { type ClaimAttachment, type PatientFacilityBillDetails, type VisitIntervention } from '../../types';
import { asBool } from '../../preauth/preauth.resource';
import { interventionHasBlockingPreauth } from '../../../../../claims/claims.resource';
import RecordCards, { YesNo, type RecordCardModel } from '../shared/record-cards.component';
import InterventionAttachments from './intervention-attachments.component';

interface claimInterventionDetailsProps {
  claimInterventions: VisitIntervention[];
  consentToken: string;
}

// Context needed for the per-intervention required-documents region.
export interface InterventionAttachmentOpts {
  consentToken: string;
  locationUuid: string;
  claimAttachments: ClaimAttachment[];
  bill?: PatientFacilityBillDetails;
  /** Only a draft claim accepts new documents; otherwise the rows are read-only. */
  isClaimDraft?: boolean;
  /** Whether the claim is currently open to content edits (gates Switch / Raise preauth). */
  canSwitchIntervention?: boolean;
  /** Launches the switch workflow scoped to this card's intervention. */
  onSwitchIntervention?: (intervention: VisitIntervention) => void;
  /** Opens the normal preauth workspace for this intervention. */
  onRaisePreauth?: (intervention: VisitIntervention) => void;
  /** Raw GET /pre-auth/preview payload — used to hide Raise when a non-failed row exists. */
  preauthPreview?: unknown;
}

// A claim intervention is actionable only while its workflow_state is ACTIVE;
// one already switched out (INACTIVE) has nothing left to change.
const isActiveIntervention = (iv: VisitIntervention) => (iv.workflow_state ?? '').toUpperCase() === 'ACTIVE';

// Builder so the cards can be merged into a shared grid with the invoices. When `opts`
// is given, each card gets an expandable "required documents" region driven by that
// intervention's own applicable_document_types.
export function buildInterventionRecords(
  claimInterventions: VisitIntervention[],
  opts?: InterventionAttachmentOpts,
): RecordCardModel[] {
  return (claimInterventions ?? []).map((ci) => {
    const requiredDocs = Array.from(new Set(ci.applicable_document_types ?? []));
    const canAct = Boolean(opts?.canSwitchIntervention) && isActiveIntervention(ci);
    const alreadyRaised = interventionHasBlockingPreauth(opts?.preauthPreview, ci.intervention_code);
    const canRaisePreauth = canAct && Boolean(ci.needs_preauth) && !alreadyRaised;
    const hasActions = Boolean(opts?.onSwitchIntervention || opts?.onRaisePreauth);

    return {
      tone: 'purple',
      kind: 'Intervention',
      title: ci.intervention_name,
      badge: ci.workflow_state ? (
        <Tag size="sm" type="teal">
          {ci.workflow_state}
        </Tag>
      ) : undefined,
      fields: [
        { label: 'Code', value: ci.intervention_code },
        { label: 'Payment mechanism', value: ci.intervention_payment_mechanism },
        { label: 'Scheme', value: ci.supported_scheme },
        { label: 'Sub benefit code', value: ci.sub_benefit_code },
        { label: 'Fund', value: ci.intervention_fund },
        { label: 'Keph level tariff', value: ci.keph_level_tarrif },
        { label: 'Accrued per diem', value: ci.accrued_per_diem_amount },
        { label: 'Accrued per diem days', value: ci.accrued_per_diem_days },
        { label: 'Active for UHC', value: <YesNo value={ci.active_for_uhc} /> },
        { label: 'Needs preauth', value: <YesNo value={ci.needs_preauth} /> },
        { label: 'Surgical preauth', value: <YesNo value={asBool(ci.requires_surgical_preauth ?? (ci as any).requiresSurgicalPreauth)} /> },
        { label: 'Renal preauth', value: <YesNo value={asBool(ci.requires_renal_preauth ?? (ci as any).requiresRenalPreauth)} /> },
        { label: 'Oncology preauth', value: <YesNo value={asBool(ci.requires_oncology_preauth ?? (ci as any).requiresOncologyPreauth)} /> },
        { label: 'Radiology preauth', value: <YesNo value={asBool(ci.requires_radiology_preauth ?? (ci as any).requiresRadiologyPreauth)} /> },
        { label: 'Optical preauth', value: <YesNo value={asBool(ci.requires_optical_preauth ?? (ci as any).requiresOpticalPreauth)} /> },
      ],
      expandable: opts
        ? {
            label: (open: boolean) => `${open ? 'Hide' : 'Show'} required claim documents (${requiredDocs.length})`,
            content: <InterventionAttachments intervention={ci} {...opts} />,
            // Nothing to show when the intervention requires no documents, so start
            // collapsed rather than expanding onto an empty state.
            defaultOpen: requiredDocs.length > 0,
          }
        : undefined,
      actions: hasActions ? (
        <>
          {opts?.onSwitchIntervention ? (
            <Button
              kind="tertiary"
              size="sm"
              onClick={() => opts.onSwitchIntervention!(ci)}
              disabled={!canAct}
            >
              Switch Intervention
            </Button>
          ) : null}
          {opts?.onRaisePreauth ? (
            <Button
              kind="tertiary"
              size="sm"
              onClick={() => opts.onRaisePreauth!(ci)}
              disabled={!canRaisePreauth}
              title={
                !ci.needs_preauth
                  ? 'This intervention does not need preauth'
                  : alreadyRaised
                    ? 'Preauth already raised for this intervention'
                    : 'Raise normal preauth for this intervention'
              }
            >
              Raise preauth
            </Button>
          ) : null}
        </>
      ) : undefined,
    };
  });
}

const ClaimInterventionDetails: React.FC<claimInterventionDetailsProps> = ({ claimInterventions }) => (
  <RecordCards
    records={buildInterventionRecords(claimInterventions)}
    emptyMessage="No intervention data."
    layout="grid"
    gridFill="fill"
  />
);

export default ClaimInterventionDetails;
