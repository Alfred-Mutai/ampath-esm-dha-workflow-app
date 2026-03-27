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
  DatePicker,
  DatePickerInput,
} from '@carbon/react';
import { Money, WarningAlt, CheckmarkFilled, Hospital, PendingFilled, Receipt, Calendar } from '@carbon/react/icons';
import { ConfigurableLink, navigate } from '@openmrs/esm-framework';
import { spacing05 } from '@carbon/themes';
import './billingTotalsRow.component.scss';
import { fetchBillsByDate } from '../api/billing.api';

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
  billItems: any;
  raisedBy: string;
  createdAt: Date;
};

async function fetchBills(date: string): Promise<Bill[]> {
  const res = await fetchBillsByDate(date);
  const bills: Bill[] = [];

  (res.data ?? []).forEach((billNode: any) => {
    const createdAt = new Date(billNode.dateCreated);

    const dateStr =
      createdAt.toLocaleDateString() === new Date().toLocaleDateString()
        ? 'Today'
        : createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const timeStr = createdAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const services = billNode.billItems?.map((i: any) => i.billName).join(', ') ?? '';

    const totalAmount =
      billNode.billItems?.reduce((sum: number, i: any) => sum + Number(i.price ?? 0) * Number(i.quantity ?? 1), 0) ?? 0;

    const shaAmount =
      billNode.billItems
        ?.filter((i: any) => i.paymentMode.toUpperCase() === 'SHA')
        .reduce((sum: number, i: any) => sum + Number(i.price ?? 0) * Number(i.quantity ?? 1), 0) ?? 0;

    const cashAmount =
      billNode.billItems
        ?.filter((i: any) => i.paymentMode.toUpperCase() === 'CASH')
        .reduce((sum: number, i: any) => sum + Number(i.price ?? 0) * Number(i.quantity ?? 1), 0) ?? 0;

    const formatCurrency = (amt: number) =>
      `Ksh ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let amountDisplay = '';
    if (shaAmount > 0 && cashAmount > 0) {
      amountDisplay = `SHA: ${formatCurrency(shaAmount)}, Cash: ${formatCurrency(cashAmount)} (Total: ${formatCurrency(totalAmount)})`;
    } else if (shaAmount > 0) {
      amountDisplay = `SHA: ${formatCurrency(shaAmount)}`;
    } else if (cashAmount > 0) {
      amountDisplay = `Cash: ${formatCurrency(cashAmount)}`;
    } else {
      amountDisplay = formatCurrency(0);
    }

    const hasSha = billNode.billItems?.some((i: any) => i.paymentMode === 'SHA') ?? false;

    let status: BillStatus;
    let paymentMode: string;

    if (billNode.balance > 0) {
      status = 'UNPAID';
      paymentMode = 'CASH';
    } else if (hasSha) {
      status = 'CLAIM_SUBMITTED';
      paymentMode = 'SHA';
    } else {
      status = 'PAID';
      paymentMode = 'CASH';
    }

    bills.push({
      id: `${billNode.billUuid}|${billNode.patientUuid}`,
      patientId: billNode.patientUuid ?? '',
      receiptNo: billNode.receiptNumber ?? 'N/A',
      patient: billNode.patientName ?? 'Unknown',
      raisedBy: billNode.cashPoint ?? 'Unknown',
      paymentMode,
      date: `${dateStr}, ${timeStr}`,
      status,
      items: services,
      total: amountDisplay,
      billItems: billNode.billItems ?? [],
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

const { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } = DataTable;

const BillsTable = ({
  rows,
}: {
  rows: Bill[];
  search: string;
  setSearch: (val: string) => void;
  filterDate: Date | null;
  setFilterDate: (val: Date | null) => void;
}) => {
  const [redirecting] = useState(false);

  return (
    <>
      {redirecting && <InlineLoading description="Redirecting to patient bill..." status="active" />}

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
  search,
  setSearch,
  loading,
}: {
  status?: BillStatus;
  source: Bill[];
  filterDate: Date;
  setFilterDate: (val: Date) => void;
  search: string;
  setSearch: (val: string) => void;
  loading: boolean;
}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(
    () =>
      source.filter((b) => {
        const statusMatch = !status || b.status === status;
        const searchMatch =
          b.patient.toLowerCase().includes(search.toLowerCase()) ||
          b.receiptNo.toLowerCase().includes(search.toLowerCase());
        const start = new Date(filterDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterDate);
        end.setHours(23, 59, 59, 999);
        const dateMatch = b.createdAt >= start && b.createdAt <= end;
        return statusMatch && searchMatch && dateMatch;
      }),
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
  const [filterDate, setFilterDate] = useState<Date>(() => {
    const saved = sessionStorage.getItem('billing-filter-date');
    if (!saved) return new Date();

    try {
      const data = JSON.parse(saved);
      if (data.expiry && new Date().getTime() > data.expiry) {
        sessionStorage.removeItem('billing-filter-date');
        return new Date();
      }
      return new Date(data.value);
    } catch {
      return new Date();
    }
  });
  const [search, setSearch] = useState('');
  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

  useEffect(() => {
    const loadBills = async () => {
      try {
        setLoading(true);

        const dateStr = formatDate(filterDate);
        const fetchedBills = await fetchBills(dateStr);

        setBills(fetchedBills);
      } catch (error) {
        console.error('Error fetching bills:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, [filterDate]);

  useEffect(() => {
    const expiry = new Date().getTime() + 5 * 60 * 1000;
    const data = {
      value: filterDate.toISOString(),
      expiry,
    };
    sessionStorage.setItem('billing-filter-date', JSON.stringify(data));
  }, [filterDate]);

  // Filter bills by selected date
  const billsForDate = useMemo(() => {
    const start = new Date(filterDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filterDate);
    end.setHours(23, 59, 59, 999);

    return bills.filter((b) => b.createdAt >= start && b.createdAt <= end);
  }, [bills, filterDate]);

  const counts = useMemo(
    () => ({
      all: billsForDate.length,
      unpaid: billsForDate.filter((b) => b.status === 'UNPAID').length,
      paid: billsForDate.filter((b) => b.status === 'PAID').length,
      submittedClaims: billsForDate.filter((b) => b.status === 'CLAIM_SUBMITTED').length,
    }),
    [billsForDate],
  );

  const revenueToday = useMemo(
    () => billsForDate.filter((b) => b.status === 'PAID').reduce((sum, b) => sum + Number(b.total), 0),
    [billsForDate],
  );

  const { cashTotal, shaTotal, pendingTotal } = useMemo(() => {
    let cash = 0;
    let sha = 0;
    let pending = 0;

    billsForDate.forEach((bill: any) => {
      const items = bill.billItems ?? [];

      items.forEach((item: any) => {
        const amount = Number(item.price ?? 0) * Number(item.quantity ?? 1);
        const mode = item.paymentMode?.toUpperCase();
        const status = item.paymentStatus?.toUpperCase();

        if (mode === 'CASH' && status === 'PAID') {
          cash += amount;
        }

        if (mode === 'SHA' && status === 'PAID') {
          sha += amount;
        }

        if (status === 'PENDING') {
          pending += amount;
        }
      });
    });

    return {
      cashTotal: cash,
      shaTotal: sha,
      pendingTotal: pending,
    };
  }, [billsForDate]);

  const filterBillsBy = (status?: BillStatus) => {
    const start = new Date(filterDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filterDate);
    end.setHours(23, 59, 59, 999);

    return bills.filter((b) => {
      const statusMatch = !status || b.status === status;
      const searchMatch =
        b.patient.toLowerCase().includes(search.toLowerCase()) ||
        b.receiptNo.toLowerCase().includes(search.toLowerCase());
      const dateMatch = b.createdAt >= start && b.createdAt <= end;
      return statusMatch && searchMatch && dateMatch;
    });
  };

  return (
    <Stack gap={4} className="cds--pt-06">
      {/* Stats Tiles */}
      <div
        style={{
          padding: spacing05,
          paddingBottom: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            paddingBottom: spacing05,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Receipt
              size={36}
              style={{
                color: 'var(--omrs-color-primary, #005D5D)',
                flexShrink: 0,
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p className="cds--heading-04" style={{ margin: 0, fontWeight: 600, color: '#003B3B' }}>
                Billing Dashboard
              </p>

              <p
                className="cds--label"
                style={{
                  margin: 0,
                  opacity: 0.7,
                  fontStyle: 'italic',
                  letterSpacing: 0.5,
                }}
              >
                Summary of billing activity
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--cds-interactive-02,#E0F4F4)',
              color: 'var(--omrs-color-primary, #005D5D)',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              minHeight: '36px',
            }}
          >
            <Calendar size={18} style={{ color: 'var(--omrs-color-primary, #005D5D)', flexShrink: 0 }} />
            <span>
              {filterDate.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <hr
          style={{
            border: 'none',
            borderTop: '1px solid #e0e0e0',
            margin: 0,
          }}
        />
      </div>

      <div style={{ padding: spacing05 }}>
        <Grid fullWidth>
          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<Money size={25} />}
              label="Cash Paid"
              value={
                loading ? (
                  <AISkeletonText />
                ) : (
                  `Ksh ${cashTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                )
              }
              style={{ backgroundColor: '#DFF6F0', color: '#00B37E', padding: spacing05, height: '100%' }}
            />
          </Column>

          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<Hospital size={25} />}
              label="Amount Claimed"
              value={
                loading ? (
                  <AISkeletonText />
                ) : (
                  `Ksh ${shaTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                )
              }
              style={{ backgroundColor: '#F4EBFF', color: '#8C41FF', padding: spacing05, height: '100%' }}
            />
          </Column>

          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<PendingFilled size={25} />}
              label="Pending Amount"
              value={
                loading ? (
                  <AISkeletonText />
                ) : (
                  `Ksh ${pendingTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                )
              }
              style={{ backgroundColor: '#FFF5D9', color: '#F2B01F', padding: spacing05, height: '100%' }}
            />
          </Column>

          <Column lg={4} md={8} sm={4}>
            <StatTile
              icon={<WarningAlt size={25} />}
              label="Unpaid Bills"
              value={loading ? <AISkeletonText /> : counts.unpaid}
              style={{ backgroundColor: '#FFEDE1', color: '#FF6B35', padding: spacing05, height: '100%' }}
            />
          </Column>
        </Grid>
      </div>

      {/* Filters + Tabs */}
      <div style={{ padding: spacing05, paddingTop: 0 }}>
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '0.25rem', paddingTop: spacing05 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', padding: spacing05 }}>
            {/* Search */}
            <div style={{ flex: 4 }}>
              <Search
                closeButtonLabelText="Clear search input"
                id="search-default-1"
                labelText="Search bills"
                placeholder="Search bill or patient"
                size="md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Date */}
            <div style={{ flex: 1 }}>
              <DatePicker
                datePickerType="single"
                value={[formatDate(filterDate)]}
                dateFormat="Y-m-d"
                onChange={(dates) => setFilterDate(new Date(dates[0] ?? new Date()))}
              >
                <DatePickerInput id="bill-date-filter" placeholder="yyyy-mm-dd" labelText="" size="md" />
              </DatePicker>
            </div>
          </div>

          <Tabs>
            <TabList style={{ paddingLeft: spacing05 }}>
              <Tab>
                Unpaid (All Payment Modes){' '}
                <Tag type="red" size="sm">
                  {loading ? <AISkeletonText /> : counts.unpaid}
                </Tag>
              </Tab>
              <Tab>
                Paid (Cash){' '}
                <Tag type="green" size="sm">
                  {loading ? <AISkeletonText /> : counts.paid}
                </Tag>
              </Tab>
              <Tab>
                Submitted Claims (SHA/Co-Pay){' '}
                <Tag type="purple" size="sm">
                  {loading ? <AISkeletonText /> : counts.submittedClaims}
                </Tag>
              </Tab>
              <Tab>
                All{' '}
                <Tag type="blue" size="sm">
                  {loading ? <AISkeletonText /> : counts.all}
                </Tag>
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <BillsTab
                  source={filterBillsBy('UNPAID')}
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  search={search}
                  setSearch={setSearch}
                  loading={loading}
                />
              </TabPanel>
              <TabPanel>
                <BillsTab
                  source={filterBillsBy('PAID')}
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  search={search}
                  setSearch={setSearch}
                  loading={loading}
                />
              </TabPanel>
              <TabPanel>
                <BillsTab
                  source={filterBillsBy('CLAIM_SUBMITTED')}
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  search={search}
                  setSearch={setSearch}
                  loading={loading}
                />
              </TabPanel>
              <TabPanel>
                <BillsTab
                  source={filterBillsBy()}
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  search={search}
                  setSearch={setSearch}
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
