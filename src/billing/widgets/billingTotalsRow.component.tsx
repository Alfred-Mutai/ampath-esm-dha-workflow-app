import React, { useState, useEffect, useMemo } from 'react';
import {
  Grid,
  Column,
  Tile,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Stack,
  DataTable,
  Tag,
  Pagination,
  Search,
  InlineLoading,
  AISkeletonText,
  Modal,
  Button,
} from '@carbon/react';
import { Money, WarningAlt, CheckmarkFilled, Hospital, Receipt, PendingFilled } from '@carbon/react/icons';
import { ConfigurableLink, navigate, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { spacing05 } from '@carbon/themes';
import './billingTotalsRow.component.scss';
import { fetchAllBills } from '../api/billing.api';

type BillStatus = 'UNPAID' | 'PAID' | 'CLAIM_SUBMITTED';

type Bill = {
  id: string;
  patientId: string;
  receiptNo: string;
  patient: string;
  paymentMode: string;
  date: string;
  status: BillStatus;
  total: string;
  items: string;
  raisedBy: string;
  createdAt: Date;
};

async function fetchBills(): Promise<Bill[]> {
  const res = await fetchAllBills();
  const bills: Bill[] = [];

  (res.results ?? []).forEach((billNode: any) => {
    const patientDisplay = billNode.patient?.display ?? 'Unknown';
    const patientName = patientDisplay.includes('-')
      ? (patientDisplay.split('-').pop()?.trim() ?? patientDisplay)
      : patientDisplay;

    const raisedByDisplay = billNode.cashier?.display ?? 'Unknown';
    const raisedBy = raisedByDisplay.includes('-')
      ? (raisedByDisplay.split('-').pop()?.trim() ?? raisedByDisplay)
      : raisedByDisplay;

    const createdAt = new Date(billNode.dateCreated);
    const dateStr =
      createdAt.toLocaleDateString() === new Date().toLocaleDateString()
        ? 'Today'
        : createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    let totalAmount = 0;
    const services: string[] = [];
    const payModes: string[] = [];

    (billNode.lineItems ?? []).forEach((item: any) => {
      if (item.voided) return;
      totalAmount += Number(item.price ?? 0);
      if (item.billableService) services.push(item.billableService);
      payModes.push((item.priceName ?? 'DEFAULT').toUpperCase());
    });

    if (services.length === 0) return; // skip empty bills

    // --- Categorization logic ---
    const normalizedPayModes = payModes.map((p) => (p || '').toUpperCase());
    const hasSha = normalizedPayModes.includes('SHA');

    // Default everything else to PAID (Cash) unless explicitly SHA
    let status: BillStatus;
    let paymentMode: string;

    if (billNode.status === 'PENDING') {
      status = 'UNPAID';
      paymentMode = 'CASH';
    } else if (billNode.status === 'POSTED' || billNode.status === 'PAID') {
      if (hasSha) {
        status = 'CLAIM_SUBMITTED';
        paymentMode = 'SHA';
      } else {
        status = 'PAID'; // Everything else counts as Paid Cash
        paymentMode = 'CASH';
      }
    } else {
      status = 'PAID'; // fallback for any unexpected status
      paymentMode = 'CASH';
    }
    bills.push({
      id: `${billNode.uuid}|${billNode.patient?.uuid ?? ''}`,
      patientId: billNode.patient?.uuid ?? '',
      receiptNo: billNode.receiptNumber ?? 'N/A',
      patient: patientName,
      raisedBy,
      paymentMode, // <- new field included
      date: `${dateStr}, ${timeStr}`,
      status, // <- adjusted status
      total: totalAmount.toFixed(2),
      items: services.join(', '),
      createdAt,
    });
  });

  return bills.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

const headers = [
  { key: 'date', header: 'Date' },
  { key: 'patient', header: 'Patient' },
  { key: 'total', header: 'Amount' },
  { key: 'status', header: 'Status' },
  { key: 'items', header: 'Billed Items' },
];

const claimHeaders = [
  { key: 'patient', header: 'Patient' },
  { key: 'scheme', header: 'Scheme' },
  { key: 'total', header: 'Amount' },
  { key: 'date', header: 'Created' },
  { key: 'actions', header: 'Actions' },
];

const StatTile = ({
  icon,
  label,
  value,
  style,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <Tile style={style}>
    <div style={{ display: 'flex', gap: spacing05, alignItems: 'center' }}>
      {icon}
      <div>
        <p className="cds--label">{label}</p>
        <p className="cds--heading-03" style={{ fontWeight: 'bold' }}>
          {value}
        </p>
      </div>
    </div>
  </Tile>
);

const StatusTag = ({ status }: { status: BillStatus }) => {
  switch (status) {
    case 'UNPAID':
      return (
        <Tag size="md" type="red">
          <PendingFilled size={10} style={{ marginRight: 4 }} />
          Unpaid
        </Tag>
      );
    case 'PAID':
      return (
        <Tag size="md" type="green">
          <CheckmarkFilled size={10} style={{ marginRight: 4 }} />
          Paid (Cash)
        </Tag>
      );
    case 'CLAIM_SUBMITTED':
      return (
        <Tag size="md" type="blue">
          <Hospital size={10} style={{ marginRight: 4 }} />
          Claim Submitted
        </Tag>
      );
    default:
      return <Tag size="md">Other</Tag>;
  }
};

const filterBills = (allBills: Bill[], status?: BillStatus, search = '', range: [Date?, Date?] = []) => {
  return allBills.filter((b) => {
    const statusMatch = !status || b.status === status;
    const searchMatch = b.receiptNo.includes(search) || b.patient.toLowerCase().includes(search.toLowerCase());
    const dateMatch = !range[0] || !range[1] || (b.createdAt >= range[0]! && b.createdAt <= range[1]!);
    return statusMatch && searchMatch && dateMatch;
  });
};

const { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } = DataTable;

const goToPatientBill = (rowId: string) => {
  const [billUuid, patientUuid] = rowId.split('|');
  navigate({
    to: `${window.spaBase}/home/billing/patient/${patientUuid}/${billUuid}`,
  });
};

const BillsTable = ({
  rows,
  search,
  setSearch,
  filterDate,
  setFilterDate,
}: {
  rows: Bill[];
  search: string;
  setSearch: (val: string) => void;
  filterDate: Date | null;
  setFilterDate: (val: Date | null) => void;
}) => {
  const [redirecting, setRedirecting] = useState(false);

  const goToPatientBill = (rowId: string) => {
    setRedirecting(true);

    const [billUuid, patientUuid] = rowId.split('|');

    // Let loading render before route change
    setTimeout(() => {
      navigate({
        to: `${window.spaBase}/home/billing/patient/${patientUuid}/${billUuid}`,
      });
    }, 50);
  };

  return (
    <>
      {redirecting && <InlineLoading description="Redirecting to patient bill..." status="active" />}

      <Grid fullWidth>
        <Column lg={16} md={8} sm={4}>
          <Search
            closeButtonLabelText="Clear search input"
            id="search-default-1"
            labelText="Search bills"
            placeholder="Search bill or patient"
            size="md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={redirecting}
          />
        </Column>
      </Grid>

      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((h) => (
                  <TableHeader key={h.key}>{h.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {row.cells.map((cell) => {
                    if (cell.info.header === 'patient') {
                      return (
                        <TableCell key={cell.id}>
                          <ConfigurableLink
                            style={{ textDecoration: 'none' }}
                            to={`${window.spaBase}/home/billing/patient/${row.id.split('|')[1]}/${row.id.split('|')[0]}`}
                            templateParams={{ patientUuid: row.id.split('|')[1], uuid: row.id.split('|')[0] }}
                          >
                            {cell.value}
                          </ConfigurableLink>
                        </TableCell>
                      );
                    }

                    if (cell.info.header === 'status') {
                      return (
                        <TableCell key={cell.id}>
                          <StatusTag status={cell.value as BillStatus} />
                        </TableCell>
                      );
                    }

                    return <TableCell key={cell.id}>{cell.value}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </>
  );
};

const BillsTab = ({
  status,
  source,
  filterDate,
  setFilterDate,
  loading,
}: {
  status?: BillStatus;
  source: Bill[];
  filterDate: Date | null;
  setFilterDate: (val: Date | null) => void;
  loading: boolean;
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(
    () => filterBills(source, status, search, filterDate ? [filterDate, filterDate] : []),
    [source, status, search, filterDate],
  );

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Stack gap={4}>
      {loading ? (
        <InlineLoading description="Loading bills..." />
      ) : (
        <>
          <BillsTable
            rows={paginated}
            search={search}
            setSearch={setSearch}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            pageSizes={[10, 25, 50, 100]}
            totalItems={filtered.length}
            onChange={({ page, pageSize }) => {
              setPage(page);
              setPageSize(pageSize);
            }}
          />
        </>
      )}
    </Stack>
  );
};

const BillingTotalsRow: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadBills = async () => {
      try {
        const fetchedBills = await fetchBills();
        setBills(fetchedBills);
      } catch (error) {
        console.error('Error fetching bills:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, []); // empty dependency → run only once on mount

  const counts = useMemo(
    () => ({
      all: bills.length,
      unpaid: bills.filter((b) => b.status === 'UNPAID').length,
      paid: bills.filter((b) => b.status === 'PAID').length,
      submittedClaims: bills.filter((b) => b.status === 'CLAIM_SUBMITTED').length,
    }),
    [bills],
  );

  const revenueToday = useMemo(() => {
    const today = new Date().toDateString();

    return bills
      .filter((b) => b.status === 'PAID' && b.createdAt.toDateString() === today)
      .reduce((sum, b) => {
        const amount = Number(b.total.replace(/,/g, ''));
        return sum + amount;
      }, 0);
  }, [bills]);

  return (
    <Stack gap={4} className="cds--pt-06">
      <div
        style={{
          fontSize: 'var(--cds-body-compact-02-font-size, 1rem)',
          fontWeight: 'var(--cds-body-compact-02-font-weight, 400)',
          lineHeight: 'var(--cds-body-compact-02-line-height, 1.375)',
          letterSpacing: 'var(--cds-body-compact-02-letter-spacing, 0)',
          color: 'var(--cds-text-secondary, #525252)',
          height: '6rem',
          backgroundColor: 'var(--cds-background, #ffffff)',
          display: 'flex',
          paddingLeft: '0.5rem',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--cds-border-subtle-01, #e0e0e0)',
        }}
      >
        <Grid fullWidth>
          <Column lg={16} md={8} sm={4}>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <Receipt size={45} style={{ color: 'var(--brand-01)' }} />

              <div style={{ margin: spacing05 }}>
                <p className="cds--label">Billing</p>
                <h4 className="cds--heading-04">Home</h4>
              </div>
            </div>
          </Column>
        </Grid>
      </div>

      <div style={{ padding: spacing05 }}>
        <Grid fullWidth>
          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<Money size={25} />}
              label="Revenue Today"
              value={
                loading ? (
                  <AISkeletonText />
                ) : (
                  `Ksh ${revenueToday.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                )
              }
              style={{
                backgroundColor: 'var(--cds-layer-background-02, #DFF6F0)',
                color: '#00B37E',
                padding: spacing05,
              }}
            />
          </Column>

          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<WarningAlt size={25} />}
              label="Unpaid Bills"
              value={loading ? <AISkeletonText /> : counts.unpaid}
              style={{
                backgroundColor: 'var(--cds-layer-background-02, #FFF5D9)',
                color: '#F2B01F',
                padding: spacing05,
              }}
            />
          </Column>

          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<CheckmarkFilled size={25} />}
              label="Paid Bills"
              value={loading ? <AISkeletonText /> : counts.paid}
              style={{
                backgroundColor: 'var(--cds-layer-background-02, #E7F0FF)',
                color: '#0F62FE',
                padding: spacing05,
              }}
            />
          </Column>

          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<Hospital size={25} />}
              label="Submitted Claims"
              value={loading ? <AISkeletonText /> : counts.submittedClaims}
              style={{
                backgroundColor: 'var(--cds-layer-background-02, #F4EBFF)',
                color: '#8C41FF',
                padding: spacing05,
              }}
            />
          </Column>
        </Grid>
      </div>

      <div style={{ padding: spacing05, paddingTop: 0 }}>
        <div
          style={{
            border: '1px solid var(--cds-border-subtle-01, #e0e0e0)',
            borderRadius: '0.25rem',
            paddingTop: spacing05,
          }}
        >
          <Tabs>
            <TabList activation="manual">
              <Tab>
                All <Tag size="sm">{loading ? <AISkeletonText /> : counts.all}</Tag>
              </Tab>
              <Tab>
                Unpaid{' '}
                <Tag type="red" size="sm">
                  {loading ? <AISkeletonText /> : counts.unpaid}
                </Tag>
              </Tab>
              <Tab>
                Paid{' '}
                <Tag type="green" size="sm">
                  {loading ? <AISkeletonText /> : counts.paid}
                </Tag>
              </Tab>
              <Tab>
                Submitted Claims{' '}
                <Tag type="blue" size="sm">
                  {loading ? <AISkeletonText /> : counts.submittedClaims}
                </Tag>
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <BillsTab source={bills} filterDate={filterDate} setFilterDate={setFilterDate} loading={loading} />
              </TabPanel>
              <TabPanel>
                <BillsTab
                  source={bills}
                  status="UNPAID"
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  loading={loading}
                />
              </TabPanel>
              <TabPanel>
                <BillsTab
                  source={bills}
                  status="PAID"
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  loading={loading}
                />
              </TabPanel>
              <TabPanel>
                <BillsTab
                  source={bills}
                  status="CLAIM_SUBMITTED"
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  loading={loading}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </Stack>
  );
};

export default BillingTotalsRow;
