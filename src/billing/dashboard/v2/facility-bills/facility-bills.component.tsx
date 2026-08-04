import React, { useEffect, useMemo, useState } from 'react';
import { type FacilityBillsDto, type FacilityBill, type ClaimVisitReponse, type PatientBill } from '../types';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Pagination,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Tag,
} from '@carbon/react';
import { Renew, WarningAltFilled } from '@carbon/react/icons';
import { formatDate, parseDate, showSnackbar, usePagination } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  claimVisitGuid,
  claimVisitToken,
  fetchFacilityBills,
  useFacilityClaimVisits,
  useLiveClaimStates,
} from '../../../billing-claims.resource';
import styles from './facility-bills.component.scss';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';
import { ALL_BILL_BUCKETS, CLAIM_BUCKETS, PAYMENT_BUCKETS, type StatusBucket, statusMeta } from './claim-status';

// Show the CR with its "CR" prefix, e.g. CR7138388758297-0; dash when absent.
const formatCr = (value?: string | null): string => {
  const v = (value ?? '').trim();
  if (!v) return '—';
  return /^cr/i.test(v) ? v : `CR${v}`;
};

// The same CR reaches us with and without its prefix and in either case — the bills
// endpoint and the claims-visit endpoint don't agree — so both sides are put through
// this before being matched.
const crKey = (value?: string | null): string => {
  const v = (value ?? '').trim().toUpperCase();
  if (!v) return '';
  return v.startsWith('CR') ? v : `CR${v}`;
};

// The bills endpoint carries no payment mode; a consent token means the visit was
// authorised through SHA/HIE, anything else is settled at the cash point.
const paymentMode = (bill: PatientBill): string => ((bill.consent_token ?? '').trim() ? 'SHA' : 'Cash');

// Claim visits are listed with the time of day, not just the date: the same claim can be
// recorded against several visits on one day, and the start time is what tells those
// rows apart.
const formatVisitDate = (value?: string | null): string => {
  const v = (value ?? '').trim();
  if (!v) {
    return '';
  }
  try {
    return formatDate(parseDate(v), { time: true, noToday: true });
  } catch {
    return v;
  }
};

// A bill's paid_status is a comma-separated per-line-item list; the bill is only paid
// once every line is.
function formatStatusColumn(status: string): string {
  const statusArr = (status ?? '').split(',');
  if (statusArr.length > 0) {
    if (statusArr.some((s) => s === 'POSTED')) {
      return 'PARTIALLY PAID';
    }
    if (statusArr.some((s) => s === 'PENDING')) {
      return 'PENDING';
    }
    return 'PAID';
  }
  return status;
}

/**
 * One table row, whatever it was built from — a cash bill or a SHA claim. The two
 * sources describe different things (a bill is what was charged, a claim is what was
 * filed with the payer), so they are normalised here rather than at the point of
 * rendering.
 */
interface BillRow {
  id: string;
  patientName: string;
  crNumber: string;
  visitType: string;
  /** Raw status, used both for bucketing and for the tag: a claim's workflow_state, or
      a bill's payment status. */
  status: string;
  billDate: string;
  /** Set only when a facility bill backs this row. The bill-details drill-down is keyed
      on the OpenMRS patient uuid, which /claims-visit doesn't carry, so a claim with no
      matching bill has no bill to open. */
  patientUuid: string;
  /** Set on claim rows. Opens the claim itself — the one way in for a claim no bill was
      raised against. */
  consentToken: string;
  /** The claim's authorization guid, which is what its page is addressed by. Empty on
      rows built from a bill, which carries no guid. */
  claimGuid: string;
  /** Everything the free-text search looks at, pre-joined. */
  searchText: string;
  lineItems?: FacilityBill['bill_items'];
}

const billRow = (fb: PatientBill): BillRow => {
  const status = formatStatusColumn(fb.bill_status);
  return {
    id: `bill-${fb.bill_uuid}`,
    patientName: fb.patient_name,
    crNumber: formatCr(fb.identifiers),
    visitType: fb.visit_type || '—',
    status,
    billDate: fb.bill_date || '—',
    patientUuid: fb.patient_uuid ?? '',
    consentToken: (fb.consent_token ?? '').trim(),
    claimGuid: '',
    // The cash point is no longer a column but is still searchable — it's how a cashier
    // finds their own bills.
    searchText: `${fb.patient_name} ${formatCr(fb.identifiers)}  ${fb.receipt_number ?? ''} ${
      fb.visit_type ?? ''
    } ${status} ${fb.cash_point ?? ''}`.toLowerCase(),
    lineItems: fb.bill_items,
  };
};

