import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface DialysisTriageProps {}
const DialysisTriage: React.FC<DialysisTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DIALYSIS_TRIAGE_SERVICE_UUID} title="Dialysis Triage" />
      </div>
    </>
  );
};
export default DialysisTriage;
