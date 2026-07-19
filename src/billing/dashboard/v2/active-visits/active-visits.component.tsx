import React, { useMemo, useState } from 'react';
import { useActiveVisits } from './active-visits.resource';
import { Button, DataTable, type DataTableRow, DataTableSkeleton, Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { usePagination } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from "./active-visits.scss";
import dayjs from 'dayjs';
import { Add } from '@carbon/react/icons';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';
import SendToQueueModal from '../../../../registry/modal/send-to-triage/send-to-queue.modal';

const ActiveVisits: React.FC<{ date?: string }> = ({ date }) => {
    const [searchString, setSearchString] = useState('');
    const { isLoading, activeVisits } = useActiveVisits(date);
    const [patientUuid, setPatientUuid] = useState("");
    const [visitUuid, setVisitUuid] = useState("");
    const [visitTypeUuid, setVisitTypeUuid] = useState("");
    const { t } = useTranslation();

    const columns = [
        {
            id: "patientName",
            header: "Patient name",
            key: "patientName"
        },
        {
            id: "visitType",
            header: "Visit type",
            key: "visitType"
        },
        {
            id: "startTime",
            header: "Start time",
            key: "startTime"
        },
        {
            id: "action",
            header: "Action",
            key: "action"
        },
        {
            id: "visitTypeUuid",
            header: "",
            key: "visitTypeUuid"
        }
    ];

    const activeVisitsTableRows = useMemo(() => {
        const dayFilter = date ? dayjs(date) : null;
        return (activeVisits ?? [])
            .filter((visit) => !dayFilter || dayjs(visit.startDatetime).isSame(dayFilter, 'day'))
            .map((visit) => ({
                id: visit.uuid,
                action: visit.patient.uuid,
                patientName: visit.patient.display,
                patientIdentifiers: "",//visit.patient.identifiers.map((i) => i.identifier).join(",")
                visitType: visit.visitType.display,
                startTime: dayjs(visit.startDatetime).format("HH:mm A"),
                visitTypeUuid: visit.visitType.uuid
            }));
    }, [activeVisits, date]);

    const searchResults = useMemo(() => {
        if (searchString && searchString.trim() !== '') {
            const lowerSearchString = searchString.toLowerCase();
            return activeVisitsTableRows.filter(
                (row) =>
                    (row.patientName?.toLowerCase().includes(lowerSearchString)) ||
                    (row.patientIdentifiers.toLowerCase().includes(lowerSearchString))
            );
        }
        return activeVisitsTableRows;
    }, [activeVisitsTableRows, searchString]);

    const pageSizes = [10, 20, 30, 40, 50];
    const [currentPageSize, setPageSize] = useState(10);
    const { goTo, results: paginatedVisits, currentPage } = usePagination(searchResults, currentPageSize);

    const showSkeleton = isLoading && !activeVisits;

    function handleRowClick(row: DataTableRow<any[]>): void {
        row.cells.map(cell => {
            if (cell.info.header === "action") {
                setPatientUuid(cell.value)
            }
            if (cell.info.header === "visitTypeUuid") {
                setVisitTypeUuid(cell.value)
            }
        });
        setVisitUuid(row.id);
    }

    function onModalClose({ success }: { success: boolean }): void {
        setPatientUuid(null);
        setVisitUuid(null);
    }

    return <>
        {showSkeleton ? (
            <div className={styles.tableCard}>
                <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
            </div>
        ) : activeVisitsTableRows.length === 0 ? (
            <div className={styles.tableCard}>
                <EmptyState message="No active visits for the selected date." />
            </div>
        ) : (
        <>
        <TableToolbar
            id="active-visits"
            search={searchString}
            onSearch={setSearchString}
            searchPlaceholder={t('searchThisList', 'Search this list')}
        />
        {(searchResults?.length ?? 0) === 0 ? (
            <div className={styles.tableCard}>
                <EmptyState message="No active visits match your search." />
            </div>
        ) : (
        <DataTable rows={paginatedVisits} headers={columns}>
            {({
                rows,
                headers,
                getTableProps,
                getHeaderProps,
                getRowProps,
                getCellProps,
            }) => (
                <div className={styles.tableCard}>
                    <Table size="sm" useZebraStyles aria-label="active visits" {...getTableProps()}>
                        <TableHead>
                            <TableRow>
                                {headers
                                    .filter((header) => header.key !== "visitTypeUuid")
                                    .map((header) => (
                                        <TableHeader {...getHeaderProps({ header })}>
                                            {header.header}
                                        </TableHeader>
                                    ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow {...getRowProps({ row })}>
                                    {row.cells.map((cell) => {
                                        if (cell.info.header === "visitTypeUuid") {
                                            return null;
                                        }
                                        if (cell.info.header === "action") {
                                            return (
                                                <TableCell key={cell.id}>
                                                    <Button
                                                        kind="ghost"
                                                        size="sm"
                                                        renderIcon={Add}
                                                        onClick={() => handleRowClick(row)}
                                                    >
                                                        Send to queue
                                                    </Button>
                                                </TableCell>
                                            );
                                        }
                                        return (
                                            <TableCell key={cell.id} {...getCellProps({ cell })}>{cell.value}</TableCell>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </DataTable>
        )}
        {(searchResults?.length ?? 0) > 0 && (
            <Pagination
                forwardText={t('nextPage', 'Next page')}
                backwardText={t('previousPage', 'Previous page')}
                page={currentPage}
                pageSize={currentPageSize}
                pageSizes={pageSizes}
                totalItems={searchResults?.length}
                onChange={({ pageSize, page }) => {
                    if (pageSize !== currentPageSize) setPageSize(pageSize);
                    if (page !== currentPage) goTo(page);
                }}
            />
        )}
        </>
        )}

        {
            patientUuid && visitUuid &&
            <SendToQueueModal patientUuid={patientUuid} visitUuid={visitUuid} visitTypeUuid={visitTypeUuid} onModalClose={onModalClose} />
        }
    </>
}

export default ActiveVisits;