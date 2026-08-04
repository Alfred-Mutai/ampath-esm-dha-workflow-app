import {
  Button,
  DataTable,
  DataTableSkeleton,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { closeWorkspace, launchWorkspace, usePagination, useSession } from '@openmrs/esm-framework';
import { SEND_TO_QUEUE_WORKSPACE } from '../../../../registry/modal/send-to-triage/send-to-queue.modal';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PendingBillLineItems, type ActiveCashVisit } from '../types';
import { getActiveCashVisits, getFacilityBillLineItems } from '../../../billing-claims.resource';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';
import styles from './cash-patients.scss';

interface CashPatientsProps {
  billingDate: string;
}

type CashRecord = ActiveCashVisit | PendingBillLineItems;

const CashPatients: React.FC<CashPatientsProps> = ({ billingDate }) => {
  const [cashPatients, setCashPatients] = useState<ActiveCashVisit[]>([]);
  const [pendingBillItems, setPendingBillItems] = useState<PendingBillLineItems[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchString, setSearchString] = useState('');
  const { t } = useTranslation();

  const session = useSession();

  const locationUuid = session.sessionLocation?.uuid;

  useEffect(() => {
    if (!locationUuid) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [visitsRes, pendingRes] = await Promise.all([
          getActiveCashVisits(locationUuid, billingDate),
          getFacilityBillLineItems(locationUuid, billingDate),
        ]);
        setCashPatients(visitsRes?.results ?? []);
        setPendingBillItems(pendingRes ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [billingDate, locationUuid]);

  const mergedPatients: CashRecord[] = useMemo(() => {
    const pendingByVisitUuid = new Map(pendingBillItems.map((item) => [item.visit_uuid, item]));

    const result: CashRecord[] = [...pendingBillItems];

    cashPatients.forEach((visit) => {
      if (!pendingByVisitUuid.has(visit.visit_uuid)) {
        result.push(visit);
      }
    });

    return result;
  }, [cashPatients, pendingBillItems]);

  // Same shape as the SHA list beside it: the patient, what identifies them, what kind of
  // visit, who is paying, then the one action.
  const columns = [
    { id: 'patientName', header: 'Patient', key: 'patientName' },
    { id: 'crNumber', header: 'CR number', key: 'crNumber' },
    { id: 'visitType', header: 'Visit type', key: 'visitType' },
    { id: 'payer', header: 'Payer', key: 'payer' },
    { id: 'action', header: 'Action', key: 'action' },
  ];

  const rows = useMemo(
    () =>
      mergedPatients.map((visit, index) => ({
        // The visit uuid is the natural key, but a record can arrive without one and
        // DataTable needs every row to have an id it can tell apart.
        id: visit.visit_uuid || `cash-${index}`,
        patientName: visit.patient_name || '—',
        crNumber: visit.identifiers || '—',
        visitType: visit.visit_type || '—',
        payer: visit.payment_method || 'Cash',
        action: visit.patient_uuid,
      })),
    [mergedPatients],
  );

  // Kept beside the rows so the action can reach the record it came from: whether a row
  // opens the cash workspace or the send-to-queue modal depends on which of the two
  // sources it was built from, and the table row itself doesn't carry that.
  const recordsById = useMemo(
    () => new Map(mergedPatients.map((visit, index) => [visit.visit_uuid || `cash-${index}`, visit])),
    [mergedPatients],
  );

  const searchResults = useMemo(() => {
    const term = searchString.trim().toLowerCase();
    if (!term) {
      return rows;
    }
    return rows.filter(
      (row) => row.patientName.toLowerCase().includes(term) || row.crNumber.toLowerCase().includes(term),
    );
  }, [rows, searchString]);

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  const { goTo, results: paginatedRows, currentPage } = usePagination(searchResults, currentPageSize);

  //finalize bill

  // https://o3.openmrs.org/openmrs/ws/rest/v1/billing/bill/9782ecd4-514a-4a92-be78-f7c7a2b2562c
  // payload status: "POSTED"

  // process payment

  // https://o3.openmrs.org/openmrs/ws/rest/v1/billing/bill/9782ecd4-514a-4a92-be78-f7c7a2b2562c/payment
  // payload amount: 500 amountTendered: 500 instanceType: "526bf278-ba81-4436-b867-c2f6641d060a"

  const handleGenerateBill = async (rowId: string) => {
    const visit = recordsById.get(rowId);
    if (!visit) {
      return;
    }
    // Read before the check below narrows. Both record types declare `line_item_date`, so
    // TypeScript treats what follows the `in` as unreachable and the record as `never` —
    // even though at runtime the check is a real test of which of the two shapes arrived,
    // and it is the one the original code branched on.
    const {
      patient_uuid: recordPatientUuid,
      visit_type_uuid: recordVisitTypeUuid,
      visit_uuid: recordVisitUuid,
    } = visit;
    if ('line_item_date' in visit) {
      closeWorkspace('pay-cash-workspace', { ignoreChanges: true });

      setTimeout(() => {
        launchWorkspace('pay-cash-workspace', {
          lineItems: (visit as PendingBillLineItems).pending_line_items,
        });
      }, 50);
      return;
    }
    // A visit with no pending bill starts a claim instead, in the platform's own panel.
    launchWorkspace(SEND_TO_QUEUE_WORKSPACE, {
      workspaceTitle: 'Initiate SHA claim',
      patientUuid: recordPatientUuid,
      visitUuid: recordVisitUuid,
      visitTypeUuid: recordVisitTypeUuid,
      isCash: true,
    });
  };

  return (
    <>
      {loading ? (
        <div className={styles.tableCard}>
          <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.tableCard}>
          <EmptyState message="No cash patients awaiting payment for the selected date." />
        </div>
      ) : (
        <>
          <TableToolbar
            id="cash-patients"
            search={searchString}
            onSearch={setSearchString}
            searchPlaceholder={t('searchThisList', 'Search this list')}
          />
          {searchResults.length === 0 ? (
            <div className={styles.tableCard}>
              <EmptyState message="No patients match your search." />
            </div>
          ) : (
            <DataTable rows={paginatedRows} headers={columns}>
              {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
                <div className={styles.tableCard}>
                  <Table size="sm" useZebraStyles aria-label="cash patients" {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableRows.map((row) => (
                        <TableRow {...getRowProps({ row })}>
                          {row.cells.map((cell) => {
                            if (cell.info.header === 'payer') {
                              return (
                                <TableCell key={cell.id}>
                                  <Tag size="sm" type="teal">
                                    {cell.value}
                                  </Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'action') {
                              return (
                                <TableCell key={cell.id} className={styles.actionCell}>
                                  <Button kind="tertiary" size="sm" onClick={() => handleGenerateBill(row.id)}>
                                    Open billing
                                  </Button>
                                </TableCell>
                              );
                            }
                            return (
                              <TableCell key={cell.id} {...getCellProps({ cell })}>
                                {cell.value}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DataTable>
          )}
          {searchResults.length > 0 && (
            <Pagination
              forwardText={t('nextPage', 'Next page')}
              backwardText={t('previousPage', 'Previous page')}
              page={currentPage}
              pageSize={currentPageSize}
              pageSizes={pageSizes}
              totalItems={searchResults.length}
              onChange={({ pageSize, page }) => {
                if (pageSize !== currentPageSize) setPageSize(pageSize);
                if (page !== currentPage) goTo(page);
              }}
            />
          )}
        </>
      )}
    </>
  );
};

export default CashPatients;
