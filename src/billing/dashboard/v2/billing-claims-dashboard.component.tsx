import React, { useEffect, useMemo, useState } from 'react';
import styles from './billing-claims-dashboard.component.scss';
import { DatePicker, DatePickerInput, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Wallet } from '@carbon/react/icons';
import FacilityBills from './facility-bills/facility-bills.component';
import Preauths from './facility-bills/preauths.component';
import ClaimsAccounting from './claims-accounting/claims-accounting.component';
import { useSession } from '@openmrs/esm-framework';
import ActiveVisits from './active-visits/active-visits.component';
import Clearance from './clearance/clearance.component';
import { billBalance, getPayableBills } from './cash-checklist/cash-checklist.resource';
import { getClearanceCounts } from '../../../shared/services/consultation-clearance.resource';
import { claimVisitToken, useFacilityClaimVisits, useLiveClaimStates } from '../../billing-claims.resource';
import { CLAIM_BUCKETS } from './facility-bills/claim-status';
import {
  MetricsCard,
  MetricsCardHeader,
  MetricsCardBody,
  MetricsCardItem,
} from '../../../service-queues/metrics/metrics-cards/metrics-card.component';
import FacilityAndWorkerSlot from '../../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
interface billingClaimsDashboardProps { }

const today = () => new Date().toLocaleDateString('en-CA');

// The chosen filter date is held at module scope, not in component state alone, so it
// survives this dashboard unmounting and remounting while the user stays inside the
// billing route — opening a bill's invoice or the claim workspace and coming back.
// Deliberately not sessionStorage: a page reload should drop it and start on today.
let lastSelectedDate: string | null = null;

/**
 * Forget the remembered date so the dashboard opens on today again. Called when the
 * user leaves the billing route altogether (see BillingRoot) or re-clicks the
 * "Accounting" side-nav link, both of which are a request for a fresh view.
 */
export function resetBillingDateFilter() {
  lastSelectedDate = null;
}

