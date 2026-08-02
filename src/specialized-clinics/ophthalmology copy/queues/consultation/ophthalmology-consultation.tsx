import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface OphthalmologyConsultationProps {}
const OphthalmologyConsultation: React.FC<OphthalmologyConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.OPTHALMOLOGY_CONSULTATION_SERVICE_UUID} title="Ophthalmology Consultation" />
      </div>
    </>
  );
};
export default OphthalmologyConsultation;
