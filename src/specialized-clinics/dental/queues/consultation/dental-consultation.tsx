import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface DentalConsultationProps {}
const DentalConsultation: React.FC<DentalConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DENTAL_CONSULTATION_SERVICE_UUID} title="Dental Consultation" />
      </div>
    </>
  );
};
export default DentalConsultation;