const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const [billingDate, setBillingDate] = useState<string>(() => lastSelectedDate ?? today());
  const [awaiting, setAwaiting] = useState(0);
  const [cashDue, setCashDue] = useState(0);
  const [selectedTab, setSelectedTab] = useState(0);
  // Which payer tab / status bucket the bills tab should open on, with a nonce so
  // clicking the same tile twice still navigates.
  const [billsNav, setBillsNav] = useState<{ payerTab?: number; statusKey?: string; nonce: number }>({ nonce: 0 });
  // When a facility bill is drilled into, its details take over the whole page — the
  // dashboard header, metric tiles and tabs are hidden so the details aren't buried.
  const [billsDetailsOpen, setBillsDetailsOpen] = useState(false);
  // Which sub-tab to open, with a nonce so repeat clicks still re-navigate.
  const [claimsNav, setClaimsNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });
  const [clearanceNav, setClearanceNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });

  useEffect(() => {
    if (locationUuid) {
      getClearanceCounts(locationUuid).then((c) => setAwaiting(c.awaiting));
    }
    getPayableBills(locationUuid).then((bills) => setCashDue(bills.filter((b) => billBalance(b) > 0).length));
  }, [locationUuid]);

  // The claim tiles count the same claims the bills tab lists, by the same live states.
  // They used to read a demo store, so they reported fixtures rather than this facility's
  // claims. The claim-state cache is shared, so counting here costs no extra HIE calls
  // beyond the ones the bills tab already makes.
  const { claimVisits, loading: claimVisitsLoading } = useFacilityClaimVisits(locationUuid, billingDate);
  const claimTokens = useMemo(() => claimVisits.map(claimVisitToken).filter(Boolean), [claimVisits]);
  const { states: liveClaimStates, settled: claimStatesSettled } = useLiveClaimStates(claimTokens, locationUuid);

  // Held back until every state is confirmed: a count off the stored states would name
  // claims as drafts that were submitted days ago.
  const claimCountsReady = !claimVisitsLoading && claimStatesSettled;
  const claimCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const bucket of CLAIM_BUCKETS) {
      const statuses = new Set(bucket.statuses.map((s) => s.toUpperCase()));
      counts[bucket.key] = claimVisits.filter((cv) => {
        const state = (liveClaimStates[claimVisitToken(cv)] || cv.visitResponse?.workflow_state || '')
          .trim()
          .toUpperCase();
        return statuses.has(state);
      }).length;
    }
    return counts;
  }, [claimVisits, liveClaimStates]);

  const claimTileValue = (bucketKey: string) => (claimCountsReady ? (claimCounts[bucketKey] ?? 0) : 0);

  const summary: {
    key: string;
    label: string;
    unit: string;
    value: number;
    tab: number;
    color?: 'red';
    clearKey?: string;
    billsPayerTab?: number;
    billsStatusKey?: string;
  }[] = [
    { key: 'awaiting', label: 'Awaiting clearance', unit: 'Patients', value: awaiting, tab: 0, clearKey: 'pending' },
    { key: 'cashdue', label: 'Facility bills', unit: 'Patients', value: cashDue, tab: 1, billsPayerTab: 0 },
    // Straight to the bucket being counted: the SHA claims tab, Drafts / Rejected.
    {
      key: 'draft',
      label: 'Draft claims',
      unit: 'Claims',
      value: claimTileValue('draft'),
      tab: 1,
      billsPayerTab: 1,
      billsStatusKey: 'draft',
    },
    {
      key: 'rejected',
      label: 'Rejected claims',
      unit: 'Claims',
      value: claimTileValue('rejected'),
      color: 'red',
      tab: 1,
      billsPayerTab: 1,
      billsStatusKey: 'rejected',
    },
  ];

  const handleTileClick = (s: {
    tab: number;
    clearKey?: string;
    billsPayerTab?: number;
    billsStatusKey?: string;
  }) => {
    setSelectedTab(s.tab);
    if (s.clearKey) {
      setClearanceNav((p) => ({ key: s.clearKey, nonce: p.nonce + 1 }));
    }
    if (s.billsPayerTab !== undefined || s.billsStatusKey) {
      setBillsNav((p) => ({ payerTab: s.billsPayerTab, statusKey: s.billsStatusKey, nonce: p.nonce + 1 }));
    }
  };

  // Date filter now lives beside the search in each tab's toolbar (see TableToolbar).
  const handleDateChange = (value: string) => {
    const next = value || today();
    lastSelectedDate = next;
    setBillingDate(next);
  };
  return (
    <>
      <div className={styles.bcLayout}>
        {!billsDetailsOpen ? (
          <>
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
          </>
        ) : null}
        <div className={styles.bcContent}>
          <div className={styles.bcContentTabs}>
            {!billsDetailsOpen ? (
              <DatePicker
                className={styles.tabRowDate}
                datePickerType="single"
                dateFormat="Y-m-d"
                value={billingDate}
                maxDate={today()}
                onChange={(dates) =>
                  handleDateChange(dates?.[0] ? (dates[0] as Date).toLocaleDateString('en-CA') : '')
                }
              >
                <DatePickerInput id="billing-date" labelText="" placeholder="yyyy-mm-dd" size="sm" />
              </DatePicker>
            ) : null}
            <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
              {/* Tab list hidden while a bill's details are open, but the panels stay
                  mounted so FacilityBills keeps its selected patient and fetched data. */}
              <TabList scrollDebounceWait={200} className={billsDetailsOpen ? styles.hiddenTabList : undefined}>
                <Tab>Pending clearance</Tab>
                <Tab>Facility bills</Tab>
                <Tab>Preauthorizations</Tab>
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
                        <ActiveVisits date={billingDate} />
                      </>
                    }
                    initialTab={clearanceNav.key}
                    navNonce={clearanceNav.nonce}
                    date={billingDate}
                  />
                </TabPanel>
                <TabPanel>
                  <FacilityBills
                    locationUuid={locationUuid}
                    billingDate={billingDate}
                    onDetailsOpenChange={setBillsDetailsOpen}
                    navPayerTab={billsNav.payerTab}
                    navStatusKey={billsNav.statusKey}
                    navNonce={billsNav.nonce}
                  />
                </TabPanel>
                <TabPanel>
                  <Preauths />
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
