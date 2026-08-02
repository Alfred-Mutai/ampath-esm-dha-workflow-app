import React from 'react';
import styles from './oncology-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import OncologyTriage from './queues/triage/oncology-triage';
import OncologyConsultation from './queues/consultation/oncology-consultation';
interface OncologyQueuesProps {}
const OncologyQueues: React.FC<OncologyQueuesProps> = () => {
  return (
    <div className={styles.OncologyLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.OncologyHeader}>
        <h4>Oncology</h4>
      </div>
      <div className={styles.OncologyContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <OncologyTriage />
            </TabPanel>
             <TabPanel>
              <OncologyConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default OncologyQueues;
