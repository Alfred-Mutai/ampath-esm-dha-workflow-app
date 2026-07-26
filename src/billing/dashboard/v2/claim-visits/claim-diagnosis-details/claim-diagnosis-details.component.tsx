import React from 'react';
import { type VisitDiagnosis } from '../../types';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import RecordCards, { type RecordCardModel } from '../shared/record-cards.component';

interface claimDiagnosisDetailsProps {
  claimDiagnosiss: VisitDiagnosis[];
}

// Builder so the cards can be merged into a shared grid with the doctors.
export function buildDiagnosisRecords(claimDiagnosiss: VisitDiagnosis[]): RecordCardModel[] {
  return (claimDiagnosiss ?? []).map((cd) => ({
    tone: 'green',
    kind: 'Diagnosis',
    title: cd.diagnosis_name,
    fields: [
      { label: 'Recorded on', value: cd.recorded_on ? formatDate(parseDate(cd.recorded_on)) : '' },
      { label: 'Diagnosis code', value: cd.diagnosis_code },
      { label: 'Intervention code', value: cd.intervention_code },
    ],
  }));
}

const ClaimDiagnosisDetails: React.FC<claimDiagnosisDetailsProps> = ({ claimDiagnosiss }) => (
  <RecordCards records={buildDiagnosisRecords(claimDiagnosiss)} emptyMessage="No diagnosis data." layout="grid" />
);

export default ClaimDiagnosisDetails;
