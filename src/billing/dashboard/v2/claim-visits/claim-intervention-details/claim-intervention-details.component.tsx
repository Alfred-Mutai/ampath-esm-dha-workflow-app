import React from 'react';
import { Button, Tag } from '@carbon/react';
import { type ClaimAttachment, type PatientFacilityBillDetails, type VisitIntervention } from '../../types';
import RecordCards, { YesNo, type RecordCardModel } from '../shared/record-cards.component';
import InterventionAttachments from './intervention-attachments.component';
import { launchWorkspace } from '@openmrs/esm-framework';

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
  /** Whether the claim is currently open to content edits (gates the per-card
      Switch Intervention button, same window as removing an invoice line). */
  canSwitchIntervention?: boolean;
  /** Launches the switch workflow scoped to this card's intervention. Omit to
      leave the button off entirely (e.g. read-only contexts). */
  onSwitchIntervention?: (intervention: VisitIntervention) => void;
}

// A claim intervention is switchable only while its workflow_state is ACTIVE;
// one already switched out (INACTIVE) has nothing left to switch.
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
        { label: 'Surgical preauth', value: <YesNo value={ci.requires_surgical_preauth} /> },
        { label: 'Renal preauth', value: <YesNo value={ci.requires_renal_preauth} /> },
        { label: 'Oncology preauth', value: <YesNo value={ci.requires_oncology_preauth} /> },
        { label: 'Radiology preauth', value: <YesNo value={ci.requires_radiology_preauth} /> },
        { label: 'Optical preauth', value: <YesNo value={ci.requires_optical_preauth} /> },
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
      actions: opts?.onSwitchIntervention ? (
        <Button
          kind="tertiary"
          size="sm"
          onClick={() => opts.onSwitchIntervention(ci)}
          disabled={!opts.canSwitchIntervention || !isActiveIntervention(ci)}
        >
          Switch Intervention
        </Button>
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

