import React from 'react';
import styles from './diagnostic-and-imaging.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import DiagnosticAndImagingTriage from './queues/triage/diagnosis-and-imaging-triage';
import DiagnosticAndImagingConsultation from './queues/consultation/diagnosis-and-imaging-consultation';
interface DiagnosticAndImagingQueuesProps {}
const DiagnosticAndImagingQueues: React.FC<DiagnosticAndImagingQueuesProps> = () => {
  return (
    <div className={styles.diagnosticAndImagingLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.diagnosticAndImagingHeader}>
        <h4>Diagnostic and Imaging</h4>
      </div>
      <div className={styles.diagnosticAndImagingContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <DiagnosticAndImagingTriage />
            </TabPanel>
            <TabPanel>
              <DiagnosticAndImagingConsultation/>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default DiagnosticAndImagingQueues;
