import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface DiagnosticAndImagingConsultationProps {}
const DiagnosticAndImagingConsultation: React.FC<DiagnosticAndImagingConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DIAGNOSTIC_AND_IMAGING_CONSULTATION_SERVICE_UUID} title="Diagnostic And Imaging Consultation" />
      </div>
    </>
  );
};
export default DiagnosticAndImagingConsultation;
