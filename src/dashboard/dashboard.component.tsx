import React, { useEffect, useState } from 'react';
import { Analytics } from '@carbon/react/icons';

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
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <Analytics size={24} />
        </span>
        <div>
          <h3 className={styles.title}>Today at your facility</h3>
          <p className={styles.subtitle}>A live snapshot of patient flow and service activity.</p>
        </div>
      </div>
      <Overview
        triageCount={triageQueueEntries}
        consultationCount={consultationQueueEntries}
        dashboardSummary={dashboardSummary}
      />
    </div>
  );
};

export default Dashboard;
