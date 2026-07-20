import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, InlineLoading, Modal } from '@carbon/react';
import { CheckmarkFilled, ChevronDown, ChevronUp, Renew, WarningAltFilled } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import { type HieClient } from '../types';
import {
  type EmrFieldKey,
  type EmrPersonDetails,
  type EmrUpdateValues,
  fetchEmrPersonDetails,
  updateEmrPersonFields,
} from './emr-compare.resource';
import styles from './emr-compare.component.scss';

interface EmrCompareProps {
  client: HieClient;
  patientUuid: string;
  /** Called after a successful write so the parent can refresh its EMR lookup. */
  onUpdated?: () => void;
}

interface Row {
  key: EmrFieldKey;
  label: string;
  cr: string;
  emr: string;
}

const norm = (v: unknown) => (v == null ? '' : String(v).trim());
const fmtDate = (d: string) => (d ? String(d).slice(0, 10) : '');
const genderDisplay = (g: string) => (g === 'M' ? 'Male' : g === 'F' ? 'Female' : g || '');

function buildRows(client: HieClient, emr: EmrPersonDetails): Row[] {
  return [
    { key: 'givenName', label: 'First name', cr: norm(client.first_name), emr: norm(emr.givenName) },
    { key: 'middleName', label: 'Middle name', cr: norm(client.middle_name), emr: norm(emr.middleName) },
    { key: 'familyName', label: 'Last name', cr: norm(client.last_name), emr: norm(emr.familyName) },
    { key: 'gender', label: 'Gender', cr: norm(client.gender), emr: genderDisplay(emr.gender) },
    { key: 'birthdate', label: 'Date of birth', cr: fmtDate(client.date_of_birth), emr: fmtDate(emr.birthdate) },
    { key: 'phone', label: 'Phone', cr: norm(client.phone), emr: norm(emr.phone.value) },
    { key: 'email', label: 'Email', cr: norm(client.email), emr: norm(emr.email.value) },
    { key: 'county', label: 'County', cr: norm(client.county), emr: norm(emr.county) },
    { key: 'subCounty', label: 'Sub-county', cr: norm(client.sub_county), emr: norm(emr.subCounty) },
    { key: 'ward', label: 'Ward', cr: norm(client.ward), emr: norm(emr.ward) },
    { key: 'village', label: 'Village', cr: norm(client.village_estate), emr: norm(emr.village) },
  ];
}

function buildValues(client: HieClient): EmrUpdateValues {
  return {
    givenName: norm(client.first_name),
    middleName: norm(client.middle_name),
    familyName: norm(client.last_name),
    gender: client.gender === 'Male' ? 'M' : 'F',
    birthdate: client.date_of_birth,
    phone: norm(client.phone),
    email: norm(client.email),
    county: norm(client.county),
    subCounty: norm(client.sub_county),
    ward: norm(client.ward),
    village: norm(client.village_estate),
  };
}

// A field differs (and can be pushed) when the registry has a value that isn't
// already the same in the EMR.
const differs = (row: Row) => row.cr !== '' && row.cr.toLowerCase() !== row.emr.toLowerCase();

