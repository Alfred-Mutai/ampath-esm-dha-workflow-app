import React, { useState } from 'react';
import { SkeletonText, Tag } from '@carbon/react';
import { ChevronDown, DocumentBlank } from '@carbon/react/icons';
import styles from './record-cards.component.scss';

/** A compact yes/no indicator for the many boolean flags on a claim record. */
export const YesNo: React.FC<{ value: boolean }> = ({ value }) => (
  <Tag size="sm" type={value ? 'green' : 'gray'}>
    {value ? 'Yes' : 'No'}
  </Tag>
);

/** Wraps a set of string values as tags, e.g. required document types. */
export const TagRow: React.FC<{ items: string[]; type?: 'green' | 'blue' | 'teal' | 'gray' }> = ({
  items,
  type = 'blue',
}) => {
  if (!items || items.length === 0) {
    return <>—</>;
  }
  return (
    <div className={styles.tagRow}>
      {items.map((item, i) => (
        <Tag size="sm" type={type} key={`${item}-${i}`}>
          {item}
        </Tag>
      ))}
    </div>
  );
};

export interface RecordField {
  label: string;
  value: React.ReactNode;
  /** Let a long value (document lists, names) span the whole card width. */
  full?: boolean;
}

export type CardTone = 'teal' | 'blue' | 'purple' | 'green' | 'amber' | 'gray';

export interface RecordCardModel {
  /** Small eyebrow above the title naming the record's kind, e.g. "Bill item". Lets
      the reader tell mixed cards apart when several kinds share one grid. */
  kind?: React.ReactNode;
  /** Left side of the card header, e.g. an intervention name. */
  title?: React.ReactNode;
  /** Right side of the card header, typically a status tag. */
  badge?: React.ReactNode;
  fields: RecordField[];
  /** Buttons rendered in a footer row, e.g. Pay / Add claim line. */
  actions?: React.ReactNode;
  /** A collapsible detail region (e.g. invoice lines) with a show/hide toggle, shown
      under the fields. Starts collapsed. */
  expandable?: {
    /** Toggle text. Pass a function to vary it by open state, e.g.
        `(open) => open ? 'Hide lines' : 'Show lines'`. */
    label: React.ReactNode | ((open: boolean) => React.ReactNode);
    content: React.ReactNode;
    /** Start expanded instead of collapsed. */
    defaultOpen?: boolean;
  };
  /** Per-card tint; overrides the grid-level `tone` so mixed kinds can share a grid. */
  tone?: CardTone;
  /**
   * A purpose-built rendering of this record for the side panel, used in place of the
   * generic card when the record has a shape the labelled-field grid reads poorly — an
   * invoice, where the money wants grouping and the lines want listing. The card grid
   * ignores it, so `fields` stays the fallback and the row columns still read from there.
   */
  panel?: React.ReactNode;
}

interface RecordCardsProps {
  records: RecordCardModel[];
  emptyMessage: string;
  /** Adds a "1", "2"… index chip to each card header when there is more than one. */
  numbered?: boolean;
  /**
   * 'stack' (default) lays cards out one under another — best for records with many
   * fields. 'grid' flows compact cards into up to three responsive columns so a short
   * list doesn't stretch the page down its full height.
   */
  layout?: 'stack' | 'grid';
  /**
   * Grid fill mode. 'fit' (default) lets cards grow to fill the row when there are only
   * a few. 'fill' keeps each card at its column width (~a third) even when there's just
   * one, so a lone card doesn't stretch across the whole row.
   */
  gridFill?: 'fit' | 'fill';
  /**
   * Maximum columns for a 'grid' layout: 2 (default) or 3. Only cards with enough room
   * reach the cap — narrow panels still step down to fewer columns.
   */
  columns?: 2 | 3;
  /** Section tint, so each section reads as its own group. Defaults to a plain tile. */
  tone?: CardTone;
}

const toneClass: Record<CardTone, string> = {
  teal: styles.toneTeal,
  blue: styles.toneBlue,
  purple: styles.tonePurple,
  green: styles.toneGreen,
  amber: styles.toneAmber,
  gray: styles.toneGray,
};

const hasContent = (value: React.ReactNode): boolean =>
  !(value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0));

/**
 * Renders a list of records as labelled tiles instead of a wide table. Each field
 * keeps its label beside its value, so nothing is lost off the right edge the way it
 * is when a 15-plus-column table scrolls horizontally.
 */
