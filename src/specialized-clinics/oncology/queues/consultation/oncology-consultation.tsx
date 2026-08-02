import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface OncologyConsultationProps {}
const OncologyConsultation: React.FC<OncologyConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.ONCOLOGY_CONSULTATION_SERVICE_UUID} title="Oncology Consultation" />
      </div>
    </>
  );
};
export default OncologyConsultation;
