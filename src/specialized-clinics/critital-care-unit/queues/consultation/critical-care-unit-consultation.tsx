import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface CriticalCareUnitConsultationProps {}
const CriticalCareUnitConsultation: React.FC<CriticalCareUnitConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.CRITICAL_CARE_UNIT_CONSULTATION_SERVICE_UUID} title="Critical Care Unit Consultation" />
      </div>
    </>
  );
};
export default CriticalCareUnitConsultation;
