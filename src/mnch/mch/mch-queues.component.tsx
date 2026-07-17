import React from 'react';
import styles from './mch-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import MchTriage from './queues/triage/mch-triage';
import MchConsultation from './queues/consultation/mch-consultation';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
interface MchQueuesProps {}
const MchQueues: React.FC<MchQueuesProps> = () => {
  return (
    <div className={styles.mnchLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.mnchHeader}>
        <h4>MNCH</h4>
      </div>
      <div className={styles.mnchContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <MchTriage />
            </TabPanel>
            <TabPanel>
              <MchConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default MchQueues;
