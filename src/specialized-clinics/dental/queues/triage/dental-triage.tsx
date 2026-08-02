import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface DentalTriageProps {}
const DentalTriage: React.FC<DentalTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DENTAL_TRIAGE_SERVICE_UUID} title="Dental Triage" />
      </div>
    </>
  );
};
export default DentalTriage;