// Newest claim visit first, so the most recent work is at the top of the tab. Anything
// without a usable timestamp sorts by the record id instead.
const claimTime = (cv: ClaimVisitReponse): number => {
  const parsed = Date.parse(cv.dateCreated ?? cv.visitStart ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Every record /claims-visit returns is a row.
 *
 * The same HIE claim can come back more than once — the same claimVisitId and
 * authorization code against several local visits, e.g. ids 59 and 61 of visit
 * 2403e12b — and each of those is its own claim visit with its own visit number, so
 * each is listed. Collapsing them would hide a visit that was actually recorded.
 */
const orderClaimVisits = (visits: ClaimVisitReponse[]): ClaimVisitReponse[] =>
  [...(visits ?? [])].sort((a, b) => claimTime(b) - claimTime(a) || (b.id ?? 0) - (a.id ?? 0));

// Status buckets for a payer tab: cash, SHA claims, or both vocabularies together.
const bucketsForTab = (index: number): StatusBucket[] =>
  index === 0 ? PAYMENT_BUCKETS : index === 1 ? CLAIM_BUCKETS : ALL_BILL_BUCKETS;

/**
 * Which payer an instance of this component lists. Each is a tab of the dashboard now —
 * they were sub-tabs inside this component, and a payer bar under a tab that already
 * named the payer was a second row of tabs saying the same thing.
 *
 * The numbers are the payer vocabulary read throughout — `bucketsForTab`, `activeRows`,
 * `payerNoun` all switch on them — so they are named rather than renumbered.
 */
export const CASH_PAYER_TAB = 0;
export const SHA_PAYER_TAB = 1;
export const ALL_BILLS_PAYER_TAB = 2;

// The status sub-tab a payer opens on: Draft when it has one (SHA / preauths), else
// Pending (cash), else the first bucket.
const defaultBucketKey = (buckets: StatusBucket[]): string => {
  const preferred = buckets.find((b) => b.key === 'draft') ?? buckets.find((b) => b.key === 'pending');
  return (preferred ?? buckets[0])?.key ?? '';
};

// The status bucket last being read, held at module scope so it survives this tab
// unmounting while the user stays inside billing — which is what opening a claim now does,
// since a claim has its own route. Deliberately not persisted any further: a page reload
// should start on the defaults. Cleared with the date filter when the user leaves billing
// altogether (see resetFacilityBillsFilters callers).
//
// Kept per payer. Each payer is a separate instance of this component and both are mounted
// at once inside the dashboard's tab panels, so a single slot would have them overwrite
// each other's memory on every render — and the buckets aren't even the same vocabulary.
const lastStatusFilterByPayer: Record<number, string> = {};

/** Forget the remembered status buckets, so each tab opens on its default. */
export function resetFacilityBillsFilters() {
  for (const key of Object.keys(lastStatusFilterByPayer)) {
    delete lastStatusFilterByPayer[Number(key)];
  }
}

interface facilityBillsProps {
  billingDate: string;
  locationUuid: string;
  onDateChange?: (value: string) => void;
  /** Which payer this instance lists — one of the `*_PAYER_TAB` constants. */
  payerTab: number;
  /** Status bucket to open on when a dashboard tile is clicked. `navNonce` changes on
      every click, so clicking the same tile twice still navigates. */
  navStatusKey?: string;
  navNonce?: number;
}
const FacilityBills: React.FC<facilityBillsProps> = ({
  billingDate,
  locationUuid,
  onDateChange,
  payerTab,
  navStatusKey,
  navNonce,
}) => {
  const [facilityBills, setFacilityBills] = useState<PatientBill[]>([]);
  // The SHA claims themselves, straight from /claims-visit — the rows of the SHA tab and
  // the source of every claim status shown on this page. Shared with the dashboard tiles,
  // so a tile and this table can't disagree about which claims exist.
  const {
    claimVisits,
    loading: claimsLoading,
    reload: loadClaimVisits,
  } = useFacilityClaimVisits(locationUuid, billingDate);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  // Fixed for the life of this instance — the dashboard tab that mounted it is what
  // chooses the payer. Kept under the old name because the payer index is read in a dozen
  // places below and it is the same number it always was.
  const tabIndex = payerTab;
  // Selected status bucket key ('' = All). Defaults to the first bucket of the payer
  // (Drafts for SHA claims, Pending for cash).
  const [statusFilter, setStatusFilter] = useState<string>(
    () => lastStatusFilterByPayer[payerTab] ?? defaultBucketKey(bucketsForTab(payerTab)),
  );
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  useEffect(() => {
    if (locationUuid && billingDate) {
      getFacilityBills();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingDate, locationUuid]);

  // Remember what is being read, so opening a claim — which now navigates away to the
  // claim's own page — and coming back lands on the same status bucket.
  useEffect(() => {
    lastStatusFilterByPayer[payerTab] = statusFilter;
  }, [payerTab, statusFilter]);

  async function getFacilityBills() {
    setLoading(true);
    const facilityBillsPayload = generateFacilityBillsPayload();
    try {
      const data = await fetchFacilityBills(facilityBillsPayload);
      console.log('FACILITY BILLS', data);
      setFacilityBills(data ?? []);
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching facility bills',
        subtitle: 'An error occurred while fetching facility bills, please reload or contact support',
      });
    } finally {
      setLoading(false);
    }
  }
  function generateFacilityBillsPayload(): FacilityBillsDto {
    return {
      locationUuid: locationUuid ?? '',
      billingDate: billingDate,
    };
  }

  /**
   * Open a row. The patient name is the way in, on every tab.
   *
   * A claim goes to its own page, addressed by its consent token, so it can be linked to
   * and reloaded and Back returns here. Elsewhere the patient view is the comprehensive
   * one — bill items, diagnosis, payments and the claim together — and it is keyed on the
   * OpenMRS patient uuid, which only a matched bill gives us; the claim page is the
   * fallback for a bill-less claim.
   */
  function openRowDetails(patientUuid: string, consentToken: string, claimGuid: string) {
    // On the SHA tab every row *is* a claim, so the claim page is what it opens, even
    // when a bill was matched to it.
    if (consentToken && (tabIndex === 1 || !patientUuid)) {
      // Addressed by the claim's authorization guid. The token goes along in router
      // state so the page doesn't have to look the claim up again on the way in — it
      // only falls back to a lookup when the URL is opened cold.
      navigate(`/claim/${encodeURIComponent(claimGuid || consentToken)}`, { state: { consentToken } });
      return;
    }
    if (patientUuid) {
      // The bill has its own route now, the same as the claim above — so it can be linked
      // to and reloaded, and Back returns to this list rather than leaving billing.
      navigate(`/bill/${encodeURIComponent(patientUuid)}`);
    }
  }
  // Split the bills by payer so each tab shows only its own.
  // const cashBills = useMemo(() => (facilityBills ?? []).filter((fb) => paymentMode(fb) === 'Cash'), [facilityBills]);
  // const shaBills = useMemo(() => (facilityBills ?? []).filter((fb) => paymentMode(fb) === 'SHA'), [facilityBills]);
  const shaBills = useMemo(
    () =>
      (facilityBills ?? []).filter((bill) => bill.bill_items.some((item) => item.price_name?.toUpperCase() === 'SHA')),
    [facilityBills],
  );
  const cashBills = useMemo(
    () =>
      (facilityBills ?? []).filter((bill) => {
        const hasSha = bill.bill_items.some((item) => item.price_name?.toUpperCase() === 'SHA');

        const hasCash = bill.bill_items.some((item) => item.price_name?.toUpperCase() === 'CASH');

        return hasCash && !hasSha;
      }),
    [facilityBills],
  );

  // Every claim listed for this date, by consent token, so its live state can be
  // resolved. Only the tabs that show claim statuses ask for them — the cash tab never
  // reads one, and each is a slow round trip to the HIE.
  const claimTokens = useMemo(() => (claimVisits ?? []).map(claimVisitToken).filter(Boolean), [claimVisits]);
  const {
    states: liveClaimStates,
    settled: statesSettled,
    failed: statesFailed,
  } = useLiveClaimStates(claimTokens, locationUuid, tabIndex !== 0);

  /**
   * The SHA tab lists claims, and its rows come from /claims-visit — the endpoint that
   * owns each claim's workflow_state — not from the bills. Deriving them from the bills
   * meant a claim only appeared once a bill had been raised and matched to it, so claims
   * filed against a visit with no bill (or one whose consent token didn't line up) were
   * missing from every status bucket.
   *
   * A bill is still looked up for each claim, for the thing a claim doesn't carry: the
   * OpenMRS patient uuid the bill drill-down needs. /claims-visit identifies the visit
   * two ways and the bills endpoint agrees with each on a different field — the
   * authorization code is the bill's consent token, patientId is its CR number — so both
   * are tried before giving up.
   */
  const { claimRows, matchedBillIds } = useMemo(() => {
    const byToken = new Map<string, PatientBill>();
    const byCr = new Map<string, PatientBill>();
    shaBills.forEach((fb) => {
      const token = (fb.consent_token ?? '').trim().toUpperCase();
      if (token && !byToken.has(token)) {
        byToken.set(token, fb);
      }
      const cr = crKey(fb.identifiers);
      if (cr && !byCr.has(cr)) {
        byCr.set(cr, fb);
      }
    });

    const matched = new Set<string>();
    const rows = orderClaimVisits(claimVisits ?? []).map((cv) => {
      const claim = cv.visitResponse;
      const consentToken = (cv.authorizationCode || claim?.authorization_code || '').trim();
      const token = consentToken.toUpperCase();
      const cr = crKey(cv.patientId || claim?.member_number);
      const bill = (token ? byToken.get(token) : undefined) ?? (cr ? byCr.get(cr) : undefined);
      if (bill) {
        matched.add(bill.bill_uuid);
      }
      // The live state when the claim preview has answered, and only until then the copy
      // /claims-visit stored when the visit was recorded — that copy is frozen at DRAFT
      // for any claim submitted since.
      const status = liveClaimStates[consentToken] || (claim?.workflow_state ?? '').trim();
      const patientName = claim?.patient_name || bill?.patient_name || '—';
      const crNumber = formatCr(cv.patientId || claim?.member_number);
      const visitType = cv.serviceType || claim?.service_type || bill?.visit_type || '—';
      const visitNumber = cv.claimVisitNumber || claim?.visit_number || '';
      return {
        // Keyed on the record id, not the claim: two records can share a claim.
        id: `claim-${cv.id}`,
        patientName,
        crNumber,
        visitType,
        status,
        billDate: formatVisitDate(cv.visitStart || claim?.visit_start) || bill?.bill_date || '—',
        patientUuid: bill?.patient_uuid ?? '',
        consentToken,
        claimGuid: claimVisitGuid(cv),
        searchText: `${patientName} ${crNumber} ${visitType} ${status} ${visitNumber} ${token} ${
          claim?.invoice_number ?? ''
        } ${bill?.cash_point ?? ''}`.toLowerCase(),
      } as BillRow;
    });
    return { claimRows: rows, matchedBillIds: matched };
  }, [claimVisits, shaBills, liveClaimStates]);

  const cashRows = useMemo(() => cashBills.map(billRow), [cashBills]);
  // SHA bills no claim was found for. They'd otherwise drop out of "All bills"
  // altogether, so they stay on as bill rows reporting what was paid.
  const unmatchedShaRows = useMemo(
    () => shaBills.filter((fb) => !matchedBillIds.has(fb.bill_uuid)).map(billRow),
    [shaBills, matchedBillIds],
  );
  // 0 = Cash bills, 1 = SHA claims, 2 = All bills (both payers together).
  const allRows = useMemo(
    () => [...cashRows, ...claimRows, ...unmatchedShaRows],
    [cashRows, claimRows, unmatchedShaRows],
  );
  const activeRows: BillRow[] = tabIndex === 0 ? cashRows : tabIndex === 1 ? claimRows : allRows;

  // Nothing is shown on the claim tabs until both halves are in: the claims themselves,
  // and the live state of every one of them. Rendering in between would put the stored
  // states on screen — DRAFT for claims long since submitted — and let them be acted on
  // before they silently corrected themselves.
  const rowsLoading = tabIndex !== 0 && (claimsLoading || !statesSettled);

  const statusOf = (row: BillRow): string => (row.status ?? '').trim().toUpperCase();
  /**
   * A status none of the buckets name — a claim state the HIE has added since, say —
   * would be listed under "All" and under no other sub-tab. Collecting the leftovers
   * into their own tab keeps the buckets honest: everything the endpoint returned is
   * reachable from somewhere.
   */
  const leftoverBucket = (rows: BillRow[], buckets: StatusBucket[]): StatusBucket | null => {
    const known = new Set(buckets.flatMap((b) => b.statuses.map((s) => s.toUpperCase())));
    const leftovers = Array.from(new Set(rows.map(statusOf))).filter((s) => !known.has(s));
    return leftovers.length ? { key: 'other', label: 'Other', statuses: leftovers } : null;
  };

  const baseBuckets = bucketsForTab(tabIndex);
  // Held back with the rest: an "Other" tab derived from states still being confirmed
  // would appear and then vanish as they land.
  const extraBucket = rowsLoading ? null : leftoverBucket(activeRows, baseBuckets);
  const statusBuckets: StatusBucket[] = extraBucket ? [...baseBuckets, extraBucket] : baseBuckets;
  const selectedBucket = statusBuckets.find((b) => b.key === statusFilter);
  const bucketMatches = (bucket: StatusBucket, row: BillRow): boolean =>
    bucket.statuses.some((s) => s.toUpperCase() === statusOf(row));

  // Rows in the current status bucket, before the free-text search is applied. Drives
  // whether the search box is shown (only when there's something to search).
  const bucketRows = activeRows.filter((row) => !selectedBucket || bucketMatches(selectedBucket, row));
  const filteredRows = bucketRows.filter((row) => {
    const term = search.trim().toLowerCase();
    return !term || row.searchText.includes(term);
  });

  const { goTo, results: paginatedRows, currentPage } = usePagination(filteredRows, currentPageSize);

  // A dashboard tile was clicked: open the payer tab it counted and the bucket it named,
  // so the number on the tile and the rows landed on are the same set.
  useEffect(() => {
    if (!navNonce) {
      return;
    }
    // The payer is fixed by the tab that mounted this, so only the bucket within it is
    // navigable — sending a tile to another payer is the dashboard's job now.
    if (navStatusKey) {
      setStatusFilter(navStatusKey);
    }
    setSearch('');
    goTo(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navNonce]);

  const columns = [
    { id: 'index', header: '#', key: 'index' },
    { id: 'patientName', header: 'Patient', key: 'patientName' },
    { id: 'crNumber', header: 'CR number', key: 'crNumber' },
    { id: 'visitType', header: 'Visit type', key: 'visitType' },
    { id: 'status', header: 'Status', key: 'status' },
    { id: 'billDate', header: 'Date', key: 'billDate' },
    // Carried on the row but never shown: what the patient name opens is decided from
    // these three.
    { id: 'patientUuid', header: '', key: 'patientUuid' },
    { id: 'consentToken', header: '', key: 'consentToken' },
    { id: 'claimGuid', header: '', key: 'claimGuid' },
  ];
  const hiddenColumns = ['patientUuid', 'consentToken', 'claimGuid'];

  const rows = paginatedRows.map((row, index) => ({
    id: `${row.id}-${index}`,
    index: (currentPage - 1) * currentPageSize + index + 1,
    patientName: row.patientName,
    crNumber: row.crNumber,
    visitType: row.visitType,
    status: row.status,
    billDate: row.billDate,
    patientUuid: row.patientUuid,
    consentToken: row.consentToken,
    claimGuid: row.claimGuid,
  }));

  const payerNoun = tabIndex === 1 ? 'SHA claims' : tabIndex === 2 ? 'bills' : 'cash bills';
  const emptyBillsMessage = selectedBucket
    ? `No ${payerNoun} under “${selectedBucket.label}”.`
    : search
      ? 'No bills match your search.'
      : `No ${payerNoun} for the selected date.`;

  // Status sub-tabs: one per bucket for the active payer, with "All" last.
  const statusTabItems: StatusBucket[] = [...statusBuckets, { key: '', label: 'All', statuses: [] }];
  // A bucket can disappear between loads — "Other" does, once nothing unrecognised is
  // left. Fall back to All, so no tab is highlighted while the table is unfiltered.
  const selectedTabIndex = statusTabItems.findIndex((b) => b.key === statusFilter);
  const statusTabIndex = selectedTabIndex >= 0 ? selectedTabIndex : statusTabItems.length - 1;
  const countForBucket = (bucket: StatusBucket) =>
    bucket.key === '' ? activeRows.length : activeRows.filter((row) => bucketMatches(bucket, row)).length;
  const countPill = (value: number) => <span className={styles.pill}>{value}</span>;

  const billsTableBody = rowsLoading ? (
    <div className={styles.tableCard}>
      <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
    </div>
  ) : (
    <>
      {bucketRows.length > 0 ? (
        <TableToolbar
          id="facility-bills"
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search patient, CR number or status…"
          onDate={onDateChange}
        />
      ) : null}
      {filteredRows.length === 0 ? (
        <div className={styles.tableCard}>
          <EmptyState message={emptyBillsMessage} />
        </div>
      ) : (
        <DataTable rows={rows} headers={columns}>
          {({ rows: dtRows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
            <div className={styles.tableCard}>
              <Table size="sm" useZebraStyles aria-label="facility bills" {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers
                      .filter((header) => !hiddenColumns.includes(header.key))
                      .map((header) => (
                        <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                      ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dtRows.map((row) => {
                    const patientUuid = row.cells.find((c) => c.info.header === 'patientUuid')?.value;
                    const consentToken = row.cells.find((c) => c.info.header === 'consentToken')?.value;
                    const claimGuid = row.cells.find((c) => c.info.header === 'claimGuid')?.value;
                    return (
                      <TableRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => {
                          if (hiddenColumns.includes(cell.info.header)) {
                            return null;
                          }
                          if (cell.info.header === 'patientName') {
                            const canOpen = Boolean(patientUuid || consentToken);
                            return (
                              <TableCell key={cell.id}>
                                {canOpen ? (
                                  <button
                                    type="button"
                                    className={styles.clickableData}
                                    onClick={() => openRowDetails(patientUuid, consentToken, claimGuid)}
                                  >
                                    {cell.value}
                                  </button>
                                ) : (
                                  cell.value
                                )}
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'status') {
                            // The claim's workflow_state verbatim — the value the HIE
                            // returned, not a re-worded version of it. statusMeta is
                            // consulted only for the tag colour.
                            return (
                              <TableCell key={cell.id}>
                                <Tag size="sm" type={statusMeta(cell.value).tag}>
                                  {cell.value || '—'}
                                </Tag>
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell {...getCellProps({ cell })} key={cell.id}>
                              {cell.value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DataTable>
      )}
      {filteredRows.length > 0 && (
        <Pagination
          forwardText={t('nextPage', 'Next page')}
          backwardText={t('previousPage', 'Previous page')}
          page={currentPage}
          pageSize={currentPageSize}
          pageSizes={pageSizes}
          totalItems={filteredRows.length}
          onChange={({ pageSize, page }) => {
            if (pageSize !== currentPageSize) setPageSize(pageSize);
            if (page !== currentPage) goTo(page);
          }}
        />
      )}
    </>
  );

  // The skeleton already stands for the wait while claim states are confirmed, so
  // nothing is said about it here. What still needs saying is the case the skeleton
  // can't show: states that were asked for and never came back.
  const statusNotice =
    tabIndex === 0 || rowsLoading ? null : statesFailed > 0 ? (
      <div className={`${styles.statusNotice} ${styles.statusNoticeWarning}`}>
        <WarningAltFilled size={16} />
        <span>
          {statesFailed} claim {statesFailed === 1 ? 'status' : 'statuses'} couldn’t be confirmed — those rows show the
          state last recorded, which may be out of date.
        </span>
      </div>
    ) : null;

  const billsTable = (
    <>
      {statusNotice}
      <Tabs
        selectedIndex={statusTabIndex}
        onChange={({ selectedIndex }) => {
          setStatusFilter(statusTabItems[selectedIndex]?.key ?? '');
          goTo(1);
        }}
      >
        <TabList aria-label="Bill statuses" className={styles.statusTabs} scrollDebounceWait={200}>
          {statusTabItems.map((bucket) => (
            <Tab key={bucket.key || 'all'}>
              {bucket.label}
              {/* A count off unconfirmed states would read as fact and then change. */}
              {rowsLoading ? null : countPill(countForBucket(bucket))}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {statusTabItems.map((bucket) => (
            <TabPanel key={bucket.key || 'all'}>{statusFilter === bucket.key ? billsTableBody : null}</TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </>
  );

  return (
    <>
      {/* The bill drill-down that used to sit beside this is a route of its own now, so
          the list is all this component renders. */}
      <div className={styles.panel}>
        {/* No heading and no payer bar: the dashboard tab above already names both what
              this list is and whose bills are in it, and the status buckets inside the
              table are the only choice left to make. */}
        {loading ? (
          <div className={styles.tableCard}>
            <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
          </div>
        ) : (
          billsTable
        )}
      </div>
    </>
  );
};

export default FacilityBills;
