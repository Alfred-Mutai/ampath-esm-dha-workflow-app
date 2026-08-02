import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface OphthalmologyTriageProps {}
const OphthalmologyTriage: React.FC<OphthalmologyTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.OPTHALMOLOGY_TRIAGE_SERVICE_UUID} title="Ophthalmology Triage" />
      </div>
    </>
  );
};
export default OphthalmologyTriage;
