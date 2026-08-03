import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface RenalTriageProps {}
const RenalTriage: React.FC<RenalTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DIALYSIS_TRIAGE_SERVICE_UUID} title="Renal Triage" />
      </div>
    </>
  );
};
export default RenalTriage;
