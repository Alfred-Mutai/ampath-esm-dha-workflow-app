import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  InlineLoading,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { showSnackbar, usePagination } from '@openmrs/esm-framework';
import {
  isAwaitingDoctorApproval,
  resendPreauthDoctorConsent,
  type PreauthPreviewRow,
} from '../../../../../claims/claims.resource';

interface PreauthPreviewTableProps {
  rows: PreauthPreviewRow[];
  locationUuid: string;
  loading?: boolean;
  onRefresh: () => void;
}

const PreauthPreviewTable: React.FC<PreauthPreviewTableProps> = ({
  rows,
  locationUuid,
  loading,
  onRefresh,
}) => {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [currentPageSize, setPageSize] = useState(10);
  const pageSizes = [10, 20, 30];

  const tableRows = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        patient: r.memberName || '—',
        memberId: r.memberIdentifier || '—',
        intervention: r.interventionCode
          ? `${r.interventionCode}${r.interventionName ? ` · ${r.interventionName}` : ''}`
          : '—',
        preauthType: r.preauthType || '—',
        status: r.status || '—',
        doctor: r.doctorName || '—',
        token: r.preauthToken || r.consentToken || '—',
        serviceStart: r.serviceStart
          ? r.serviceStart.replace('T', ' ').slice(0, 19)
          : '—',
        raw: r,
      })),
    [rows],
  );

  const { goTo, results: paginatedRows, currentPage } = usePagination(tableRows, currentPageSize);

  const headers = [
    { key: 'patient', header: 'Patient' },
    { key: 'memberId', header: 'Member ID' },
    { key: 'intervention', header: 'Intervention' },
    { key: 'preauthType', header: 'Type' },
    { key: 'status', header: 'Status' },
    { key: 'doctor', header: 'Doctor' },
    { key: 'token', header: 'Preauth token' },
    { key: 'serviceStart', header: 'Service start' },
    { key: 'action', header: 'Action' },
  ];

  const handleResend = useCallback(
    async (row: PreauthPreviewRow) => {
      if (!row.practitionerRegistrationNumber) {
        showSnackbar({
          kind: 'error',
          title: 'Missing doctor registration',
          subtitle: 'No practitioner registration number on this preauth doctor profile.',
        });
        return;
      }
      if (!row.interventionCode) {
        showSnackbar({
          kind: 'error',
          title: 'Missing intervention',
          subtitle: 'Cannot resend doctor consent without an intervention code.',
        });
        return;
      }
      setResendingId(row.id);
      try {
        await resendPreauthDoctorConsent({
          practitionerRegistrationNumber: row.practitionerRegistrationNumber,
          consentToken: row.consentToken,
          interventionCode: row.interventionCode,
          locationUuid,
        });
        showSnackbar({
          kind: 'success',
          title: 'Doctor consent resent',
          subtitle: 'The doctor should receive another SMS approval request.',
        });
        onRefresh();
      } catch (e) {
        showSnackbar({
          kind: 'error',
          title: 'Resend failed',
          subtitle: String(e ?? 'Could not resend doctor consent'),
        });
      } finally {
        setResendingId(null);
      }
    },
    [locationUuid, onRefresh],
  );

  if (loading) {
    return <InlineLoading description="Loading preauthorisations…" />;
  }

  if (!rows.length) {
    return <div>No preauthorisations in this status for the selected date.</div>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <Button kind="ghost" size="sm" renderIcon={Renew} onClick={onRefresh}>
          Refresh
        </Button>
      </div>
      <DataTable rows={paginatedRows} headers={headers}>
        {({ rows: dtRows, headers: dtHeaders, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
          <Table size="sm" useZebraStyles aria-label="preauthorisations" {...getTableProps()}>
            <TableHead>
              <TableRow>
                {dtHeaders.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {dtRows.map((row) => {
                const source = tableRows.find((r) => r.id === row.id)?.raw;
                return (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => {
                      if (cell.info.header === 'status') {
                        return (
                          <TableCell key={cell.id} {...getCellProps({ cell })}>
                            <Tag
                              size="sm"
                              type={
                                isAwaitingDoctorApproval(source)
                                  ? 'magenta'
                                  : String(cell.value).includes('FINAL')
                                    ? 'green'
                                    : 'blue'
                              }
                            >
                              {String(cell.value)}
                            </Tag>
                          </TableCell>
                        );
                      }
                      if (cell.info.header === 'preauthType') {
                        return (
                          <TableCell key={cell.id} {...getCellProps({ cell })}>
                            <Tag size="sm" type="purple">
                              {String(cell.value)}
                            </Tag>
                          </TableCell>
                        );
                      }
                      if (cell.info.header === 'action') {
                        const canResend = source && isAwaitingDoctorApproval(source);
                        return (
                          <TableCell key={cell.id} {...getCellProps({ cell })}>
                            {canResend ? (
                              <Button
                                kind="tertiary"
                                size="sm"
                                disabled={resendingId === source.id}
                                onClick={() => handleResend(source)}
                              >
                                {resendingId === source.id ? (
                                  <InlineLoading description="Resending…" />
                                ) : (
                                  'Resend doctor consent'
                                )}
                              </Button>
                            ) : (
                              '—'
                            )}
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
                );
              })}
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
};

export default PreauthPreviewTable;
