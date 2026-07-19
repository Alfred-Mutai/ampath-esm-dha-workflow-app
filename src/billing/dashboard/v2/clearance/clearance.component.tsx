import React, { useEffect, useState } from 'react';
import {
  Button,
  InlineLoading,
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
} from '@carbon/react';
import { CheckmarkOutline } from '@carbon/react/icons';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import styles from './clearance.component.scss';
import {
  clearConsultation,
  getClearanceCounts,
  getConsultationClearances,
  type ClearanceStatus,
  type ConsultationClearance,
} from '../../../../shared/services/consultation-clearance.resource';
import PrepaidServices from './prepaid-services.component';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';

const money = (n: number) => (n > 0 ? `KES ${n.toLocaleString('en-KE')}` : 'Waived');

const ClearanceTable: React.FC<{
  status: ClearanceStatus;
  locationUuid: string;
  reloadKey: number;
  onCleared: () => void;
  date?: string;
}> = ({ status, locationUuid, reloadKey, onCleared, date }) => {
  const [rows, setRows] = useState<ConsultationClearance[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getConsultationClearances(status, locationUuid)
      .then((data) => active && setRows(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [status, locationUuid, reloadKey]);

  const clear = async (id: string) => {
    setClearingId(id);
    try {
      await clearConsultation(id);
      showSnackbar({ kind: 'success', title: 'Cleared', subtitle: 'Patient can now be seen at the queue.' });
      onCleared();
    } finally {
      setClearingId('');
    }
  };

  if (loading) {
    return <InlineLoading description="Loading…" className={styles.loading} />;
  }
  const dateMatched = rows.filter((r) => !date || new Date(r.createdAt).toLocaleDateString('en-CA') === date);
  if (dateMatched.length === 0) {
    return (
      <EmptyState message={status === 'AWAITING_PAYMENT' ? 'No patients awaiting clearance.' : 'No cleared patients yet.'} />
    );
  }

  const term = search.trim().toLowerCase();
  const filtered = dateMatched.filter(
    (r) => !term || `${r.patientName} ${r.queue} ${r.payer}`.toLowerCase().includes(term),
  );

  return (
    <>
      <TableToolbar
        id={`clearance-${status}`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search patient, queue or payer…"
      />
      {filtered.length === 0 ? (
        <EmptyState message="No clearances match your search." />
      ) : (
        <div className={styles.tableCard}>
          <Table size="sm" aria-label="clearance" useZebraStyles>
        <TableHead>
          <TableRow>
            <TableHeader>Patient</TableHeader>
            <TableHeader>Queue</TableHeader>
            <TableHeader>Visit type</TableHeader>
            <TableHeader>Payer</TableHeader>
            <TableHeader className={styles.numCol}>Consultation fee</TableHeader>
            <TableHeader>{status === 'AWAITING_PAYMENT' ? 'Action' : 'Status'}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.patientName}</TableCell>
              <TableCell>{r.queue}</TableCell>
              <TableCell>{r.visitType}</TableCell>
              <TableCell>{r.payer}</TableCell>
              <TableCell className={styles.numCol}>{money(r.amount)}</TableCell>
              <TableCell>
                {status === 'AWAITING_PAYMENT' ? (
                  <Button
                    kind="primary"
                    size="sm"
                    renderIcon={CheckmarkOutline}
                    disabled={clearingId === r.id}
                    onClick={() => clear(r.id)}
                  >
                    {clearingId === r.id ? 'Clearing…' : 'Mark paid & release'}
                  </Button>
                ) : (
                  <Tag size="sm" type="green">
                    Cleared · at queue
                  </Tag>
                )}
              </TableCell>
            </TableRow>
          ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

const Clearance: React.FC<{
  onChange?: () => void;
  pendingTab?: React.ReactNode;
  initialTab?: string;
  navNonce?: number;
  date?: string;
}> = ({ onChange, pendingTab, initialTab, navNonce, date }) => {
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const [reloadKey, setReloadKey] = useState(0);
  const [counts, setCounts] = useState<{ awaiting: number; cleared: number }>({ awaiting: 0, cleared: 0 });
  const [tabIndex, setTabIndex] = useState(0);

  // Order of the sub-tabs (the "pending" tab only exists when pendingTab is passed).
  const tabKeys = [...(pendingTab ? ['pending'] : []), 'awaiting', 'cleared', 'prepaid'];

  const refresh = () => {
    setReloadKey((k) => k + 1);
    onChange?.();
  };

  useEffect(() => {
    getClearanceCounts(locationUuid).then(setCounts);
  }, [locationUuid, reloadKey]);

  // Jump to the sub-tab requested from the dashboard summary tiles.
  useEffect(() => {
    const i = tabKeys.indexOf(initialTab ?? '');
    if (i >= 0) {
      setTabIndex(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navNonce]);

  return (
    <div className={styles.clearance}>
      <div className={styles.intro}>
        <h5 className={styles.title}>Consultation clearance</h5>
        <p className={styles.subtitle}>
          Patients wait in the queue marked <strong>Awaiting clearance</strong> until their consultation fee is settled.
          Mark it paid to release them to be seen.
        </p>
      </div>
      <Tabs selectedIndex={tabIndex} onChange={({ selectedIndex }) => setTabIndex(selectedIndex)}>
        <TabList aria-label="Clearance">
          {pendingTab ? <Tab>Pending clearance</Tab> : null}
          <Tab>
            Awaiting payment{counts.awaiting ? <span className={styles.pill}>{counts.awaiting}</span> : null}
          </Tab>
          <Tab>Cleared{counts.cleared ? <span className={styles.pill}>{counts.cleared}</span> : null}</Tab>
          <Tab>Scheduled (prepaid)</Tab>
        </TabList>
        <TabPanels>
          {pendingTab ? <TabPanel>{pendingTab}</TabPanel> : null}
          <TabPanel>
            <ClearanceTable status="AWAITING_PAYMENT" locationUuid={locationUuid} reloadKey={reloadKey} onCleared={refresh} date={date} />
          </TabPanel>
          <TabPanel>
            <ClearanceTable status="CLEARED" locationUuid={locationUuid} reloadKey={reloadKey} onCleared={refresh} date={date} />
          </TabPanel>
          <TabPanel>
            <PrepaidServices locationUuid={locationUuid} onChanged={refresh} date={date} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default Clearance;