const EmrCompare: React.FC<EmrCompareProps> = ({ client, patientUuid, onUpdated }) => {
  const [expanded, setExpanded] = useState(false);
  const [emr, setEmr] = useState<EmrPersonDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<EmrFieldKey>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Guards the on-load auto-update so it runs once per patient (never in a loop).
  const autoAppliedFor = useRef<string | null>(null);

  // Push the fields that differ into the EMR straight away, then re-read so the
  // panel reflects the synced values. On failure, keep the fetched EMR and
  // pre-select the diffs so the user can retry from the (collapsed) panel.
  const applyAutoUpdate = async (emrDetails: EmrPersonDetails) => {
    const diffKeys = buildRows(client, emrDetails).filter(differs).map((r) => r.key);
    if (diffKeys.length === 0) {
      setEmr(emrDetails);
      setSelected(new Set());
      return;
    }
    try {
      await updateEmrPersonFields(emrDetails, diffKeys, buildValues(client));
      showSnackbar({
        kind: 'success',
        title: 'EMR updated from registry',
        subtitle: `${diffKeys.length} field${diffKeys.length === 1 ? '' : 's'} auto-updated from the Client Registry.`,
      });
      onUpdated?.();
      const fresh = await fetchEmrPersonDetails(patientUuid);
      setEmr(fresh);
      setSelected(new Set());
    } catch {
      showSnackbar({
        kind: 'error',
        title: 'Auto-update failed',
        subtitle: 'Could not update the EMR record. Expand to review and retry.',
      });
      setEmr(emrDetails);
      setSelected(new Set(diffKeys));
    }
  };

  const load = () => {
    setLoading(true);
    setError(false);
    fetchEmrPersonDetails(patientUuid)
      .then((d) => applyAutoUpdate(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  // Fetch the EMR person on mount (regardless of the panel being collapsed) and
  // auto-update the differing fields once per patient.
  useEffect(() => {
    if (!patientUuid || autoAppliedFor.current === patientUuid) {
      return;
    }
    autoAppliedFor.current = patientUuid;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUuid]);

  const rows = useMemo(() => (emr ? buildRows(client, emr) : []), [client, emr]);
  const diffRows = rows.filter(differs);

  const toggle = (key: EmrFieldKey, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleUpdate = async () => {
    if (!emr || selected.size === 0) {
      return;
    }
    setSubmitting(true);
    try {
      await updateEmrPersonFields(emr, [...selected], buildValues(client));
      showSnackbar({
        kind: 'success',
        title: 'EMR updated',
        subtitle: `${selected.size} field${selected.size === 1 ? '' : 's'} updated from the registry.`,
      });
      onUpdated?.();
      // Re-read so the panel reflects the new EMR values (updated rows stop showing a diff).
      const fresh = await fetchEmrPersonDetails(patientUuid);
      setEmr(fresh);
      setSelected(new Set(buildRows(client, fresh).filter(differs).map((r) => r.key)));
    } catch {
      showSnackbar({
        kind: 'error',
        title: 'Update failed',
        subtitle: 'Could not update the EMR record. Please retry.',
      });
    } finally {
      setSubmitting(false);
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
        <span>Compare with registry &amp; choose what to update</span>
        {emr && diffRows.length > 0 ? <span className={styles.diffBadge}>{diffRows.length}</span> : null}
      </button>

      {expanded ? (
        <div className={styles.panel}>
          {loading ? (
            <InlineLoading description="Loading EMR record…" />
          ) : error ? (
            <div className={styles.error}>
              <WarningAltFilled size={16} />
              <span>Couldn&apos;t load the EMR record.</span>
              <Button kind="ghost" size="sm" onClick={load}>
                Retry
              </Button>
            </div>
          ) : emr ? (
            <>
              <p className={styles.summary}>
                {diffRows.length === 0
                  ? 'The EMR already matches the registry for these fields.'
                  : `${diffRows.length} field${diffRows.length === 1 ? '' : 's'} differ from the registry — tick the ones to copy into the EMR.`}
              </p>

              <div className={styles.tableWrap}>
                <div className={`${styles.row} ${styles.head}`}>
                  <span className={styles.colField}>Field</span>
                  <span className={styles.colVal}>Client Registry</span>
                  <span className={styles.colVal}>EMR</span>
                  <span className={styles.colPick}>Update</span>
                </div>
                {rows.map((r) => {
                  const changed = differs(r);
                  const isSelected = selected.has(r.key);
                  // Emphasise differences that are NOT being applied (unresolved),
                  // calm the ones being updated, mute the ones already matching.
                  const rowClass = !changed
                    ? styles.rowSame
                    : isSelected
                      ? styles.rowSelected
                      : styles.rowUnresolved;
                  return (
                    <div key={r.key} className={`${styles.row} ${rowClass}`}>
                      <span className={styles.colField}>{r.label}</span>
                      <span className={styles.colVal}>{r.cr || <span className={styles.muted}>—</span>}</span>
                      <span className={styles.colVal}>{r.emr || <span className={styles.muted}>—</span>}</span>
                      <span className={styles.colPick}>
                        {changed ? (
                          <Checkbox
                            id={`emr-pick-${r.key}`}
                            labelText=""
                            hideLabel
                            checked={isSelected}
                            onChange={(_e, { checked }) => toggle(r.key, checked)}
                          />
                        ) : (
                          <span className={styles.same}>
                            <CheckmarkFilled size={14} /> Same
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action sits at the bottom, once the variances have been reviewed. */}
              {diffRows.length > 0 ? (
                <div className={styles.actions}>
                  <Button
                    kind="primary"
                    size="sm"
                    renderIcon={Renew}
                    disabled={submitting || selected.size === 0}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {submitting ? 'Updating…' : `Update ${selected.size} selected in EMR`}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        size="sm"
        modalHeading="Update EMR record?"
        primaryButtonText={submitting ? 'Updating…' : 'Yes, update'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={submitting || selected.size === 0}
        onRequestClose={() => (submitting ? undefined : setConfirmOpen(false))}
        onSecondarySubmit={() => setConfirmOpen(false)}
        onRequestSubmit={handleUpdate}
      >
        <p className={styles.confirmText}>
          {selected.size} field{selected.size === 1 ? '' : 's'} will be overwritten in the EMR with the Client Registry
          values:
        </p>
        <ul className={styles.confirmList}>
          {rows
            .filter((r) => selected.has(r.key))
            .map((r) => (
              <li key={r.key}>
                <span className={styles.confirmField}>{r.label}</span>
                <span className={styles.confirmFrom}>{r.emr || '—'}</span>
                <span className={styles.confirmArrow}>→</span>
                <span className={styles.confirmTo}>{r.cr || '—'}</span>
              </li>
            ))}
        </ul>
      </Modal>
    </div>
  );
};

export default EmrCompare;