const RecordCards: React.FC<RecordCardsProps> = ({ records, emptyMessage, numbered, layout = 'stack', gridFill = 'fit', columns = 2, tone }) => {
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(records.map((r, i) => (r.expandable?.defaultOpen ? i : -1)).filter((i) => i >= 0)),
  );
  const toggleExpanded = (index: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });

  if (!records || records.length === 0) {
    return (
      <div className={styles.empty}>
        <DocumentBlank size={24} className={styles.emptyIcon} />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.cards} ${layout === 'grid' ? styles.cardsGrid : ''} ${
        layout === 'grid' && gridFill === 'fill' ? styles.cardsGridFill : ''
      } ${layout === 'grid' && columns === 3 ? styles.cardsGridThree : ''}`}
    >
      {records.map((record, index) => {
        const cardTone = record.tone ?? tone;
        const isOpen = expanded.has(index);
        return (
        <article className={`${styles.card} ${cardTone ? toneClass[cardTone] : ''}`} key={index}>
          {(record.kind || record.title || record.badge || (numbered && records.length > 1)) && (
            <header className={styles.cardHead}>
              <div className={styles.cardHeadText}>
                {record.kind && <span className={styles.cardKind}>{record.kind}</span>}
                <div className={styles.cardHeadMain}>
                  {numbered && records.length > 1 && <span className={styles.indexChip}>{index + 1}</span>}
                  {record.title && <span className={styles.cardTitle}>{record.title}</span>}
                </div>
              </div>
              {record.badge && <div className={styles.cardBadge}>{record.badge}</div>}
            </header>
          )}
          <dl className={styles.fieldGrid}>
            {record.fields.filter((f) => hasContent(f.value)).map((field, i) => (
              <div className={`${styles.field} ${field.full ? styles.fieldFull : ''}`} key={i}>
                <dt className={styles.fieldLabel}>{field.label}</dt>
                <dd className={styles.fieldValue}>{field.value}</dd>
              </div>
            ))}
          </dl>
          {record.expandable ? (
            <div className={styles.expandSection}>
              <button
                type="button"
                className={styles.expandToggle}
                aria-expanded={isOpen}
                onClick={() => toggleExpanded(index)}
              >
                <ChevronDown className={`${styles.expandChevron} ${isOpen ? styles.expandChevronOpen : ''}`} />
                {typeof record.expandable.label === 'function' ? record.expandable.label(isOpen) : record.expandable.label}
              </button>
              {isOpen ? <div className={styles.expandContent}>{record.expandable.content}</div> : null}
            </div>
          ) : null}
          {record.actions && <footer className={styles.cardActions}>{record.actions}</footer>}
        </article>
        );
      })}
    </div>
  );
};

export default RecordCards;

interface RecordCardsSkeletonProps {
  /** Placeholder cards to draw. Pick roughly what the section usually holds. */
  count?: number;
  /** Field rows per card. */
  fields?: number;
  /** Match the RecordCards call this stands in for, so the grid lines up. */
  layout?: 'stack' | 'grid';
  gridFill?: 'fit' | 'fill';
  columns?: 2 | 3;
  tone?: CardTone;
}

/**
 * Loading placeholder for a RecordCards section. It reuses the same grid, card and
 * field classes as the real thing, so the section reserves the layout it will settle
 * into instead of swapping a differently-shaped block for a card grid once loaded.
 */
export const RecordCardsSkeleton: React.FC<RecordCardsSkeletonProps> = ({
  count = 3,
  fields = 4,
  layout = 'grid',
  gridFill = 'fit',
  columns = 2,
  tone,
}) => (
  <div
    className={`${styles.cards} ${layout === 'grid' ? styles.cardsGrid : ''} ${
      layout === 'grid' && gridFill === 'fill' ? styles.cardsGridFill : ''
    } ${layout === 'grid' && columns === 3 ? styles.cardsGridThree : ''}`}
    aria-busy="true"
    aria-label="Loading records"
  >
    {Array.from({ length: count }).map((_, index) => (
      <article className={`${styles.card} ${tone ? toneClass[tone] : ''}`} key={index}>
        <header className={styles.cardHead}>
          <div className={styles.cardHeadText}>
            <span className={styles.cardKind}>
              <SkeletonText width="4rem" />
            </span>
            <div className={styles.cardHeadMain}>
              <span className={styles.cardTitle}>
                <SkeletonText width="9rem" />
              </span>
            </div>
          </div>
        </header>
        <dl className={styles.fieldGrid}>
          {Array.from({ length: fields }).map((__, field) => (
            <div className={styles.field} key={field}>
              <dt className={styles.fieldLabel}>
                <SkeletonText width="70%" />
              </dt>
              <dd className={styles.fieldValue}>
                <SkeletonText width="85%" />
              </dd>
            </div>
          ))}
        </dl>
      </article>
    ))}
  </div>
);
