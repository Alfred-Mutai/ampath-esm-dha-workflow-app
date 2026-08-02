import React from 'react';
import styles from './dental-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import DentalTriage from './queues/triage/dental-triage';
import DentalConsultation from './queues/consultation/dental-consultation';
interface DentalQueuesProps {}
const DentalQueues: React.FC<DentalQueuesProps> = () => {
  return (
    <div className={styles.dentalLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.dentalHeader}>
        <h4>Dental</h4>
      </div>
      <div className={styles.dentalContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <DentalTriage />
            </TabPanel>
            <TabPanel>
              <DentalConsultation/>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default DentalQueues;
