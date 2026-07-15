import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  InlineLoading,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import styles from './claims-accounting.component.scss';
import {
  CLAIM_TABS,
  getClaimCounts,
  getClaimsByStatuses,
  type ShaClaim,
  type ClaimStatus,
} from './claims-accounting.resource';
import { statusMeta } from './status-meta';
import ClaimDetail from './claim-detail.component';
import RemittancesView from './remittances.component';
import TableToolbar from '../shared/table-toolbar.component';

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

interface ClaimsTableProps {
  statuses: ClaimStatus[];
  reloadKey: number;
  onOpen: (claim: ShaClaim) => void;
}

const ClaimsTable: React.FC<ClaimsTableProps> = ({ statuses, reloadKey, onOpen }) => {
  const [claims, setClaims] = useState<ShaClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getClaimsByStatuses(statuses)
      .then((data) => active && setClaims(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  if (loading) {
    return <InlineLoading description="Loading claims…" className={styles.tableLoading} />;
  }

  if (claims.length === 0) {
    return <p className={styles.empty}>No claims in this state.</p>;
  }

  const term = search.trim().toLowerCase();
  const filtered = claims.filter((c) => {
    const matchesSearch = !term || `${c.claimCode} ${c.patientName} ${c.fund}`.toLowerCase().includes(term);
    const matchesDate = !date || new Date(c.updatedAt).toLocaleDateString('en-CA') === date;
    return matchesSearch && matchesDate;
  });

  return (
    <>
      <TableToolbar
        id={`claims-${statuses.join('-')}`}
        search={search}
        onSearch={setSearch}
        date={date}
        onDate={setDate}
        searchPlaceholder="Search claim, patient or fund…"
      />
      {filtered.length === 0 ? (
        <p className={styles.empty}>No claims match your filters.</p>
      ) : (
        <div className={styles.tableCard}>
          <Table size="sm" aria-label="claims" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Claim</TableHeader>
                <TableHeader>Patient</TableHeader>
                <TableHeader>Fund</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader className={styles.numCol}>Amount</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Updated</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => {
            const meta = statusMeta(c.status);
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <button type="button" className={styles.claimLink} onClick={() => onOpen(c)}>
                    {c.claimCode}
                  </button>
                </TableCell>
                <TableCell>{c.patientName}</TableCell>
                <TableCell>{c.fund}</TableCell>
                <TableCell>{c.serviceType === 'INPATIENT' ? 'IP' : 'OP'}</TableCell>
                <TableCell className={styles.numCol}>{money(c.amount)}</TableCell>
                <TableCell>
                  <Tag type={meta.tag} size="sm">
                    {meta.label}
                  </Tag>
                </TableCell>
                <TableCell>{new Date(c.updatedAt).toLocaleDateString('en-KE')}</TableCell>
              </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

const ClaimsAccounting: React.FC = () => {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<ShaClaim | null>(null);

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    getClaimCounts().then(setCounts);
  }, [reloadKey]);

  if (selected) {
    return <ClaimDetail claim={selected} onBack={() => setSelected(null)} onChanged={refresh} />;
  }

  return (
    <div className={styles.claimsArea}>
      <div className={styles.claimsIntro}>
        <div>
          <h5 className={styles.claimsTitle}>SHA claims</h5>
          <p className={styles.claimsSubtitle}>
            Track every SHA virtual claim through its lifecycle. Submitted claims can be recalled to correct and
            resubmit; rejected claims can be fixed and resubmitted.
          </p>
        </div>
        <Button size="sm" renderIcon={Add} onClick={() => navigate('/claim/new')}>
          New SHA claim
        </Button>
      </div>

      <Tabs>
        <TabList scrollDebounceWait={200} aria-label="Claim lifecycle">
          {CLAIM_TABS.map((tab) => (
            <Tab key={tab.key}>
              {tab.label}
              {counts[tab.key] ? <span className={styles.countPill}>{counts[tab.key]}</span> : null}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {CLAIM_TABS.map((tab) => (
            <TabPanel key={tab.key}>
              {tab.key === 'remittances' ? (
                <RemittancesView reloadKey={reloadKey} onOpenClaim={setSelected} />
              ) : (
                <ClaimsTable statuses={tab.statuses} reloadKey={reloadKey} onOpen={setSelected} />
              )}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default ClaimsAccounting;
