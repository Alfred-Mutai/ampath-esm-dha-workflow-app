import React, { useEffect, useMemo, useState } from 'react';
import { type FacilityBillsDto, type FacilityBill, type ClaimVisitReponse, BillingView } from '../types';
import {
  Breadcrumb,
  BreadcrumbItem,
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
import { Renew } from '@carbon/react/icons';
import { showSnackbar, usePagination } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { fetchFacilityBills, fetchFacilityClaimVisits } from '../../../billing-claims.resource';
import styles from './facility-bills.component.scss';
import PatientBillDetails from '../patient-bill-details/patient-bill-details';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';
import { CLAIM_BUCKETS, PAYMENT_BUCKETS, type StatusBucket, statusMeta } from './claim-status';

// Show the CR with its "CR" prefix, e.g. CR7138388758297-0; dash when absent.
const formatCr = (value?: string | null): string => {
  const v = (value ?? '').trim();
  if (!v) return '—';
  return /^cr/i.test(v) ? v : `CR${v}`;
};

// The bills endpoint carries no payment mode; a consent token means the visit was
// authorised through SHA/HIE, anything else is settled at the cash point.
const paymentMode = (bill: FacilityBill): string => ((bill.consent_token ?? '').trim() ? 'SHA' : 'Cash');

// The status sub-tab a payer opens on: Draft when it has one (SHA / preauths), else
// Pending (cash), else the first bucket.
const defaultBucketKey = (buckets: StatusBucket[]): string => {
  const preferred = buckets.find((b) => b.key === 'draft') ?? buckets.find((b) => b.key === 'pending');
  return (preferred ?? buckets[0])?.key ?? '';
};

interface facilityBillsProps {
  billingDate: string;
  locationUuid: string;
  onDateChange?: (value: string) => void;
  /** Told whether the bill-details drill-down is open, so the parent can clear the
      surrounding dashboard chrome and give the details the full page. */
  onDetailsOpenChange?: (open: boolean) => void;
}
const FacilityBills: React.FC<facilityBillsProps> = ({ billingDate, locationUuid, onDateChange, onDetailsOpenChange }) => {
  const [facilityBills, setFacilityBills] = useState<FacilityBill[]>([]);
  // Claim visits carry each SHA claim's workflow_state, keyed by authorization code.
  const [claimVisits, setClaimVisits] = useState<ClaimVisitReponse[]>([]);
  const [currentView, setCurrentView] = useState<BillingView>(BillingView.Bills);
  const [selectedPatientUuid, setSelectedPatientUuid] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsRefresh, setDetailsRefresh] = useState<number>(0);
  // 0 = Cash bills, 1 = SHA claims.
  const [tabIndex, setTabIndex] = useState<number>(0);
  // Selected status bucket key ('' = All). Defaults to the first bucket of the payer
  // (Drafts for SHA claims, Pending for cash).
  const [statusFilter, setStatusFilter] = useState<string>(() => defaultBucketKey(PAYMENT_BUCKETS));
  const { t } = useTranslation();
  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  useEffect(() => {
    if (locationUuid && billingDate) {
      getFacilityBills();
      // The claim visits give each SHA bill its claim workflow_state.
      fetchFacilityClaimVisits({ locationUuid, visitDate: billingDate })
        .then((data) => setClaimVisits(data ?? []))
        .catch(() => setClaimVisits([]));
    }
  }, [billingDate, locationUuid]);
  async function getFacilityBills() {
    setLoading(true);
    const facilityBillsPayload = generateFacilityBillsPayload();
    try {
      const data = await fetchFacilityBills(facilityBillsPayload);
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

  function toggleView(newView: BillingView, patientUuid: string) {
    setCurrentView(newView);
    setSelectedPatientUuid(patientUuid);
    onDetailsOpenChange?.(newView === BillingView.BillDetails);
  }
  function formatStatusColumn(status: string) {
    const statusArr = status.split(',');

    if (statusArr.length > 0) {
       const hasPostedBill = statusArr.some((s) => {
        return s === 'POSTED';
      });
      if(hasPostedBill){
        return 'PARTIALLY PAID'
      }
      const hasPendingBill = statusArr.some((s) => {
        return s === 'PENDING';
      });
      if (hasPendingBill) {
        return 'PENDING';
      }

      return 'PAID';
    } else {
      return status;
    }
  }
  // Split the bills by payer so each tab shows only its own.
  const cashBills = useMemo(() => (facilityBills ?? []).filter((fb) => paymentMode(fb) === 'Cash'), [facilityBills]);
  const shaBills = useMemo(() => (facilityBills ?? []).filter((fb) => paymentMode(fb) === 'SHA'), [facilityBills]);

  const isSha = tabIndex === 1;
  const activeBills = tabIndex === 0 ? cashBills : shaBills;
  // Each SHA claim's workflow_state, keyed by its authorization code (== the bill's
  // consent token).
  const claimStateByToken = useMemo(() => {
    const map = new Map<string, string>();
    (claimVisits ?? []).forEach((cv) => {
      if (cv.authorizationCode) {
        map.set(cv.authorizationCode, (cv.visitResponse?.workflow_state ?? '').trim());
      }
    });
    return map;
  }, [claimVisits]);
  // Cash bills show the payment status; SHA bills show the claim workflow_state from the
  // matched claim visit, falling back to the payment status until it's available.
  const billStatus = (fb: FacilityBill): string =>
    isSha
      ? claimStateByToken.get((fb.consent_token ?? '').trim()) || formatStatusColumn(fb.paid_status)
      : formatStatusColumn(fb.paid_status);
  // Status buckets for the active payer (cash / SHA claims).
  const bucketsForTab = (index: number): StatusBucket[] =>
    index === 1 ? CLAIM_BUCKETS : PAYMENT_BUCKETS;
  const statusBuckets: StatusBucket[] = bucketsForTab(tabIndex);
  const selectedBucket = statusBuckets.find((b) => b.key === statusFilter);
  const bucketMatches = (bucket: StatusBucket, fb: FacilityBill): boolean =>
    bucket.statuses.some((s) => s.toUpperCase() === billStatus(fb).trim().toUpperCase());

  // Bills in the current status bucket, before the free-text search is applied. Drives
  // whether the search box is shown (only when there's something to search).
  const bucketBills = activeBills.filter((fb) => !selectedBucket || bucketMatches(selectedBucket, fb));
  const filteredBills = bucketBills.filter((fb) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      `${fb.patient_name} ${formatCr(fb.cr_id)} ${fb.national_id ?? ''} ${fb.receipt_number ?? ''} ${
        fb.visit_type ?? ''
      } ${billStatus(fb)} ${fb.cash_point ?? ''}`
        .toLowerCase()
        .includes(term)
    );
  });

  const { goTo, results: paginatedBills, currentPage } = usePagination(filteredBills, currentPageSize);

  const columns = [
    { id: 'index', header: '#', key: 'index' },
    { id: 'patientName', header: 'Patient', key: 'patientName' },
    { id: 'crNumber', header: 'CR number', key: 'crNumber' },
    { id: 'visitType', header: 'Visit type', key: 'visitType' },
    { id: 'status', header: 'Status', key: 'status' },
    { id: 'cashPoint', header: 'Cash point', key: 'cashPoint' },
    { id: 'billDate', header: 'Date', key: 'billDate' },
    { id: 'patientUuid', header: '', key: 'patientUuid' },
  ];

  const rows = paginatedBills.map((fb, index) => ({
    id: `${fb.patient_uuid}-${index}`,
    index: (currentPage - 1) * currentPageSize + index + 1,
    patientName: fb.patient_name,
    crNumber: formatCr(fb.cr_id),
    visitType: fb.visit_type || '—',
    status: billStatus(fb),
    cashPoint: fb.cash_point || '—',
    billDate: fb.bill_date || '—',
    patientUuid: fb.patient_uuid,
  }));

  const changeTab = (index: number) => {
    setTabIndex(index);
    setStatusFilter(defaultBucketKey(bucketsForTab(index)));
    goTo(1);
  };

  const payerNoun = isSha ? 'SHA claims' : 'cash bills';
  const emptyBillsMessage = selectedBucket
    ? `No ${payerNoun} under “${selectedBucket.label}”.`
    : search
      ? 'No bills match your search.'
      : `No ${payerNoun} for the selected date.`;

  // Status sub-tabs: one per bucket for the active payer, with "All" last.
  const statusTabItems: StatusBucket[] = [...statusBuckets, { key: '', label: 'All', statuses: [] }];
  const statusTabIndex = Math.max(0, statusTabItems.findIndex((b) => b.key === statusFilter));
  const countForBucket = (bucket: StatusBucket) =>
    bucket.key === '' ? activeBills.length : activeBills.filter((fb) => bucketMatches(bucket, fb)).length;
  const countPill = (value: number) => <span className={styles.pill}>{value}</span>;

  const billsTableBody = (
    <>
      {bucketBills.length > 0 ? (
        <TableToolbar
          id="facility-bills"
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search patient, status or cash point…"
          onDate={onDateChange}
        />
      ) : null}
      {filteredBills.length === 0 ? (
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
                      .filter((header) => header.key !== 'patientUuid')
                      .map((header) => (
                        <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                      ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dtRows.map((row) => {
                    const patientUuid = row.cells.find((c) => c.info.header === 'patientUuid')?.value;
                    return (
                      <TableRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => {
                          if (cell.info.header === 'patientUuid') {
                            return null;
                          }
                          if (cell.info.header === 'patientName') {
                            return (
                              <TableCell key={cell.id}>
                                <button
                                  type="button"
                                  className={styles.clickableData}
                                  onClick={() => toggleView(BillingView.BillDetails, patientUuid)}
                                >
                                  {cell.value}
                                </button>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'status') {
                            return (
                              <TableCell key={cell.id}>
                                <Tag size="sm" type={statusMeta(cell.value).tag}>
                                  {statusMeta(cell.value).label}
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
      {filteredBills.length > 0 && (
        <Pagination
          forwardText={t('nextPage', 'Next page')}
          backwardText={t('previousPage', 'Previous page')}
          page={currentPage}
          pageSize={currentPageSize}
          pageSizes={pageSizes}
          totalItems={filteredBills.length}
          onChange={({ pageSize, page }) => {
            if (pageSize !== currentPageSize) setPageSize(pageSize);
            if (page !== currentPage) goTo(page);
          }}
        />
      )}
    </>
  );

  const billsTable = (
    <>
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
              {countPill(countForBucket(bucket))}
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
      {currentView === BillingView.Bills ? (
        <div className={styles.panel}>
          <div className={styles.intro}>
            <h4 className={styles.introTitle}>Facility bills</h4>
            <p className={styles.introText}>
              Consultation and service bills raised at this facility for the selected date. Select a patient to view
              the itemised bill, payments received and the outstanding balance.
            </p>
          </div>
          {loading ? (
            <div className={styles.tableCard}>
              <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
            </div>
          ) : (
            <Tabs selectedIndex={tabIndex} onChange={({ selectedIndex }) => changeTab(selectedIndex)}>
              <TabList aria-label="Facility bills" scrollDebounceWait={200}>
                <Tab>Cash bills</Tab>
                <Tab>SHA claims</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>{tabIndex === 0 ? billsTable : null}</TabPanel>
                <TabPanel>{tabIndex === 1 ? billsTable : null}</TabPanel>
              </TabPanels>
            </Tabs>
          )}
        </div>
      ) : (
        <></>
      )}
      {currentView === BillingView.BillDetails && selectedPatientUuid ? (
        <div className={styles.detailsView}>
          <div className={styles.detailsHeader}>
            <Breadcrumb noTrailingSlash className={styles.breadcrumb}>
              <BreadcrumbItem>
                <button
                  type="button"
                  className={styles.breadcrumbLink}
                  onClick={() => toggleView(BillingView.Bills, '')}
                >
                  Facility bills
                </button>
              </BreadcrumbItem>
              <BreadcrumbItem isCurrentPage>Bill details</BreadcrumbItem>
            </Breadcrumb>
            <Button
              kind="tertiary"
              size="sm"
              renderIcon={Renew}
              iconDescription="Reload"
              onClick={() => setDetailsRefresh((n) => n + 1)}
            >
              Reload Bills
            </Button>
          </div>
          <PatientBillDetails
            locationUuid={locationUuid}
            billingDate={billingDate}
            patientUuid={selectedPatientUuid}
            refreshToken={detailsRefresh}
          />
        </div>
      ) : (
        <></>
      )}
    </>
  );
};

export default FacilityBills;
