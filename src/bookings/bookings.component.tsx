import { Checkbox, Layer, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import React from 'react';
import DailyBookings from './daily/daily-bookings.component';
import styles from './bookings.component.scss';
import FacilityAndWorkerSlot from '../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
const Bookings: React.FC = () => {
  return (
    <>
      <div className={styles.bookingsLayout}>
      <div className={styles.hwrSection}>
        <FacilityAndWorkerSlot />
      </div>
        <div className={styles.bookingsHeader}>
          <h4>Bookings</h4>
        </div>
        <div className={styles.bookingsContent}>
          <Tabs>
            <TabList contained>
              <Tab>Daily</Tab>
              <Tab>Monthly</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <DailyBookings />
              </TabPanel>
              <TabPanel></TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default Bookings;
