import React from 'react';
import { Button, Tag } from '@carbon/react';
import { closeWorkspace, formatDate, parseDate } from '@openmrs/esm-framework';
import { type VisitDiagnosis } from '../../types';
import { RECORD_DETAILS_WORKSPACE } from '../shared/record-details.workspace';
import styles from './claim-diagnosis-panel.component.scss';

/** What the claim page states above this panel, so the panel doesn't restate it. */
export interface DiagnosisClaimFacts {
  memberNumber?: string;
  patientNumber?: string;
}

interface ClaimDiagnosisPanelProps {
  diagnosis: VisitDiagnosis;
  claimFacts?: DiagnosisClaimFacts;
}

const sameValue = (a?: string | null, b?: string | null): boolean =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

const asDate = (value?: string | null): string => {
  const v = (value ?? '').trim();
  if (!v) {
    return '';
  }
  try {
    return formatDate(parseDate(v));
  } catch {
    return v;
  }
};

/**
 * A diagnosis as the side panel shows it.
 *
 * A diagnosis carries little, so the work here is in what it doesn't show: the member
 * number the claim above already names, and an intervention code that is only worth
 * stating when it differs from the diagnosis' own. What it adds is the flag — whether the
 * payer has marked this diagnosis for attention — which the card never surfaced at all.
 */
const ClaimDiagnosisPanel: React.FC<ClaimDiagnosisPanelProps> = ({ diagnosis, claimFacts }) => {
  const recorded = asDate(diagnosis.recorded_on);

  const facts = [
    { label: 'Diagnosis code', value: diagnosis.diagnosis_code },
    // The same code on both sides says nothing twice; only a differing one is a fact.
    ...(sameValue(diagnosis.intervention_code, diagnosis.diagnosis_code)
      ? []
      : [{ label: 'Intervention code', value: diagnosis.intervention_code }]),
    { label: 'Recorded', value: recorded },
    ...(sameValue(diagnosis.patient_number, claimFacts?.memberNumber) ||
    sameValue(diagnosis.patient_number, claimFacts?.patientNumber)
      ? []
      : [{ label: 'Member number', value: diagnosis.patient_number }]),
  ].filter((fact) => Boolean((fact.value ?? '').trim()));

  return (
    <div className={styles.panel}>
      {/* Only when it is set: a diagnosis not flagged is the norm and says nothing. */}
      {diagnosis.is_flagged_diagnosis ? (
        <div className={styles.flagRow}>
          <Tag size="sm" type="red">
            Flagged diagnosis
          </Tag>
        </div>
      ) : null}

      <dl className={styles.meta}>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {/* Held to the bottom of the panel. This panel is rendered from a record model
          rather than as a child of the workspace, so it has no closeWorkspace prop to
          call — it dismisses the panel by name instead. */}
      <div className={styles.footer}>
        <Button kind="secondary" size="sm" onClick={() => closeWorkspace(RECORD_DETAILS_WORKSPACE)}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default ClaimDiagnosisPanel;
