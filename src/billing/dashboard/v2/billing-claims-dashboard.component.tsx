import React, { useEffect, useMemo, useState } from 'react';
import styles from './billing-claims-dashboard.component.scss';
import { DatePicker, DatePickerInput, Tab, TabList, TabPanel, TabPanels, Tabs, Tooltip } from '@carbon/react';
import { Information, Wallet } from '@carbon/react/icons';
import FacilityBills, {
  CASH_PAYER_TAB,
  resetFacilityBillsFilters,
  SHA_PAYER_TAB,
} from './facility-bills/facility-bills.component';
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
import PreauthorizationsTab from './preauth/preauthorizations-tab.component';
import AdmissionRequestsTab from './admissions/admission-requests-tab.component';
import InpatientRequests from './inpatient-requests/inpatient-requests.component';
interface billingClaimsDashboardProps {}

const today = () => new Date().toLocaleDateString('en-CA');

/* The dashboard's own tabs, in order. Named because the summary tiles navigate by index,
   and a bare number stopped saying which tab it meant once SHA claims was inserted in the
   middle of the row. */
const TAB_PENDING_CLEARANCE = 0;
const TAB_FACILITY_BILLS = 1;
const TAB_SHA_CLAIMS = 2;

/* What each tab is for, on the tab itself. They were paragraphs standing above the tables
   — three lines of standing copy on a page opened dozens of times a day, read once.
   Kept to two short sentences each: what the tab lists, then what you do there. A tooltip
   is capped at a few hundred pixels wide, so a paragraph in one becomes a tall column that
   runs off the screen rather than something anyone reads on the way past. */
const PENDING_HINT =
  'Visits that have started but are not in a service queue yet. Send each patient to triage, then mark their consultation fee paid to release them to be seen.';
const BILLS_HINT =
  'Bills settled at the cash point, for the selected date. Open a patient for the itemised bill, payments received and the balance outstanding.';
const CLAIMS_HINT =
  'SHA claims for the selected date, grouped by status. Open one to check its diagnoses, interventions and invoices, or to submit or close it.';
const PREAUTH_HINT =
  'Preauths for the selected date. Needs raise lists items still waiting for one; Status shows their live position at SHA and can resend doctor consent.';
const ADMISSIONS_HINT =
  'Patients a clinician has asked to admit at this facility. Admit one to a bed, or start the SHA claim for the inpatient visit it opens.';

/**
 * An explanation hung off a tab's label.
 *
 * A `title` prop on the `Tab` itself is dropped: Carbon spreads `rest` onto the button and
 * then sets `title: children` afterwards, so the tab's own label always wins. A `title` on
 * an inner span does work, but a native tooltip waits about a second before appearing,
 * which is long enough that people stop expecting one.
 *
 * So the hint is a Carbon `Tooltip` with its delay taken off. It nests inside the tab
 * because Carbon's Tooltip does not inject a trigger of its own — it clones event handlers
 * and aria attributes onto whatever child it is given, and notably not `tabIndex`, so the
 * icon stays inert and the tab keeps sole ownership of focus and keyboard handling.
 *
 * `autoAlign` matters here: the tab list scrolls (`overflow-x: auto`), which would clip a
 * statically positioned bubble. Floating-ui places it outside that clipping context — the
 * same thing Carbon does for its own overflowing-tab-label tooltip.
 */
const TabHint: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip label={text} align="bottom" enterDelayMs={0} leaveDelayMs={0} autoAlign className={styles.tabHint}>
    <span className={styles.tabHintIcon}>
      <Information size={16} />
    </span>
  </Tooltip>
);

// The chosen filter date is held at module scope, not in component state alone, so it
// survives this dashboard unmounting and remounting while the user stays inside the
// billing route — opening a bill's invoice or the claim workspace and coming back.
// Deliberately not sessionStorage: a page reload should drop it and start on today.
let lastSelectedDate: string | null = null;
// Same reasoning for the open tab: opening a claim now navigates to the claim's own
// page, which unmounts this dashboard, and the breadcrumb back should return to the tab
// the claim was picked from rather than the first one.
let lastSelectedTab: number | null = null;

/**
 * Forget the remembered date, tab and bill filters so the dashboard opens fresh. Called
 * when the user leaves the billing route altogether (see BillingRoot) or re-clicks the
 * "Accounting" side-nav link, both of which are a request for a fresh view.
 */
/**
 * The date the dashboard is currently filtered to, or null when it has been forgotten.
 * The claim page uses it to look up a claim on the day it was being read before falling
 * back to searching the whole location.
 */
export function rememberedBillingDate(): string | null {
  return lastSelectedDate;
}

export function resetBillingDateFilter() {
  lastSelectedDate = null;
  lastSelectedTab = null;
  resetFacilityBillsFilters();
}

