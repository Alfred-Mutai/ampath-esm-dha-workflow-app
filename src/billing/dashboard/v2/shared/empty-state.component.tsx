import React from 'react';
import { DocumentBlank } from '@carbon/react/icons';
import styles from './empty-state.component.scss';

/** Neat centred empty state for the billing tables. */
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className={styles.emptyState}>
    <DocumentBlank size={32} className={styles.emptyIcon} />
    <p className={styles.emptyText}>{message}</p>
  </div>
);

export default EmptyState;
