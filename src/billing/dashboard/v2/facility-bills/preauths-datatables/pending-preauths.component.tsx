import React, { useMemo, useState } from "react";
import {
    Button,
    DataTable,
    DataTableRow,
    InlineLoading,
    Pagination,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@carbon/react';
import { usePagination } from '@openmrs/esm-framework';
import { useFacilityPreauths } from "../../../../billing-claims.resource";

interface PendingPreauthsProps {
    locationUuid: string,
    billingDate: string
}
const PendingPreauths: React.FC<PendingPreauthsProps> = ({ locationUuid, billingDate }) => {
    const { facilityPreauths, isLoading, error } = useFacilityPreauths(locationUuid, billingDate);
    const rows = facilityPreauths ?? [];

    const tableRows = useMemo(
        () =>
            rows.map((preauth) => ({
                id: preauth.order_no,
                orderNo: preauth.order_no,
                patientName: preauth.patient_name,
                crNumber: preauth.cr_no,
                interventionCode: preauth.intervention_code,
                status: preauth.status,
                billDate: preauth.bill_date,
                consentToken: preauth.consent_token ?? 'None',
                normalPreauth: preauth.normal_preauth ? 'Yes' : 'No',
                electivePreauth: preauth.elective_preauth ? 'Yes' : 'No',
            })),
        [rows],
    );

    const [currentPageSize, setPageSize] = useState(10);
    const pageSizes = [10, 20, 30];
    const { goTo, results: paginatedRows, currentPage } = usePagination(tableRows, currentPageSize);

    const headers = [
        { key: 'orderNo', id: 'orderNo', header: 'Order #' },
        { key: 'patientName', id: 'patientName', header: 'Patient' },
        { key: 'crNumber', id: 'crNumber', header: 'CR number' },
        { key: 'interventionCode', id: 'interventionCode', header: 'Intervention' },
        { key: 'status', id: 'status', header: 'Status' },
        { key: 'billDate', id: 'billDate', header: 'Bill date' },
        { key: 'consentToken', id: 'consentToken', header: 'Consent token' },
        { key: 'normalPreauth', id: 'normalPreauth', header: 'Normal preauth' },
        { key: 'electivePreauth', id: 'electivePreauth', header: 'Elective preauth' },
        { key: 'action', id: 'action', header: 'Action' },
    ];

    if (isLoading) {
        return <InlineLoading description="Loading pending preauthorisations" />;
    }

    if (error) {
        return <div>Failed to load pending preauthorisations.</div>;
    }

    if (!rows.length) {
        return <div>No pending preauthorisations found.</div>;
    }

    function handleAddPreauth(row: DataTableRow<any[]>): void {
        console.log(row);
    }

    return (
        <>
            <DataTable rows={paginatedRows} headers={headers}>
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
                    <Table size="sm" useZebraStyles aria-label="pending preauthorisations" {...getTableProps()}>
                        <TableHead>
                            <TableRow>
                                {headers.map((header) => (
                                    <TableHeader key={header.key} {...getHeaderProps({ header })}>
                                        {header.header}
                                    </TableHeader>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.id} {...getRowProps({ row })}>
                                    {row.cells.map((cell) => {
                                        if (cell.info.header === 'action') {
                                            return (
                                                <TableCell key={cell.id} {...getCellProps({ cell })}>
                                                    <Button kind="primary" size="sm" onClick={() => handleAddPreauth(row)}>
                                                        Add preauth
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
                )}
            </DataTable>
            <Pagination
                backwardText="Previous page"
                forwardText="Next page"
                page={currentPage}
                pageSize={currentPageSize}
                pageSizes={pageSizes}
                totalItems={tableRows.length}
                onChange={({ page, pageSize }) => {
                    if (pageSize !== currentPageSize) setPageSize(pageSize);
                    if (page !== currentPage) goTo(page);
                }}
            />
        </>
    );
}

export default PendingPreauths;