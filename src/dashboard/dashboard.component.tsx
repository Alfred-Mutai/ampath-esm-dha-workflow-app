import React, { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';

import styles from './dashboard.component.scss';
import Overview from './overview/overview.component';
import { getServiceQueueByLocationUuid } from '../service-queues/service-queues.resource';
import { type QueueEntryResult } from '../registry/types';
import { useSession } from '@openmrs/esm-framework';
import { QUEUE_SERVICE_UUIDS } from '../shared/constants/concepts';
import { getDashBoardSummary } from '../resources/dashboard.resource';

interface DashboardProps {}

const Dashboard: React.FC<DashboardProps> = () => {
  const [triageQueueEntries, setTriageQueueEntries] = useState<QueueEntryResult[]>([]);
  const [consultationQueueEntries, setConsultationQueueEntries] = useState<QueueEntryResult[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<any[]>([]);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  useEffect(() => {
    getDashBoardData();
  }, []);

  const getDashBoardData = async () => {
    const res = await getDashBoardSummary(locationUuid);
    setDashboardSummary(res[0]);
  };

  return (
    <div className={styles.container}>
      <Tabs>
        <TabList contained scrollDebounceWait={200}>
          <Tab>
            <span className={styles.tabText}>Overview</span>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Overview
              triageCount={triageQueueEntries}
              consultationCount={consultationQueueEntries}
              dashboardSummary={dashboardSummary}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default Dashboard;
