import React from 'react';
import { QUEUE_SERVICE_UUIDS } from '../../shared/constants/concepts';
import ServiceQueueComponent from '../service-queue/service-queue.component';
import styles from './consultation.component.scss';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
const Consultation: React.FC = () => {
  return (
    <>
    <div className={styles.consultationLayout}>
      <div>
            <FacilityAndWorkerSlot />
      </div>
      <div>
      <ServiceQueueComponent
        serviceTypeUuid={QUEUE_SERVICE_UUIDS.CLINICAL_CONSULTATION_SERVICE_UUID}
        title="Clinical Consultation"
      />
      </div>
    </div>
    </>
  );
};

export default Consultation;
