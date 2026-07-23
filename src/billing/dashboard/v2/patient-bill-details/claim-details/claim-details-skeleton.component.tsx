import React from 'react';
import { SkeletonText } from '@carbon/react';
import styles from './claim-details-skeleton.component.scss';

/**
 * Loading placeholder shaped like the real claim details — header tags, the summary
 * grid, and a couple of record-card sections — so the section fills in place instead
 * of collapsing to a single spinner line.
 */
const ClaimDetailsSkeleton: React.FC = () => (
  <div className={styles.skeleton} aria-label="Loading claim details" aria-busy="true">
    {/* Header: State / Status / Scheme meta */}
    <div className={styles.header}>
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className={styles.pill} />
      ))}
    </div>

    {/* Summary grid */}
    <div className={styles.summary}>
      <div className={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div className={styles.field} key={i}>
            <SkeletonText width="45%" />
            <SkeletonText width="75%" />
          </div>
        ))}
      </div>
    </div>

    {/* Two record-card sections */}
    {Array.from({ length: 2 }).map((_, s) => (
      <div className={styles.section} key={s}>
        <SkeletonText className={styles.sectionTitle} width="9rem" />
        <div className={styles.cardsRow}>
          {Array.from({ length: 2 }).map((_, c) => (
            <div className={styles.card} key={c}>
              <SkeletonText width="65%" />
              {Array.from({ length: 4 }).map((__, r) => (
                <div className={styles.cardRow} key={r}>
                  <SkeletonText width="35%" />
                  <SkeletonText width="30%" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default ClaimDetailsSkeleton;
