import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface CriticalCareUnitTriageProps {}
const CriticalCareUnitTriage: React.FC<CriticalCareUnitTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.CRITICAL_CARE_UNIT_TRIAGE_SERVICE_UUID} title="CriticalCareUnit Triage" />
      </div>
    </>
  );
};
export default CriticalCareUnitTriage;
