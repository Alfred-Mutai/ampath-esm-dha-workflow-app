import React, { useEffect, useState } from 'react';
import {
  Button,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import styles from './claims-accounting.component.scss';
import { getRemittances, getClaimsPaidByRemittance, type Remittance } from './remittances.resource';
import { type ShaClaim } from './claims-accounting.resource';
import TableToolbar from '../shared/table-toolbar.component';

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

interface RemittancesViewProps {
  reloadKey: number;
  onOpenClaim: (claim: ShaClaim) => void;
  date?: string;
}

const RemittancesView: React.FC<RemittancesViewProps> = ({ reloadKey, onOpenClaim, date }) => {
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRef, setOpenRef] = useState<Remittance | null>(null);
  const [claims, setClaims] = useState<ShaClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getRemittances()
      .then((data) => active && setRemittances(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const openRemittance = async (r: Remittance) => {
    setOpenRef(r);
    setLoadingClaims(true);
    try {
      setClaims(await getClaimsPaidByRemittance(r.ref));
    } finally {
      setLoadingClaims(false);
    }
  };

  if (loading) {
    return <InlineLoading description="Loading remittances…" className={styles.tableLoading} />;
  }

  // Drill-down: claims paid by the selected remittance
  if (openRef) {
    return (
      <div>
        <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={() => setOpenRef(null)} className={styles.backBtn}>
          All remittances
        </Button>
        <div className={styles.remitHead}>
          <div>
            <span className={styles.remitRef}>{openRef.ref}</span>
            <span className={styles.remitPayer}>{openRef.payer}</span>
          </div>
          <div className={styles.remitAmt}>{money(openRef.totalAmount)}</div>
        </div>
        {loadingClaims ? (
          <InlineLoading description="Loading claims…" className={styles.tableLoading} />
        ) : (
          <div className={styles.tableCard}>
            <Table size="sm" aria-label="claims paid" useZebraStyles>
              <TableHead>
                <TableRow>
                  <TableHeader>Claim</TableHeader>
                  <TableHeader>Patient</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader className={styles.numCol}>Paid</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button type="button" className={styles.claimLink} onClick={() => onOpenClaim(c)}>
                        {c.claimCode}
                      </button>
                    </TableCell>
                    <TableCell>{c.patientName}</TableCell>
                    <TableCell>{c.serviceType === 'INPATIENT' ? 'IP' : 'OP'}</TableCell>
                    <TableCell className={styles.numCol}>{money(c.paidAmount ?? c.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  // Remittance list
  const dateMatched = remittances.filter((r) => !date || r.date === date);
  const term = search.trim().toLowerCase();
  const filtered = dateMatched.filter((r) => !term || `${r.ref} ${r.payer}`.toLowerCase().includes(term));

  return (
    <>
      {dateMatched.length === 0 ? (
        <p className={styles.empty}>No remittances for the selected date.</p>
      ) : (
      <>
      <TableToolbar
        id="remittances"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search remittance ref or payer…"
      />
      {filtered.length === 0 ? (
        <p className={styles.empty}>No remittances match your search.</p>
      ) : (
        <div className={styles.tableCard}>
          <Table size="sm" aria-label="remittances" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Remittance</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Payer</TableHeader>
                <TableHeader className={styles.numCol}>Claims</TableHeader>
                <TableHeader className={styles.numCol}>Amount</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.ref}>
                  <TableCell>
                    <button type="button" className={styles.claimLink} onClick={() => openRemittance(r)}>
                      {r.ref}
                    </button>
                  </TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.payer}</TableCell>
                  <TableCell className={styles.numCol}>{r.claimCount}</TableCell>
                  <TableCell className={styles.numCol}>{money(r.totalAmount)}</TableCell>
                  <TableCell>
                    <Tag size="sm" type={r.status === 'RECONCILED' ? 'green' : 'blue'}>
                      {r.status === 'RECONCILED' ? 'Reconciled' : 'Received'}
                    </Tag>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </>
      )}
    </>
  );
};

export default RemittancesView;
