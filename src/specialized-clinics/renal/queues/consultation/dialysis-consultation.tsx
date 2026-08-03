import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface RenalConsultationProps {}
const RenalConsultation: React.FC<RenalConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DIALYSIS_CONSULTATION_SERVICE_UUID} title="Renal Consultation" />
      </div>
    </>
  );
};
export default RenalConsultation;
