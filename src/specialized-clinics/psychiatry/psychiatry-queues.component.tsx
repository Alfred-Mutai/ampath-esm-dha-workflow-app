import React from 'react';
import styles from './psychiatry-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import PsychiatryTriage from './queues/triage/psychiatry-triage';
import PsychiatryConsultation from './queues/consultation/psychiatry-consultation';
interface PsychiatryQueuesProps {}
const PsychiatryQueues: React.FC<PsychiatryQueuesProps> = () => {
  return (
    <div className={styles.psychiatryLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.psychiatryHeader}>
        <h4>Psychiatry</h4>
      </div>
      <div className={styles.psychiatryContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <PsychiatryTriage />
            </TabPanel>
             <TabPanel>
              <PsychiatryConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default PsychiatryQueues;
