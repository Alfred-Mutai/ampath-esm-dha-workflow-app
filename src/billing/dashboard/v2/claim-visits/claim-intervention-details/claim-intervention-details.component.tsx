import React from 'react';
import { Tag } from '@carbon/react';
import { type ClaimAttachment, type PatientFacilityBillDetails, type VisitIntervention } from '../../types';
import RecordCards, { YesNo, type RecordCardModel } from '../shared/record-cards.component';
import InterventionAttachments from './intervention-attachments.component';

interface claimInterventionDetailsProps {
  claimInterventions: VisitIntervention[];
}

// Context needed for the per-intervention required-documents region.
export interface InterventionAttachmentOpts {
  consentToken: string;
  locationUuid: string;
  claimAttachments: ClaimAttachment[];
  bill?: PatientFacilityBillDetails;
}

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
            defaultOpen: true,
          }
        : undefined,
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
