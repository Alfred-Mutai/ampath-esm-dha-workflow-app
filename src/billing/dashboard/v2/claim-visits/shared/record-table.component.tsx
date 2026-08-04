import React from 'react';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { DocumentBlank, View, WarningFilled } from '@carbon/react/icons';
import { launchWorkspace } from '@openmrs/esm-framework';
import { type RecordCardModel } from './record-cards.component';
import { RECORD_DETAILS_WORKSPACE } from './record-details.workspace';
import styles from './record-table.component.scss';

export interface RecordTableColumn {
  /** Column heading. */
  header: string;
  /** Take the cell from the record field carrying this label. */
  field?: string;
  /** Or take it from the record itself rather than one of its fields. */
  source?: 'title' | 'badge';
}

interface RecordTableProps {
  records: RecordCardModel[];
  /** The few fields worth a column. Everything else is left for the side panel. */
  columns: RecordTableColumn[];
  emptyMessage: string;
  /** How much the absence matters. `danger` marks a section whose emptiness is blocking
      something — a claim that can't be submitted without a diagnosis — so it reads as a
      problem to fix rather than a section that happens to be unused. */
  emptyTone?: 'neutral' | 'danger';
  ariaLabel: string;
  /** Adds a "1", "2"… column when there is more than one record. */
  numbered?: boolean;
}

const hasContent = (value: React.ReactNode): boolean =>
  !(value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0));

const cellValue = (record: RecordCardModel, column: RecordTableColumn): React.ReactNode => {
  if (column.source === 'title') {
    return record.title ?? '—';
  }
  if (column.source === 'badge') {
    return record.badge ?? '—';
  }
  const field = record.fields?.find((f) => f.label === column.field);
  return hasContent(field?.value) ? field.value : '—';
};

// The panel's own header names the record, so the title has to survive as text — a
// record title can be a node (a dash placeholder, a tag) rather than a plain string.
const panelTitle = (record: RecordCardModel, fallback: string): string => {
  const title = record.title;
  if (typeof title === 'string' && title.trim()) {
    return title;
  }
  if (typeof title === 'number') {
    return String(title);
  }
  return fallback;
};

/**
 * Renders records as a short table — a handful of columns — and opens the record itself,
 * as the card the page used to show inline, in the OpenMRS workspace: the platform's own
 * side panel.
 *
 * Takes the same `RecordCardModel` list the card grids are built from, so a claim's
 * invoices, interventions and diagnoses are described in one place (their builders) and
 * only laid out differently here.
 */
const RecordTable: React.FC<RecordTableProps> = ({
  records,
  columns,
  emptyMessage,
  emptyTone,
  ariaLabel,
  numbered,
}) => {
  if (!records || records.length === 0) {
    const blocking = emptyTone === 'danger';
    return (
      // `role="alert"` only on the blocking one: a section that is merely empty is not
      // something a screen reader should be interrupted for.
      <div
        className={blocking ? `${styles.empty} ${styles.emptyDanger}` : styles.empty}
        role={blocking ? 'alert' : undefined}
      >
        {blocking ? (
          <WarningFilled size={20} className={styles.emptyDangerIcon} />
        ) : (
          <DocumentBlank size={24} className={styles.emptyIcon} />
        )}
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const showIndex = Boolean(numbered) && records.length > 1;

  const openRecord = (record: RecordCardModel) =>
    launchWorkspace(RECORD_DETAILS_WORKSPACE, {
      record,
      // Named after the record it is showing, rather than the registration's generic
      // "Details", so the panel header says which invoice or intervention is open.
      workspaceTitle: panelTitle(record, ariaLabel),
    });

  return (
    <div className={styles.tableCard}>
      <Table size="sm" useZebraStyles aria-label={ariaLabel}>
        <TableHead>
          <TableRow>
            {showIndex ? <TableHeader className={styles.indexCol}>#</TableHeader> : null}
            {columns.map((column) => (
              <TableHeader key={column.header}>{column.header}</TableHeader>
            ))}
            <TableHeader className={styles.actionCol}>
              <span className={styles.visuallyHidden}>Details</span>
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={index} className={styles.row} onClick={() => openRecord(record)}>
              {showIndex ? <TableCell className={styles.indexCol}>{index + 1}</TableCell> : null}
              {columns.map((column) => (
                <TableCell key={column.header}>{cellValue(record, column)}</TableCell>
              ))}
              <TableCell className={styles.actionCol}>
                <Button
                  kind="ghost"
                  size="sm"
                  hasIconOnly
                  renderIcon={View}
                  iconDescription="View details"
                  tooltipPosition="left"
                  onClick={(event: React.MouseEvent) => {
                    // The row is clickable too; without this the panel would be asked to
                    // open twice for one click.
                    event.stopPropagation();
                    openRecord(record);
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default RecordTable;
