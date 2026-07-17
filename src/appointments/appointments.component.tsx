import React, { useEffect, useState } from 'react';
import { ExtensionSlot, WorkspaceContainer } from '@openmrs/esm-framework';
import FacilityAndWorkerSlot from '../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import styles from './appointments.component.scss';

const AppointmentsComponent: React.FC = () => {
  
  return (
    <div className={styles.appointmentsLayout}>
     <div className={styles.fhwrSection}>
        <FacilityAndWorkerSlot />
    </div>
    <div className={styles.appSection}>
      <ExtensionSlot name="clinical-appointments-dashboard-slot" />
    </div>
  </div>
  );
};

export default AppointmentsComponent;
