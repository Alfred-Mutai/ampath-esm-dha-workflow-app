import React, { useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import EmptyState from '../shared/empty-state.component';
import { PREAUTH_BUCKETS, type StatusBucket } from './claim-status';
import styles from './facility-bills.component.scss';
import PendingPreauths from './preauths-datatables/pending-preauths.component';

// Open on the Pending bucket, matching the other payers' default behaviour.
const defaultBucketKey = (buckets: StatusBucket[]): string =>
  (buckets.find((b) => b.key === 'pending') ?? buckets[0])?.key ?? '';

/**
 * Preauthorisations tab. The eClaims preauth feed isn't connected yet, so each status
 * bucket shows a placeholder; the sub-tabs mirror the SHA claims / cash bills layout so
 * the panel stays consistent once real preauth data starts flowing.
 */
interface PreauthsProps {
  locationUuid: string,
  billingDate: string
}

const Preauths: React.FC<PreauthsProps> = (props) => {
  const [statusFilter, setStatusFilter] = useState<string>(() => defaultBucketKey(PREAUTH_BUCKETS));

  const statusTabItems: StatusBucket[] = [...PREAUTH_BUCKETS, { key: '', label: 'All', statuses: [] }];
  const statusTabIndex = Math.max(0, statusTabItems.findIndex((b) => b.key === statusFilter));
  const countPill = (value: number) => <span className={styles.pill}>{value}</span>;

  const emptyMessage = 'Preauthorisations will appear here once the eClaims preauth feed is connected.';

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h4 className={styles.introTitle}>Preauthorizations</h4>
        <p className={styles.introText}>
          Requests for prior approval of planned services under SHA. Once granted, a preauthorisation clears the way
          for the associated claim to be submitted.
        </p>
      </div>
      <Tabs
        selectedIndex={statusTabIndex}
        onChange={({ selectedIndex }) => setStatusFilter(statusTabItems[selectedIndex]?.key ?? '')}
      >
        <TabList aria-label="Preauth statuses" className={styles.statusTabs} scrollDebounceWait={200}>
          {statusTabItems.map((bucket) => (
            <Tab key={bucket.key || 'all'}>
              {bucket.label}
              {countPill(0)}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {statusTabItems.map((bucket) => (
            <TabPanel key={bucket.key || 'all'}>
              {statusFilter === bucket.key ? (
                <div className={styles.tableCard}>
                  {
                    bucket.key === "pending" ?
                      <PendingPreauths locationUuid={props.locationUuid}
                        billingDate={props.billingDate} />
                      : <EmptyState message={emptyMessage} />
                  }
                </div>
              ) : null}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default Preauths;
