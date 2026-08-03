import React from 'react';
import styles from './renal-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import RenalTriage from './queues/triage/renal-triage';
import RenalConsultation from './queues/consultation/dialysis-consultation';
interface RenalQueuesProps {}
const RenalQueues: React.FC<RenalQueuesProps> = () => {
  return (
    <div className={styles.renalLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.renalHeader}>
        <h4>Renal</h4>
      </div>
      <div className={styles.renalContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <RenalTriage />
            </TabPanel>
            <TabPanel>
              <RenalConsultation/>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default RenalQueues;
