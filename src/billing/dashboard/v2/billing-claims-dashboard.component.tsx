import React, { useEffect, useState } from 'react';
import styles from './billing-claims-dashboard.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityBills from './facility-bills/facility-bills.component';
import ClaimsAccounting from './claims-accounting/claims-accounting.component';
import { useSession } from '@openmrs/esm-framework';
import ActiveVisits from './active-visits/active-visits.component';
import { useActiveVisits } from './active-visits/active-visits.resource';
import Clearance from './clearance/clearance.component';
import { getClearanceCounts } from '../../../shared/services/consultation-clearance.resource';
import { getClaimCounts } from './claims-accounting/claims-accounting.resource';
interface billingClaimsDashboardProps { }
const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const [billingDate, setBillingDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const { activeVisits } = useActiveVisits();
  const [awaiting, setAwaiting] = useState(0);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [selectedTab, setSelectedTab] = useState(0);
  // Which sub-tab to open, with a nonce so repeat clicks still re-navigate.
  const [claimsNav, setClaimsNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });
  const [clearanceNav, setClearanceNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });

  useEffect(() => {
    if (locationUuid) {
      getClearanceCounts(locationUuid).then((c) => setAwaiting(c.awaiting));
    }
    getClaimCounts().then(setClaimCounts);
  }, [locationUuid]);

  const summary = [
    { key: 'awaiting', label: 'Awaiting clearance', value: awaiting, tone: styles.toneAmber, tab: 0, clearKey: 'awaiting' },
    { key: 'active', label: 'Active visits', value: activeVisits?.length ?? 0, tone: styles.toneBlue, tab: 0, clearKey: 'pending' },
    { key: 'pending', label: 'Pending claims', value: claimCounts.pending ?? 0, tone: styles.toneBlue, tab: 2, claimKey: 'pending' },
    { key: 'rejected', label: 'Rejected claims', value: claimCounts.rejected ?? 0, tone: styles.toneRed, tab: 2, claimKey: 'rejected' },
    { key: 'resubmission', label: 'Needs resubmission', value: claimCounts.resubmission ?? 0, tone: styles.toneAmber, tab: 2, claimKey: 'resubmission' },
  ];

  const handleTileClick = (s: { tab: number; claimKey?: string; clearKey?: string }) => {
    setSelectedTab(s.tab);
    if (s.claimKey) {
      setClaimsNav((p) => ({ key: s.claimKey, nonce: p.nonce + 1 }));
    }
    if (s.clearKey) {
      setClearanceNav((p) => ({ key: s.clearKey, nonce: p.nonce + 1 }));
    }
  };

  // Date filter now lives beside the search in each tab's toolbar (see TableToolbar).
  const handleDateChange = (value: string) => {
    setBillingDate(value || new Date().toLocaleDateString('en-CA'));
  };
  return (
    <>
            <div className={styles.bcLayout}>
              <div className={styles.bcHeader}>
                <div className={styles.bcHeaderTitle}>
                  <h4>Billing and Claims Dashboard</h4>
                </div>
              </div>
              <div className={styles.summaryRow}>
                {summary.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`${styles.summaryTile} ${s.tone}`}
                    onClick={() => handleTileClick(s)}
                  >
                    <span className={styles.summaryValue}>{s.value}</span>
                    <span className={styles.summaryLabel}>{s.label}</span>
                  </button>
                ))}
              </div>
              <div className={styles.bcContent}>
                <div className={styles.bcContentTabs}>
                  <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
                    <TabList scrollDebounceWait={200}>
                      <Tab>Pending clearance</Tab>
                      <Tab>Bills</Tab>
                      <Tab>Claims</Tab>
                    </TabList>
                    <TabPanels>
                      <TabPanel>
                        <Clearance
                          pendingTab={
                            <>
                              <p className={styles.pendingHint}>
                                Active visits that have started but are not yet in a service queue. Send each patient to
                                triage to begin their consultation clearance.
                              </p>
                              <ActiveVisits />
                            </>
                          }
                          initialTab={clearanceNav.key}
                          navNonce={clearanceNav.nonce}
                        />
                      </TabPanel>
                      <TabPanel>
                        <FacilityBills locationUuid={locationUuid} billingDate={billingDate} onDateChange={handleDateChange} />
                      </TabPanel>
                      <TabPanel>
                        <ClaimsAccounting initialTabKey={claimsNav.key} navNonce={claimsNav.nonce} />
                      </TabPanel>
                    </TabPanels>
                  </Tabs>
                </div>
              </div>
            </div>
    </>
  );
};

export default BillingClaimsDashboard;
