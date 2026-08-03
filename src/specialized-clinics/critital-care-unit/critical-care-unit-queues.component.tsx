import React from 'react';
import styles from './critical-care-unit-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import CriticalCareUnitTriage from './queues/triage/critical-care-unit-triage';
import CriticalCareUnitConsultation from './queues/consultation/critical-care-unit-consultation';
interface CriticalCareUnitQueuesProps {}
const CriticalCareUnitQueues: React.FC<CriticalCareUnitQueuesProps> = () => {
  return (
    <div className={styles.CriticalCareUnitLayout}>
      <div className={styles.hwrSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.CriticalCareUnitHeader}>
        <h4>CriticalCareUnit</h4>
      </div>
      <div className={styles.CriticalCareUnitContent}>
        <Tabs>
          <TabList contained>
            <Tab>Triage</Tab>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <CriticalCareUnitTriage/>
            </TabPanel>
            <TabPanel>
             <CriticalCareUnitConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default CriticalCareUnitQueues;
