import React, { useMemo, useState } from 'react';
import { useActiveVisits } from './active-visits.resource';
import { Button, DataTable, DataTableCell, DataTableRow, DataTableSkeleton, Layer, Pagination, Table, TableBody, TableCell, TableContainer, TableExpandHeader, TableExpandRow, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent, TableToolbarSearch, Tile } from '@carbon/react';
import { showModal, usePagination } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from "./active-visits.scss";
import dayjs from 'dayjs';
import { Add } from '@carbon/react/icons';
import SendToQueueModal from '../../../../registry/modal/send-to-triage/send-to-queue.modal';

const ActiveVisits: React.FC = () => {
    const [searchString, setSearchString] = useState('');
    const { isLoading, activeVisits } = useActiveVisits();
    const [patientUuid, setPatientUuid] = useState("");
    const [visitUuid, setVisitUuid] = useState("");
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
        }
    ];

    const activeVisitsTableRows = useMemo(() => {
        if (activeVisits) {
            return activeVisits.map((visit) => ({
                id: visit.uuid,
                action: visit.patient.uuid,
                patientName: visit.patient.display,
                patientIdentifiers: "",//visit.patient.identifiers.map((i) => i.identifier).join(",")
                visitType: visit.visitType.display,
                startTime: dayjs(visit.startDatetime).format("HH:mm A")
            }));
        }
    }, [activeVisits]);

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

    if (isLoading && !activeVisits) {
        return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
    }


    function handleRowClick(row: DataTableRow<any[]>): void {
        row.cells.map(cell => {
            if (cell.info.header === "action") {
                setPatientUuid(cell.value)
            }
        });
        setVisitUuid(row.id);
    }

    function onModalClose({ success }: { success: boolean }): void {
        setPatientUuid(null);
        setVisitUuid(null);
    }

    return <>
        <DataTable rows={paginatedVisits} headers={columns}>
            {({
                rows,
                headers,
                getTableProps,
                getHeaderProps,
                getRowProps,
                getCellProps,
            }) => (
                <div className={styles.tableContainer}>
                    <TableToolbar>
                        <TableToolbarContent className={styles.tableToolBar}>
                            <Layer className={styles.toolbarItem}>
                                <TableToolbarSearch
                                    expanded
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchString(e.target.value)}
                                    placeholder={t('searchThisList', 'Search this list')}
                                    size="sm"
                                />
                            </Layer>
                        </TableToolbarContent>
                    </TableToolbar>
                    <Table className={styles.tableWrapper} {...getTableProps()}>
                        <TableHead>
                            <TableRow>
                                {headers.map((header) => (
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
                                        if (cell.info.header === "action") {
                                            return <TableCell>
                                                <Button hasIconOnly iconDescription="Add patient to queue" renderIcon={() => <Add />} onClick={() => handleRowClick(row)}></Button>
                                            </TableCell>
                                        }
                                        return (
                                            <TableCell {...getCellProps({ cell })}>{cell.value}</TableCell>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {rows.length > 0 && (
                        <Pagination
                            forwardText={t('nextPage', 'Next page')}
                            backwardText={t('previousPage', 'Previous page')}
                            page={currentPage}
                            pageSize={currentPageSize}
                            pageSizes={pageSizes}
                            totalItems={searchResults?.length}
                            className={styles.pagination}
                            onChange={({ pageSize, page }) => {
                                if (pageSize !== currentPageSize) setPageSize(pageSize);
                                if (page !== currentPage) goTo(page);
                            }}
                        />
                    )}
                </div>
            )}
        </DataTable>

        {
            patientUuid && visitUuid &&
            <SendToQueueModal patientUuid={patientUuid} visitUuid={visitUuid} onModalClose={onModalClose} />
        }
    </>
}

export default ActiveVisits;