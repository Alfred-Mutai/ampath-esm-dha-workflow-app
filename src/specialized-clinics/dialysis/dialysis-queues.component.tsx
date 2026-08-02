import React from 'react';
import styles from './dialysis-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import DialysisTriage from './queues/triage/dialysis-triage';
import DialysisConsultation from './queues/consultation/dialysis-consultation';
interface MchQueuesProps {}
const DialysisQueues: React.FC<MchQueuesProps> = () => {
  return (
    <div className={styles.dialysisLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.dialysisHeader}>
        <h4>Dialysis</h4>
      </div>
      <div className={styles.dialysisContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <DialysisTriage />
            </TabPanel>
            <TabPanel>
              <DialysisConsultation/>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default DialysisQueues;
