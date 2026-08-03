import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface PsychiatryTriageProps {}
const PsychiatryTriage: React.FC<PsychiatryTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.PSYCHIATRY_TRIAGE_SERVICE_UUID} title="Psychiatry Triage" />
      </div>
    </>
  );
};
export default PsychiatryTriage;
