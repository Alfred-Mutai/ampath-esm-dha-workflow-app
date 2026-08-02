import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface OncologyTriageProps {}
const OncologyTriage: React.FC<OncologyTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.ONCOLOGY_TRIAGE_SERVICE_UUID} title="Oncology Triage" />
      </div>
    </>
  );
};
export default OncologyTriage;
