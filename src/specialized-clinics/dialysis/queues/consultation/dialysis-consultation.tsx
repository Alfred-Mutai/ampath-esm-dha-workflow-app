import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface DialysisConsultationProps {}
const DialysisConsultation: React.FC<DialysisConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DIALYSIS_CONSULTATION_SERVICE_UUID} title="Dialysis Consultation" />
      </div>
    </>
  );
};
export default DialysisConsultation;
