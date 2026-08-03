import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface PsychiatryConsultationProps {}
const PsychiatryConsultation: React.FC<PsychiatryConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.PSYCHIATRY_CONSULTATION_SERVICE_UUID} title="Psychiatry Consultation" />
      </div>
    </>
  );
};
export default PsychiatryConsultation;
