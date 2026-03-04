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
import { navigate, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { spacing05 } from '@carbon/themes';
import './billingTotalsRow.component.scss';

type BillStatus = 'UNPAID' | 'PAID';

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
  const res = await openmrsFetch(
    `${restBaseUrl}/billing/bill?v=custom:(id,uuid,dateCreated,status,receiptNumber,patient:(uuid,display),cashier:(uuid,display),lineItems:(uuid,price,billableService,voided))&status=PENDING,POSTED&limit=50&startIndex=0&totalCount=true`,
    { credentials: 'include', headers: { Accept: 'application/xml' } },
  );

  if (!res.ok) throw new Error('Failed to fetch OpenMRS bills');

  const xmlText = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const billObjects = Array.from(xml.getElementsByTagName('object')).filter(
    (obj) => obj.parentElement?.tagName === 'results',
  );

  const bills: Bill[] = [];

  billObjects.forEach((billNode) => {
    const patientNode = billNode.getElementsByTagName('patient')[0];
    const patientDisplay = patientNode?.getElementsByTagName('display')[0]?.textContent ?? 'Unknown';
    const patientName = patientDisplay.includes('-')
      ? patientDisplay.slice(patientDisplay.lastIndexOf('-') + 1).trim()
      : patientDisplay.trim();

    const receiptNumber = billNode.getElementsByTagName('receiptNumber')[0]?.textContent ?? 'N/A';
    const statusText = billNode.getElementsByTagName('status')[0]?.textContent ?? '';
    const status: BillStatus = statusText === 'POSTED' ? 'PAID' : 'UNPAID';

    const dateCreated = billNode.getElementsByTagName('dateCreated')[0]?.textContent ?? '';
    const createdAt = new Date(dateCreated);
    const todayStr = new Date().toLocaleDateString();
    const timeStr = createdAt
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      .toUpperCase();

    const cashierNode = billNode.getElementsByTagName('cashier')[0];
    const cashierDisplay = cashierNode?.getElementsByTagName('display')[0]?.textContent ?? 'N/A';
    const raisedBy = cashierDisplay.includes('-')
      ? cashierDisplay.slice(cashierDisplay.lastIndexOf('-') + 1).trim()
      : cashierDisplay.trim();

    const lineItemsNode = billNode.getElementsByTagName('lineItems')[0];
    let totalAmount = 0;
    const billedServices: string[] = [];

    if (lineItemsNode) {
      Array.from(lineItemsNode.getElementsByTagName('object')).forEach((item) => {
        const voided = item.getElementsByTagName('voided')[0]?.textContent === 'true';
        if (voided) return;

        const priceText = item.getElementsByTagName('price')[0]?.textContent ?? '0';
        totalAmount += parseFloat(priceText);

        const serviceName = item.getElementsByTagName('billableService')[0]?.textContent?.trim();
        if (serviceName) billedServices.push(serviceName);
      });
    }

    if (billedServices.length === 0) return;

    const dateStr =
      createdAt.toLocaleDateString() === todayStr
        ? 'Today'
        : createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    bills.push({
      id: `${billNode.getElementsByTagName('uuid')[0]?.textContent ?? ''}|${patientNode?.getElementsByTagName('uuid')[0]?.textContent ?? ''}`,
      patientId: patientNode?.getElementsByTagName('uuid')[0]?.textContent ?? '',
      receiptNo: receiptNumber,
      patient: patientName,
      raisedBy,
      paymentMode: 'N/A',
      date: `${dateStr}, ${timeStr}`,
      status,
      total: totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      items: billedServices.join(', '),
      createdAt,
    });
  });

  return bills;
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

const ClaimsTable = ({
  claims,
  type,
  loading,
}: {
  claims: Claim[];
  type: 'PENDING' | 'SUBMITTED';
  loading: boolean;
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 🔎 Filter
  const filtered = useMemo(() => {
    return claims.filter((c) => {
      const searchLower = search.toLowerCase();
      return (
        c.patient.toLowerCase().includes(searchLower) ||
        c.scheme.toLowerCase().includes(searchLower)
      );
    });
  }, [claims, search]);

  // 📄 Pagination
  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  if (loading) {
    return <InlineLoading description="Loading claims..." />;
  }

  const rows = paginated.map((c) => ({
    id: c.id,
    patient: c.patient,
    scheme: c.scheme,
    total: `Ksh ${c.total}`,
    date: c.createdAt.toLocaleDateString(),
    actions: c.id,
  }));

  const handleSubmitClaim = async () => {
    if (!selectedClaim) return;

    try {
      setSubmitting(true);

      // TODO: Replace with real API call
      await new Promise((res) => setTimeout(res, 1200));

      alert('Claim submitted successfully');

      setSelectedClaim(null);
    } catch (err) {
      alert('Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap={4}>
      {/* 🔎 Search */}
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4}>
          <Search
            id={`search-claims-${type}`}
            labelText="Search claims"
            placeholder="Search by patient or scheme"
            size="md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Column>
      </Grid>

      {/* 📊 Table */}
      <DataTable rows={rows} headers={claimHeaders}>
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
                    if (cell.info.header === 'actions') {
                      return (
                        <TableCell key={cell.id}>
                          {type === 'PENDING' ? (
                            <Button
                              size="sm"
                              kind="primary"
                              onClick={() =>
                                setSelectedClaim(
                                  claims.find((c) => c.id === cell.value) || null,
                                )
                              }
                            >
                              Preview
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              kind="secondary"
                            >
                              Check Status
                            </Button>
                          )}
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

      {/* 📄 Pagination */}
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

      {/* 🧾 Preview Modal */}
      {selectedClaim && (
        <Modal
          open
          modalHeading="Claim Preview"
          primaryButtonText={submitting ? 'Submitting...' : 'Submit Claim'}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={submitting}
          onRequestClose={() => !submitting && setSelectedClaim(null)}
          onRequestSubmit={handleSubmitClaim}
        >
          <Stack gap={4}>
            <p><strong>Patient:</strong> {selectedClaim.patient}</p>
            <p><strong>Insurance Scheme:</strong> {selectedClaim.scheme}</p>
            <p><strong>Amount:</strong> Ksh {selectedClaim.total}</p>
            <p>
              <strong>Created:</strong>{' '}
              {selectedClaim.createdAt.toLocaleDateString()}
            </p>
          </Stack>
        </Modal>
      )}
    </Stack>
  );
};

type ClaimStatus = 'PENDING' | 'SUBMITTED';

type Claim = {
  id: string;
  billId: string;
  patientId: string;
  patient: string;
  scheme: string;
  total: string;
  status: ClaimStatus;
  createdAt: Date;
};

type ClaimsResponse = {
  pending: Claim[];
  submitted: Claim[];
};

async function fetchClaims(): Promise<ClaimsResponse> {
  try {
    const res = await openmrsFetch(
      `${restBaseUrl}/billing/claim?v=custom:(uuid,status,dateCreated,bill:(uuid,totalAmount,patient:(uuid,display)),insuranceScheme:(display))&limit=50`,
      { credentials: 'include' },
    );

    if (!res.ok) throw new Error('API not ready');

    const data = await res.json();

    const parsed: Claim[] = data.results.map((c) => {
      const patientDisplay = c.bill?.patient?.display ?? 'Unknown';
      const patientName = patientDisplay.includes('-')
        ? patientDisplay.slice(patientDisplay.lastIndexOf('-') + 1).trim()
        : patientDisplay.trim();

      return {
        id: c.uuid,
        billId: c.bill?.uuid,
        patientId: c.bill?.patient?.uuid,
        patient: patientName,
        scheme: c.insuranceScheme?.display ?? 'N/A',
        total: Number(c.bill?.totalAmount ?? 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
        status: c.status === 'SUBMITTED' ? 'SUBMITTED' : 'PENDING',
        createdAt: new Date(c.dateCreated),
      };
    });

    return {
      pending: parsed.filter((c) => c.status === 'PENDING'),
      submitted: parsed.filter((c) => c.status === 'SUBMITTED'),
    };
  } catch (error) {
    console.warn('Using mock claims data');

    return getMockClaims();
  }
}

function getMockClaims(): ClaimsResponse {
  const mockApiResponse = {
    results: [
      {
        uuid: 'claim-001',
        status: 'PENDING',
        dateCreated: '2026-03-01T10:30:00.000Z',
        bill: {
          uuid: 'bill-001',
          totalAmount: 2500,
          patient: {
            uuid: 'patient-001',
            display: '1001 - John Doe',
          },
        },
        insuranceScheme: {
          display: 'NHIF',
        },
      },
      {
        uuid: 'claim-002',
        status: 'SUBMITTED',
        dateCreated: '2026-03-02T09:15:00.000Z',
        bill: {
          uuid: 'bill-002',
          totalAmount: 4800,
          patient: {
            uuid: 'patient-002',
            display: '1002 - Mary Wanjiku',
          },
        },
        insuranceScheme: {
          display: 'AAR Insurance',
        },
      },
      {
        uuid: 'claim-003',
        status: 'PENDING',
        dateCreated: '2026-03-03T14:45:00.000Z',
        bill: {
          uuid: 'bill-003',
          totalAmount: 1200,
          patient: {
            uuid: 'patient-003',
            display: '1003 - Peter Mwangi',
          },
        },
        insuranceScheme: {
          display: 'Britam',
        },
      },
    ],
  };

  const parsed: Claim[] = mockApiResponse.results.map((c) => {
    const patientName = c.bill.patient.display.split('-')[1].trim();

    return {
      id: c.uuid,
      billId: c.bill.uuid,
      patientId: c.bill.patient.uuid,
      patient: patientName,
      scheme: c.insuranceScheme.display,
      total: c.bill.totalAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
      }),
      status: c.status as ClaimStatus,
      createdAt: new Date(c.dateCreated),
    };
  });

  return {
    pending: parsed.filter((c) => c.status === 'PENDING'),
    submitted: parsed.filter((c) => c.status === 'SUBMITTED'),
  };
}

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
  const map = {
    UNPAID: (
      <Tag size="md" type="red">
        <PendingFilled size={10} style={{ marginRight: 4 }} />
        Unpaid
      </Tag>
    ),
    PAID: (
      <Tag size="md" type="green">
        <CheckmarkFilled size={10} style={{ marginRight: 4 }} />
        Paid
      </Tag>
    ),
    OTHERS: (
      <Tag size="md">
        <PendingFilled size={10} style={{ marginRight: 4 }} />
        Other Modes
      </Tag>
    ),
    CLAIM_PENDING: (
      <Tag size="md" type="blue">
        <PendingFilled size={10} style={{ marginRight: 4 }} />
        Claim pending
      </Tag>
    ),
    CLAIM_APPROVED: (
      <Tag size="md" type="teal">
        <PendingFilled size={10} style={{ marginRight: 4 }} />
        Claim approved
      </Tag>
    ),
  };

  return map[status];
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
                          <a
                            href={`${window.spaBase}/home/billing/patient/${row.id.split('|')[1]}/${row.id.split('|')[0]}`}
                            style={{ color: '#0f62fe', textDecoration: 'none', fontWeight: 500 }}
                          >
                            {cell.value}
                          </a>
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

  const [pendingClaims, setPendingClaims] = useState<Claim[]>([]);
  const [submittedClaims, setSubmittedClaims] = useState<Claim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);

  useEffect(() => {
    fetchBills()
      .then((fetched) => {
        const sorted = fetched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setBills(sorted);
      })
      .finally(() => setLoading(false));

    fetchClaims()
      .then(({ pending, submitted }) => {
        setPendingClaims(pending);
        setSubmittedClaims(submitted);
      })
      .finally(() => setClaimsLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      all: bills.length,
      unpaid: bills.filter((b) => b.status === 'UNPAID').length,
      paid: bills.filter((b) => b.status === 'PAID').length,
      pendingClaims: pendingClaims.length,
      submittedClaims: submittedClaims.length,
    }),
    [bills, pendingClaims, submittedClaims],
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
              label="Pending Claims"
              value={loading ? <AISkeletonText /> : counts.pendingClaims}
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
                Pending Claims{' '}
                <Tag type="blue" size="sm">
                  {loading ? <AISkeletonText /> : counts.pendingClaims}
                </Tag>
              </Tab>
              <Tab>
                Submitted Claims{' '}
                <Tag type="green" size="sm">
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
                <ClaimsTable claims={pendingClaims} type="PENDING" loading={claimsLoading} />
              </TabPanel>

              <TabPanel>
                <ClaimsTable claims={submittedClaims} type="SUBMITTED" loading={claimsLoading} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </Stack>
  );
};

export default BillingTotalsRow;
