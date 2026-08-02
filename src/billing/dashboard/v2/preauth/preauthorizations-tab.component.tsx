import React, { useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import PreauthList from './preauth-list.component';
import Preauths from '../facility-bills/preauths.component';
import styles from '../facility-bills/facility-bills.component.scss';

interface PreauthorizationsTabProps {
  locationUuid: string;
  billingDate: string;
  onDateChange?: (value: string) => void;
}

/**
 * Preauthorizations dashboard tab (option B):
 * - Needs raise: queue to start normal/special preauth (PreauthList)
 * - Status: live HIE preview / doctor-consent resend (monitoring only)
 */
const PreauthorizationsTab: React.FC<PreauthorizationsTabProps> = ({
  locationUuid,
  billingDate,
  onDateChange,
}) => {
  const [subTab, setSubTab] = useState(0);

  return (
    <div className={styles.panel}>
      <Tabs selectedIndex={subTab} onChange={({ selectedIndex }) => setSubTab(selectedIndex)}>
        <TabList aria-label="Preauthorization views" scrollDebounceWait={200}>
          <Tab>Needs raise</Tab>
          <Tab>Status</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <PreauthList locationUuid={locationUuid} billingDate={billingDate} onDateChange={onDateChange} />
          </TabPanel>
          <TabPanel>
            <Preauths locationUuid={locationUuid} billingDate={billingDate} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default PreauthorizationsTab;
