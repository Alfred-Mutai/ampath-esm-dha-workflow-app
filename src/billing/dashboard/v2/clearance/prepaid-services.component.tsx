import React, { useEffect, useState } from 'react';
import {
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import styles from './clearance.component.scss';
import { getPrepaidServices, type PrepaidService } from '../../../../shared/services/consultation-clearance.resource';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-KE');

const PrepaidServices: React.FC<{ locationUuid: string; onChanged?: () => void }> = ({ locationUuid }) => {
  const [rows, setRows] = useState<PrepaidService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPrepaidServices(undefined, locationUuid)
      .then((data) => active && setRows(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [locationUuid]);

  return (
    <div>
      <div className={styles.prepaidHead}>
        <p className={styles.prepaidHint}>
          Services paid today but delivered on a later visit (e.g. a lab test). When the patient returns, their visit is
          recognised as prepaid and isn&apos;t billed again.
        </p>
      </div>

      {loading ? (
        <InlineLoading description="Loading…" className={styles.loading} />
      ) : rows.length === 0 ? (
        <EmptyState message="No prepaid services recorded." />
      ) : (
        (() => {
          const term = search.trim().toLowerCase();
          const filtered = rows.filter((p) => {
            const matchesSearch = !term || `${p.patientName} ${p.service}`.toLowerCase().includes(term);
            const matchesDate = !filterDate || p.dueDate === filterDate;
            return matchesSearch && matchesDate;
          });
          return (
            <>
              <TableToolbar
                id="prepaid"
                search={search}
                onSearch={setSearch}
                date={filterDate}
                onDate={setFilterDate}
                searchPlaceholder="Search patient or service…"
              />
              {filtered.length === 0 ? (
                <EmptyState message="No prepaid services match your filters." />
              ) : (
                <div className={styles.tableCard}>
                  <Table size="sm" aria-label="prepaid services" useZebraStyles>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Patient</TableHeader>
                        <TableHeader>Service</TableHeader>
                        <TableHeader className={styles.numCol}>Amount</TableHeader>
                        <TableHeader>Paid on</TableHeader>
                        <TableHeader>Due</TableHeader>
                        <TableHeader>Status</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.patientName}</TableCell>
                          <TableCell>{p.service}</TableCell>
                          <TableCell className={styles.numCol}>{money(p.amount)}</TableCell>
                          <TableCell>{fmt(p.paidOn)}</TableCell>
                          <TableCell>{p.dueDate}</TableCell>
                          <TableCell>
                            <Tag size="sm" type={p.status === 'OPEN' ? 'blue' : 'green'}>
                              {p.status === 'OPEN' ? 'Scheduled' : 'Delivered'}
                            </Tag>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          );
        })()
      )}
    </div>
  );
};

export default PrepaidServices;
