import React from 'react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import styles from './pharmacy.component.scss';
import FacilityAndWorkerSlot from '../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
const PharmacyComponent: React.FC = () => {
  return (
    <div className={styles.pharmacyLayout}>
      <div className={styles.hwrSection}>
        <FacilityAndWorkerSlot />
      </div>
      <div className={styles.pharmacySection}>
        <ExtensionSlot name="dispensing-dashboard-slot" />
      </div>
    </div>
  );
};

export default PharmacyComponent;
