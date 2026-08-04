import React, { useMemo, useState } from 'react';
import { usePendingClearanceVisits } from './active-visits.resource';
import { Button, DataTable, type DataTableRow, DataTableSkeleton, Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { launchWorkspace, usePagination, type Visit } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from "./active-visits.scss";
import dayjs from 'dayjs';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';
import { IdentifierTypesUuids } from '../../../../resources/identifier-types';
import { SEND_TO_QUEUE_WORKSPACE } from '../../../../registry/modal/send-to-triage/send-to-queue.modal';

// OpenMRS renders patient.display as "IDENTIFIER - Full name"; split so the CR
// number and the name can be shown in their own columns.
const splitPatientDisplay = (display: string): { crNumber: string; name: string } => {
    const value = display ?? '';
    const sep = value.indexOf(' - ');
    return sep > -1 ? { crNumber: value.slice(0, sep).trim(), name: value.slice(sep + 3).trim() } : { crNumber: '', name: value };
};

// The Client Registry (CR) number from the patient's identifier list. Returns
// isCr=true only when the actual CR identifier is found, so a fallback (e.g. a
// National ID) is never mislabelled with a "CR" prefix.
const getCrNumber = (visit: Visit): { value: string; isCr: boolean } => {
    const cr = visit.patient?.identifiers?.find(
        (i) =>
            i.identifierType?.uuid === IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID ||
            (i.identifierType?.display ?? '').toLowerCase().includes('registry'),
    )?.identifier;
    if (cr) {
        return { value: cr.trim(), isCr: true };
    }
    return { value: splitPatientDisplay(visit.patient?.display ?? '').crNumber.trim(), isCr: false };
};

// Format a CR value for display — prefix "CR" only when it's genuinely the CR.
const formatCr = (value: string, isCr: boolean): string => {
    if (!value) return '—';
    if (!isCr) return value;
    return /^cr/i.test(value) ? value : `CR${value}`;
};

// Human "how long they've been waiting" label from the visit start.
const waitingSince = (startDatetime: string): string => {
    const mins = dayjs().diff(dayjs(startDatetime), 'minute');
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
};

// Colour the wait so long waits stand out: fresh (green) → 1h+ (magenta) → 2h+ (red).
const waitingTagType = (mins: number): 'green' | 'magenta' | 'red' =>
    mins >= 120 ? 'red' : mins >= 60 ? 'magenta' : 'green';

const ActiveVisits: React.FC<{ date?: string, onDateChange?: (value: string) => void }> = ({ date, onDateChange }) => {
    const [searchString, setSearchString] = useState('');
    const { isLoading, visits: pendingVisits } = usePendingClearanceVisits(date);
    const [patientUuid, setPatientUuid] = useState("");
    const [visitUuid, setVisitUuid] = useState("");
    const [visitTypeUuid, setVisitTypeUuid] = useState("");
    const { t } = useTranslation();

    const columns = [
        { id: "patientName", header: "Patient", key: "patientName" },
        { id: "crNumber", header: "CR number", key: "crNumber" },
        { id: "visitType", header: "Visit type", key: "visitType" },
        { id: "payer", header: "Payer", key: "payer" },
        { id: "startTime", header: "Started", key: "startTime" },
        { id: "waiting", header: "Waiting", key: "waiting" },
        { id: "action", header: "Action", key: "action" },
        { id: "visitTypeUuid", header: "", key: "visitTypeUuid" }
    ];

    const activeVisitsTableRows = useMemo(() => {
        return (pendingVisits ?? []).map((visit) => {
            const { name } = splitPatientDisplay(visit.patient.display);
            const cr = getCrNumber(visit);
            // Display the CR with its "CR" prefix, e.g. CR7138388758297-0.
            const crDisplay = formatCr(cr.value, cr.isCr);
            return {
                id: visit.uuid,
                action: visit.patient.uuid,
                patientName: name,
                crNumber: crDisplay,
                patientIdentifiers: crDisplay,
                visitType: visit.visitType.display,
                payer: 'SHA',
                startTime: dayjs(visit.startDatetime).format("DD MMM, HH:mm"),
                waiting: waitingSince(visit.startDatetime),
                waitingMinutes: dayjs().diff(dayjs(visit.startDatetime), 'minute'),
                visitTypeUuid: visit.visitType.uuid
            };
        });
    }, [pendingVisits]);

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

    const showSkeleton = isLoading && pendingVisits.length === 0;

    // Wait minutes keyed by visit id, so the Waiting cell can colour by urgency.
    const waitingMinutesById = useMemo(
        () => new Map(activeVisitsTableRows.map((r) => [r.id, r.waitingMinutes])),
        [activeVisitsTableRows],
    );

    // Opens the claim panel as an OpenMRS workspace rather than rendering it inline, so it
    // gets the platform's own chrome — title bar, hide and maximise — and can be closed
    // from anywhere the way every other panel in the app can.
    function handleRowClick(row: DataTableRow<any[]>): void {
        let rowPatientUuid = '';
        let rowVisitTypeUuid = '';
        row.cells.forEach(cell => {
            if (cell.info.header === "action") {
                rowPatientUuid = cell.value;
            }
            if (cell.info.header === "visitTypeUuid") {
                rowVisitTypeUuid = cell.value;
            }
        });
        launchWorkspace(SEND_TO_QUEUE_WORKSPACE, {
            workspaceTitle: 'Initiate SHA claim',
            patientUuid: rowPatientUuid,
            visitUuid: row.id,
            visitTypeUuid: rowVisitTypeUuid,
        });
    }

    return <>
        {showSkeleton ? (
            <div className={styles.tableCard}>
                <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
            </div>
        ) : activeVisitsTableRows.length === 0 ? (
            <div className={styles.tableCard}>
                <EmptyState message="No SHA patients awaiting clearance for the selected date." />
            </div>
        ) : (
        <>
        <TableToolbar
            id="active-visits"
            search={searchString}
            onSearch={setSearchString}
            searchPlaceholder={t('searchThisList', 'Search this list')}
            onDate={onDateChange}
        />
        {(searchResults?.length ?? 0) === 0 ? (
            <div className={styles.tableCard}>
                <EmptyState message="No patients match your search." />
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
                                        if (cell.info.header === "payer") {
                                            return (
                                                <TableCell key={cell.id}>
                                                    <Tag size="sm" type="teal">{cell.value}</Tag>
                                                </TableCell>
                                            );
                                        }
                                        if (cell.info.header === "waiting") {
                                            return (
                                                <TableCell key={cell.id}>
                                                    <Tag size="sm" type={waitingTagType(waitingMinutesById.get(row.id) ?? 0)}>
                                                        {cell.value}
                                                    </Tag>
                                                </TableCell>
                                            );
                                        }
                                        if (cell.info.header === "action") {
                                            return (
                                                <TableCell key={cell.id} className={styles.actionCell}>
                                                    <Button
                                                        kind="tertiary"
                                                        size="sm"
                                                        onClick={() => handleRowClick(row)}
                                                    >
                                                        Initiate SHA claim
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

    </>
}

export default ActiveVisits;