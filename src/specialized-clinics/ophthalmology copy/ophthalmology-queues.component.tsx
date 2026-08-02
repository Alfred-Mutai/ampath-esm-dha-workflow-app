import React from 'react';
import styles from './ophthalmology-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import OphthalmologyTriage from './queues/triage/ophthalmology-triage';
import OphthalmologyConsultation from './queues/consultation/ophthalmology-consultation';
interface OphthalmologyQueuesProps {}
const OphthalmologyQueues: React.FC<OphthalmologyQueuesProps> = () => {
  return (
    <div className={styles.ophthalmologyLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.ophthalmologyHeader}>
        <h4>Ophthalmology</h4>
      </div>
      <div className={styles.ophthalmologyContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <OphthalmologyTriage />
            </TabPanel>
             <TabPanel>
              <OphthalmologyConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default OphthalmologyQueues;
