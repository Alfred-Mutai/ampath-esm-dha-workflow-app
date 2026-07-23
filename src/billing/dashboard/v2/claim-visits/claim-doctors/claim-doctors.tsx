import React from 'react';
import { type ClaimDoctor } from '../../types';
import { UserAvatar } from '@carbon/react/icons';
import styles from './claim-doctors.scss';

interface claimDoctorsProps {
  claimDoctors: ClaimDoctor[];
}

// A claim doctor only carries a name, so doctors are shown as compact avatar + name
// chips rather than cards.
const ClaimDoctors: React.FC<claimDoctorsProps> = ({ claimDoctors }) => {
  if (!claimDoctors || claimDoctors.length === 0) {
    return <p className={styles.empty}>No doctors on this claim.</p>;
  }

  return (
    <div className={styles.doctors}>
      {claimDoctors.map((cd, index) => (
        <span className={styles.chip} key={cd.id ?? index}>
          <UserAvatar size={20} className={styles.chipAvatar} />
          <span className={styles.chipName}>{cd.doctor_name || 'Unnamed doctor'}</span>
        </span>
      ))}
    </div>
  );
};

export default ClaimDoctors;
