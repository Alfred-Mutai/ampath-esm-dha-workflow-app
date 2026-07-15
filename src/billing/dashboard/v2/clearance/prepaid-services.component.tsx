import React, { useEffect, useState } from 'react';
import {
  Button,
  InlineLoading,
  NumberInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import styles from './clearance.component.scss';
import {
  addPrepaidService,
  getPrepaidServices,
  type PrepaidService,
} from '../../../../shared/services/consultation-clearance.resource';
import TableToolbar from '../shared/table-toolbar.component';

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-KE');

const PrepaidServices: React.FC<{ locationUuid: string; onChanged: () => void }> = ({ locationUuid, onChanged }) => {
  const [rows, setRows] = useState<PrepaidService[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const [cr, setCr] = useState('');
  const [name, setName] = useState('');
  const [service, setService] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState('');
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
  }, [locationUuid, reload]);

  const canSave = cr.trim() && name.trim() && service.trim() && amount > 0 && dueDate;

  const save = () => {
    addPrepaidService({
      crNumber: cr.trim(),
      patientName: name.trim(),
      locationUuid,
      service: service.trim(),
      amount,
      payer: 'Cash',
      dueDate,
    });
    showSnackbar({
      kind: 'success',
      title: 'Prepaid service recorded',
      subtitle: 'The return visit won’t be billed again for this service.',
    });
    setCr('');
    setName('');
    setService('');
    setAmount(0);
    setDueDate('');
    setShowForm(false);
    setReload((k) => k + 1);
    onChanged();
  };

  return (
    <div>
      <div className={styles.prepaidHead}>
        <p className={styles.prepaidHint}>
          Record a service paid today but delivered on a later visit (e.g. a lab test). When the patient returns, their
          visit is recognised as prepaid and isn&apos;t billed again.
        </p>
        <Button size="sm" kind="tertiary" renderIcon={Add} onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : 'Record prepaid service'}
        </Button>
      </div>

      {showForm ? (
        <div className={styles.prepaidForm}>
          <TextInput id="pp-cr" labelText="CR / SHA number" value={cr} onChange={(e) => setCr(e.target.value)} />
          <TextInput id="pp-name" labelText="Patient name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput id="pp-service" labelText="Service" placeholder="e.g. Full haemogram" value={service} onChange={(e) => setService(e.target.value)} />
          <NumberInput
            id="pp-amount"
            label="Amount paid (KES)"
            min={0}
            value={amount}
            onChange={(_e, { value }) => setAmount(Number(value) || 0)}
          />
          <TextInput id="pp-due" labelText="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button size="md" disabled={!canSave} onClick={save} className={styles.prepaidSave}>
            Save prepaid service
          </Button>
        </div>
      ) : null}

      {loading ? (
        <InlineLoading description="Loading…" className={styles.loading} />
      ) : rows.length === 0 ? (
        <p className={styles.empty}>No prepaid services recorded.</p>
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
                <p className={styles.empty}>No prepaid services match your filters.</p>
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