const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const [billingDate, setBillingDate] = useState<string>(() => lastSelectedDate ?? today());
  const [awaiting, setAwaiting] = useState(0);
  const [cashDue, setCashDue] = useState(0);
  const [selectedTab, setSelectedTab] = useState(() => lastSelectedTab ?? 0);
  // Which status bucket the bills tab should open on, with a nonce so clicking the same
  // tile twice still navigates. The payer is no longer part of it: each payer is its own
  // dashboard tab now, so `tab` alone says which list a tile means.
  const [billsNav, setBillsNav] = useState<{ statusKey?: string; nonce: number }>({ nonce: 0 });
  // Which sub-tab to open, with a nonce so repeat clicks still re-navigate.
  const [clearanceNav, setClearanceNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });
  // The SHA claims tab has its own, since it is a separate instance of FacilityBills and
  // sharing billsNav would send both lists to the same bucket.
  const [claimsNav, setClaimsNav] = useState<{ statusKey?: string; nonce: number }>({ nonce: 0 });

  useEffect(() => {
    lastSelectedTab = selectedTab;
  }, [selectedTab]);

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
    billsStatusKey?: string;
    claimsStatusKey?: string;
  }[] = [
    {
      key: 'awaiting',
      label: 'Awaiting clearance',
      unit: 'Patients',
      value: awaiting,
      tab: TAB_PENDING_CLEARANCE,
      clearKey: 'pending',
    },
    {
      key: 'cashdue',
      label: 'Facility bills',
      unit: 'Patients',
      value: cashDue,
      tab: TAB_FACILITY_BILLS,
      // The tile counts bills still owing, so it lands on the bucket holding them rather
      // than on whichever one was last being read.
      billsStatusKey: 'pending',
    },
    // Straight to the bucket being counted: the SHA claims tab, Drafts / Rejected.
    {
      key: 'draft',
      label: 'Draft claims',
      unit: 'Claims',
      value: claimTileValue('draft'),
      tab: TAB_SHA_CLAIMS,
      claimsStatusKey: 'draft',
    },
    {
      key: 'rejected',
      label: 'Rejected claims',
      unit: 'Claims',
      value: claimTileValue('rejected'),
      color: 'red',
      tab: TAB_SHA_CLAIMS,
      claimsStatusKey: 'rejected',
    },
  ];

  const handleTileClick = (s: {
    tab: number;
    clearKey?: string;
    billsStatusKey?: string;
    claimsStatusKey?: string;
  }) => {
    setSelectedTab(s.tab);
    if (s.clearKey) {
      setClearanceNav((p) => ({ key: s.clearKey, nonce: p.nonce + 1 }));
    }
    if (s.billsStatusKey) {
      setBillsNav((p) => ({ statusKey: s.billsStatusKey, nonce: p.nonce + 1 }));
    }
    if (s.claimsStatusKey) {
      setClaimsNav((p) => ({ statusKey: s.claimsStatusKey, nonce: p.nonce + 1 }));
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
        <div className={styles.bcHeader}>
          <span className={styles.bcHeaderIcon}>
            <Wallet size={24} />
          </span>
          <div className={styles.bcHeaderTitle}>
            <h3 className={styles.bcTitle}>Billing &amp; Claims</h3>
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
            <DatePicker
              className={styles.tabRowDate}
              datePickerType="single"
              dateFormat="Y-m-d"
              value={billingDate}
              maxDate={today()}
              onChange={(dates) => handleDateChange(dates?.[0] ? (dates[0] as Date).toLocaleDateString('en-CA') : '')}
            >
              <DatePickerInput id="billing-date" labelText="" placeholder="yyyy-mm-dd" size="sm" />
            </DatePicker>
            <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
              {/* Tab list hidden while a bill's details are open, but the panels stay
                  mounted so FacilityBills keeps its selected patient and fetched data. */}
              <TabList scrollDebounceWait={200}>
                <Tab>
                  Pending clearance
                  <TabHint text={PENDING_HINT} />
                </Tab>
                <Tab>
                  Facility bills
                  <TabHint text={BILLS_HINT} />
                </Tab>
                <Tab>
                  SHA claims
                  <TabHint text={CLAIMS_HINT} />
                </Tab>
                <Tab>
                  Preauthorizations
                  <TabHint text={PREAUTH_HINT} />
                </Tab>
                {/* <Tab>Preauth List</Tab> */}
                {/* <Tab>Claims</Tab> */}
                <Tab>
                  Admission Requests
                  <TabHint text={ADMISSIONS_HINT} />
                </Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <Clearance
                    // The paragraph that introduced this list now hangs off the tab that
                    // opens it — see PENDING_HINT in Clearance.
                    pendingTab={<ActiveVisits date={billingDate} />}
                    initialTab={clearanceNav.key}
                    navNonce={clearanceNav.nonce}
                    date={billingDate}
                  />
                </TabPanel>
                <TabPanel>
                  <FacilityBills
                    locationUuid={locationUuid}
                    billingDate={billingDate}
                    payerTab={CASH_PAYER_TAB}
                    navStatusKey={billsNav.statusKey}
                    navNonce={billsNav.nonce}
                  />
                </TabPanel>
                <TabPanel>
                  {/* The same table on the SHA payer. It was a sub-tab inside Facility
                      bills; claims are read often enough, and are enough their own thing,
                      to be reached in one click rather than two. */}
                  <FacilityBills
                    locationUuid={locationUuid}
                    billingDate={billingDate}
                    payerTab={SHA_PAYER_TAB}
                    navStatusKey={claimsNav.statusKey}
                    navNonce={claimsNav.nonce}
                  />
                </TabPanel>
                <TabPanel>
                  <PreauthorizationsTab
                    locationUuid={locationUuid}
                    billingDate={billingDate}
                    onDateChange={handleDateChange}
                  />
                </TabPanel>
                <TabPanel>
                  {/* This tab had no panel at all — five tabs against four panels, so
                      selecting it showed the preauth list or nothing depending on how
                      Carbon indexed them. */}
                  <AdmissionRequestsTab locationUuid={locationUuid} />
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
