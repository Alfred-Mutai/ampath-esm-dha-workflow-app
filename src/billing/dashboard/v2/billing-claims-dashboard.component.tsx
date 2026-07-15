import React, { useCallback, useEffect, useState } from 'react';
import styles from './billing-claims-dashboard.component.scss';
import { Breadcrumb, BreadcrumbItem, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { ArrowUpRight, Document, Location, Time, Wallet, WarningAlt } from '@carbon/react/icons';
import FacilityBills from './facility-bills/facility-bills.component';
import ClaimsAccounting from './claims-accounting/claims-accounting.component';
import Clearance from './clearance/clearance.component';
import { useSession } from '@openmrs/esm-framework';
import ActiveVisits from './active-visits/active-visits.component';
interface billingClaimsDashboardProps { }
const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const facilityName = session.sessionLocation?.display ?? '';
  const [activeTab, setActiveTab] = useState<number>(0);
  const [billingDate, setBillingDate] = useState<string>(new Date().toLocaleDateString('en-CA'));

  const [awaiting, setAwaiting] = useState(0);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [toReconcile, setToReconcile] = useState(0);

  const loadCounts = useCallback(() => {
    getClearanceCounts(locationUuid).then((c) => setAwaiting(c.awaiting));
    getClaimCounts().then(setClaimCounts);
    getRemittances().then((rs) => setToReconcile(rs.filter((r) => r.status === 'RECEIVED').length));
  }, [locationUuid]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts, activeTab]);

  const totalClaims = Object.values(claimCounts).reduce((a, b) => a + b, 0);

  const kpis = [
    {
      key: 'awaiting',
      Icon: Time,
      value: awaiting,
      label: 'Awaiting clearance',
      caption: 'Patients held at the queue',
      tone: styles.toneAmber,
      tab: 0,
    },
    {
      key: 'drafts',
      Icon: Document,
      value: claimCounts.draft ?? 0,
      label: 'Draft claims',
      caption: 'Not yet submitted',
      tone: styles.toneBlue,
      tab: 2,
    },
    {
      key: 'rework',
      Icon: WarningAlt,
      value: (claimCounts.rejected ?? 0) + (claimCounts.recalled ?? 0),
      label: 'Claims to rework',
      caption: 'Rejected or recalled',
      tone: styles.toneRed,
      tab: 2,
    },
    {
      key: 'reconcile',
      Icon: Wallet,
      value: toReconcile,
      label: 'Remittances to reconcile',
      caption: 'Payment advice received',
      tone: styles.toneTeal,
      tab: 2,
    },
  ];

  return (
    <>
            <div className={styles.bcLayout}>
              <div className={styles.bcHeader}>
                <div className={styles.bcHeaderTitle}>
                  <h4>Billing and Claims Dashboard</h4>
                </div>
                <div className={styles.bcHeaderStats}></div>
              </div>
              <div className={styles.bcContent}>
                <div className={styles.bcContentFilters}>
                  <DatePicker
                    datePickerType="single"
                    locale="en"
                    onChange={handleDateChange}
                    onClose={() => { }}
                    onOpen={() => { }}
                  >
                    <DatePickerInput id="date-picker-single" labelText="Date" placeholder="mm/dd/yyyy" />
                  </DatePicker>
                </div>
                <div className={styles.bcContentTabs}>
                  <Tabs>
                    <TabList scrollDebounceWait={200}>
                      <Tab>Active Visits</Tab>
                      <Tab>Bills</Tab>
                      <Tab>Claims</Tab>
                    </TabList>
                    <TabPanels>
                      <TabPanel>
                        <ActiveVisits />
                      </TabPanel>
                      <TabPanel>
                        <FacilityBills locationUuid={locationUuid} billingDate={billingDate} />
                      </TabPanel>
                      <TabPanel>
                        <ClaimVisits locationUuid={locationUuid} billingDate={billingDate} />
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
