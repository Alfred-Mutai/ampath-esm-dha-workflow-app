import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface DiagnosticAndImagingTriageProps {}
const DiagnosticAndImagingTriage: React.FC<DiagnosticAndImagingTriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.DIAGNOSTIC_AND_IMAGING_TRIAGE_SERVICE_UUID} title="Diagnostic And Imaging Triage" />
      </div>
    </>
  );
};
export default DiagnosticAndImagingTriage;
