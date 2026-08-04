import React, { useMemo } from 'react';
import { type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import RecordCards, { type RecordCardModel } from './record-cards.component';
import styles from './record-details.workspace.scss';

/** Registration name, shared with whoever opens or closes this panel. */
export const RECORD_DETAILS_WORKSPACE = 'record-details-workspace';

interface RecordDetailsWorkspaceProps extends DefaultWorkspaceProps {
  /** The record the table row stands for — the same model the row was rendered from. */
  record: RecordCardModel;
}

/**
 * Everything a record's table row left out, shown in the OpenMRS workspace — the app's
 * own right-hand panel.
 *
 * The body is the record card the page used to show inline, rendered by the same
 * component: its kind and title, every field with its label, and the collapsible region
 * (invoice lines, required documents) with its own Show/Hide toggle. Only where it is
 * shown has changed — the table row carries the few fields that tell records apart, and
 * this is the rest of it.
 *
 * The record's own actions are lifted out of the card and pinned to the foot of the
 * panel, where every other O3 workspace puts them, so they stay put and in reach however
 * far the details scroll. Actions belonging to something *inside* the record — removing
 * one invoice line — stay with the line they act on, since there is one per line and the
 * foot of the panel couldn't say which.
 */
const RecordDetailsWorkspace: React.FC<RecordDetailsWorkspaceProps> = ({ record }) => {
  // The card renders everything but the buttons; they are rendered below instead.
  const cardWithoutActions = useMemo(() => (record ? { ...record, actions: undefined } : record), [record]);

  if (!record) {
    return <p className={styles.empty}>No record to show.</p>;
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.body}>
        {/* A record that brings its own panel rendering uses it; the rest fall back to
            the card the page used to show inline. */}
        {record.panel ?? (
          <RecordCards records={[cardWithoutActions]} emptyMessage="No record to show." layout="stack" />
        )}
      </div>
      {/* A record with its own panel rendering brings its own footer with it, so the
          generic bar would be a second copy of the same buttons. */}
      {record.actions && !record.panel ? <div className={styles.actionBar}>{record.actions}</div> : null}
    </div>
  );
};

export default RecordDetailsWorkspace;
