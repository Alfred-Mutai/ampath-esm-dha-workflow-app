import React, { useEffect, useState } from 'react';
import styles from './billing-claims-dashboard.component.scss';
import { DatePicker, DatePickerInput, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Wallet } from '@carbon/react/icons';
import FacilityBills from './facility-bills/facility-bills.component';
import ClaimsAccounting from './claims-accounting/claims-accounting.component';
import { useSession } from '@openmrs/esm-framework';
import ActiveVisits from './active-visits/active-visits.component';
import Clearance from './clearance/clearance.component';
import CashChecklist from './cash-checklist/cash-checklist.component';
import { billBalance, getPayableBills } from './cash-checklist/cash-checklist.resource';
import { getClearanceCounts } from '../../../shared/services/consultation-clearance.resource';
import { getClaimCounts } from './claims-accounting/claims-accounting.resource';
import {
  MetricsCard,
  MetricsCardHeader,
  MetricsCardBody,
  MetricsCardItem,
} from '../../../service-queues/metrics/metrics-cards/metrics-card.component';
import FacilityAndWorkerSlot from '../../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
interface billingClaimsDashboardProps { }
const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const [billingDate, setBillingDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [awaiting, setAwaiting] = useState(0);
  const [cashDue, setCashDue] = useState(0);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [selectedTab, setSelectedTab] = useState(0);
  const [billsSub, setBillsSub] = useState(0);
  // Which sub-tab to open, with a nonce so repeat clicks still re-navigate.
  const [claimsNav, setClaimsNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });
  const [clearanceNav, setClearanceNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });
  const hideCheckList = true;

  useEffect(() => {
    if (locationUuid) {
      getClearanceCounts(locationUuid).then((c) => setAwaiting(c.awaiting));
    }
    getClaimCounts().then(setClaimCounts);
    getPayableBills(locationUuid).then((bills) => setCashDue(bills.filter((b) => billBalance(b) > 0).length));
  }, [locationUuid]);

  const summary: {
    key: string;
    label: string;
    unit: string;
    value: number;
    tab: number;
    color?: 'red';
    claimKey?: string;
    clearKey?: string;
    billsSub?: number;
  }[] = [
    { key: 'awaiting', label: 'Awaiting clearance', unit: 'Patients', value: awaiting, tab: 0, clearKey: 'pending' },
    { key: 'cashdue', label: 'Cash due', unit: 'Patients', value: cashDue, tab: 1, billsSub: 0 },
    { key: 'pending', label: 'Pending claims', unit: 'Claims', value: claimCounts.pending ?? 0, tab: 2, claimKey: 'pending' },
    { key: 'rejected', label: 'Rejected claims', unit: 'Claims', value: claimCounts.rejected ?? 0, color: 'red', tab: 2, claimKey: 'rejected' },
    { key: 'resubmission', label: 'Needs resubmission', unit: 'Claims', value: claimCounts.resubmission ?? 0, tab: 2, claimKey: 'resubmission' },
  ];

  const handleTileClick = (s: { tab: number; claimKey?: string; clearKey?: string; billsSub?: number }) => {
    setSelectedTab(s.tab);
    if (s.claimKey) {
      setClaimsNav((p) => ({ key: s.claimKey, nonce: p.nonce + 1 }));
    }
    if (s.clearKey) {
      setClearanceNav((p) => ({ key: s.clearKey, nonce: p.nonce + 1 }));
    }
    if (s.billsSub !== undefined) {
      setBillsSub(s.billsSub);
    }
  };

  // Date filter now lives beside the search in each tab's toolbar (see TableToolbar).
  const handleDateChange = (value: string) => {
    setBillingDate(value || new Date().toLocaleDateString('en-CA'));
  };
  return (
    <>
      <div className={styles.bcLayout}>
        <div className={styles.hwrSection}>
          <FacilityAndWorkerSlot />
        </div>
        <div className={styles.bcHeader}>
          <span className={styles.bcHeaderIcon}>
            <Wallet size={24} />
          </span>
          <div className={styles.bcHeaderTitle}>
            <h3 className={styles.bcTitle}>Billing &amp; Claims</h3>
            <p className={styles.bcSubtitle}>Consultation clearance, facility bills and SHA claims.</p>
          </div>
        </div>
        <div className={styles.summaryRow}>
          {summary.map((s) => (
            <button key={s.key} type="button" className={styles.metricButton} onClick={() => handleTileClick(s)}>
              <MetricsCard>
                <MetricsCardHeader title={s.label} />
                <MetricsCardBody>
                  <MetricsCardItem label={s.unit} value={s.value ? s.value : '--'} color={s.color} />
                </MetricsCardBody>
              </MetricsCard>
            </button>
          ))}
        </div>
        <div className={styles.bcContent}>
          <div className={styles.bcContentTabs}>
            <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
              <TabList scrollDebounceWait={200}>
                <Tab>Pending clearance</Tab>
                <Tab>Bills</Tab>
                {/* <Tab>Claims</Tab> */}
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
                  <Tabs selectedIndex={billsSub} onChange={({ selectedIndex }) => setBillsSub(selectedIndex)}>
                    <TabList aria-label="Bills">
                      <Tab>Facility bills</Tab>
                    </TabList>
                    <TabPanels>
                      <TabPanel>
                        <FacilityBills
                          locationUuid={locationUuid}
                          billingDate={billingDate}
                          onDateChange={handleDateChange}
                        />
                      </TabPanel>

                      {
                        hideCheckList ? (<></>) : (<>
                          <TabPanel>
                            <CashChecklist />
                          </TabPanel>
                        </>)
                      }


                    </TabPanels>
                  </Tabs>
                </TabPanel>
                {/* <TabPanel>
                  <ClaimsAccounting initialTabKey={claimsNav.key} navNonce={claimsNav.nonce} locationUuid={locationUuid}
                    billingDate={billingDate}
                    onDateChange={handleDateChange} />
                </TabPanel> */}
              </TabPanels>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
};

export default BillingClaimsDashboard;
