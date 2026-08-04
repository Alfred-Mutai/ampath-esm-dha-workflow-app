import React from 'react';
import { WarningFilled } from '@carbon/react/icons';
import { type ClaimDoctor } from '../../types';
import styles from './claim-doctors.scss';

interface claimDoctorsProps {
  claimDoctors: ClaimDoctor[];
  /** The claim can still be worked on, so a missing doctor is a gap to fill rather than
      a record of what never happened. Colours the empty state to match the other
      sections whose emptiness is holding the claim up. */
  blocking?: boolean;
}

// A claim doctor carries nothing but a name, so the names are set as plain text — an
// avatar and a pill around each said no more than the name already does.
const ClaimDoctors: React.FC<claimDoctorsProps> = ({ claimDoctors, blocking }) => {
  const names = (claimDoctors ?? []).map((cd) => (cd.doctor_name ?? '').trim()).filter(Boolean);

  if (names.length === 0) {
    if (blocking) {
      return (
        // `role="alert"` only here: a claim that is past being worked on has nothing to
        // announce, and its empty state stays the quiet note below.
        <p className={styles.emptyDanger} role="alert">
          <WarningFilled size={20} className={styles.emptyDangerIcon} />
          <span>No doctor recorded. One must be recorded before this claim can be submitted.</span>
        </p>
      );
    }
    return <p className={styles.empty}>No doctors on this claim.</p>;
  }

  return <p className={styles.doctors}>{names.join(', ')}</p>;
};

export default ClaimDoctors;
