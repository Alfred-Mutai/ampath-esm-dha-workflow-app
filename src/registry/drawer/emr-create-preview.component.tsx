import React, { useMemo, useState } from 'react';
import { Button, Modal } from '@carbon/react';
import { Add, ChevronDown, ChevronUp } from '@carbon/react/icons';
import { type HieClient } from '../types';
import styles from './emr-compare.component.scss';

interface EmrCreatePreviewProps {
  client: HieClient;
  /** Creates the patient in the EMR. May be async so we can show progress. */
  onCreate: () => void | Promise<unknown>;
}

const norm = (v: unknown) => (v == null ? '' : String(v).trim());
const fmtDate = (d: string) => (d ? String(d).slice(0, 10) : '');

interface Row {
  label: string;
  value: string;
}

// The same field set as the update comparison, shown in full for uniformity
// (fields the registry didn't provide render as "—").
function buildRows(client: HieClient): Row[] {
  return [
    { label: 'First name', value: norm(client.first_name) },
    { label: 'Middle name', value: norm(client.middle_name) },
    { label: 'Last name', value: norm(client.last_name) },
    { label: 'Gender', value: norm(client.gender) },
    { label: 'Date of birth', value: fmtDate(client.date_of_birth) },
    { label: 'Phone', value: norm(client.phone) },
    { label: 'Email', value: norm(client.email) },
    { label: 'County', value: norm(client.county) },
    { label: 'Sub-county', value: norm(client.sub_county) },
    { label: 'Ward', value: norm(client.ward) },
    { label: 'Village', value: norm(client.village_estate) },
  ];
}

const EmrCreatePreview: React.FC<EmrCreatePreviewProps> = ({ client, onCreate }) => {
  const [expanded, setExpanded] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => buildRows(client), [client]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreate();
    } finally {
      setCreating(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span>Details that will be created in the EMR</span>
      </button>

      {expanded ? (
        <div className={styles.panel}>
          <p className={styles.summary}>These registry details will be used to create the new EMR record.</p>

          <div className={styles.tableWrap}>
            <div className={`${styles.row} ${styles.createRow} ${styles.head}`}>
              <span className={styles.colField}>Field</span>
              <span className={styles.colVal}>Client Registry</span>
            </div>
            {rows.map((r) => (
              <div key={r.label} className={`${styles.row} ${styles.createRow}`}>
                <span className={styles.colField}>{r.label}</span>
                <span className={styles.colVal}>{r.value || <span className={styles.muted}>—</span>}</span>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <Button
              kind="primary"
              size="sm"
              renderIcon={Add}
              disabled={creating}
              onClick={() => setConfirmOpen(true)}
            >
              {creating ? 'Creating…' : 'Create in EMR'}
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        size="sm"
        modalHeading="Create patient in the EMR?"
        primaryButtonText={creating ? 'Creating…' : 'Yes, create'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={creating}
        onRequestClose={() => (creating ? undefined : setConfirmOpen(false))}
        onSecondarySubmit={() => setConfirmOpen(false)}
        onRequestSubmit={handleCreate}
      >
        <p className={styles.confirmText}>A new EMR record will be created with these registry details:</p>
        <ul className={`${styles.confirmList} ${styles.confirmListCreate}`}>
          {rows.map((r) => (
            <li key={r.label}>
              <span className={styles.confirmField}>{r.label}</span>
              <span className={styles.confirmTo}>{r.value || '—'}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};

export default EmrCreatePreview;
