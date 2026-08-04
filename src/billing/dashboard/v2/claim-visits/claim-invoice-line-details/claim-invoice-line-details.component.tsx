import React, { useState } from 'react';
import { type ClaimInvoiceLine } from '../../types';
import { Button, ComposedModal, ModalBody, ModalHeader, Tag } from '@carbon/react';
import { TrashCan } from '@carbon/react/icons';
import styles from './claim-invoice-line-details.component.scss';
import { formatDate, parseDate, showSnackbar, useSession } from '@openmrs/esm-framework';
import { removeClaimItem, useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';

interface claimLineDetailsProps {
  claimInvoiceLines: ClaimInvoiceLine[];
  consentToken: string;
  /** Removing a line edits the claim, so it is offered only while the claim is open to
      content changes. Defaults to read-only rather than assuming permission. */
  canEditLines?: boolean;
  /** Totals rendered under the lines, the way an invoice closes. */
  totals?: { label: string; value: string; strong?: boolean }[];
  /** The invoice's own date, already formatted. A line states when it was charged only
      when that differs — otherwise every line repeats the date at the top of the sheet. */
  invoiceDate?: string;
}

const money = (n: number | string) =>
  Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The flags a line carries. Only the ones that say something are shown: a line being
 * active is the norm, so it is silent, while inactive, cancelled, returned or over the
 * UHC limit each change how the line should be read.
 */
const lineFlags = (line: ClaimInvoiceLine): { label: string; type: 'red' | 'magenta' | 'gray' }[] => {
  const flags: { label: string; type: 'red' | 'magenta' | 'gray' }[] = [];
  if (!line.is_active) {
    flags.push({ label: 'Inactive', type: 'gray' });
  }
  if (line.is_cancellation) {
    flags.push({ label: 'Cancellation', type: 'red' });
  }
  if (line.is_return) {
    flags.push({ label: 'Return', type: 'magenta' });
  }
  if (line.uhc_exceeded) {
    flags.push({ label: 'UHC exceeded', type: 'red' });
  }
  return flags;
};

/**
 * The lines of an invoice, set out the way an invoice sets them out: a column each for
 * what was charged for, how many, at what price and to what amount, closing on the
 * totals those lines add up to.
 *
 * Everything that only qualifies a line — its codes, the date it was charged, the flags
 * it carries — sits under the description in small type rather than taking a column of
 * its own, so the figures stay in tidy columns that can be read down. Removing a line is
 * offered on the line itself, which is the only place it can say which line it means.
 */
const ClaimInvoiceLineDetails: React.FC<claimLineDetailsProps> = ({
  claimInvoiceLines,
  consentToken,
  canEditLines = false,
  totals,
  invoiceDate,
}) => {
  const sessionLocation = useSession();
  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();
  // Line the user has asked to remove, awaiting confirmation.
  const [lineToRemove, setLineToRemove] = useState<ClaimInvoiceLine | null>(null);
  const [removing, setRemoving] = useState(false);

  const lines = claimInvoiceLines ?? [];

  // Guarded as well as hidden: a claim that moved on mid-session shouldn't leave a
  // stale button able to open the confirmation.
  const requestRemoveLine = (line: ClaimInvoiceLine) => {
    if (!canEditLines) {
      return;
    }
    setLineToRemove(line);
  };

  const confirmRemoveClaimLine = async () => {
    if (!lineToRemove || !canEditLines) {
      return;
    }
    setRemoving(true);
    try {
      await removeClaimItem({
        consentToken,
        lineGuid: lineToRemove.id,
        locationUuid: sessionLocation?.sessionLocation?.uuid,
      });
      invalidateProviderClaimPreview();
      showSnackbar({ title: 'Success removing claim line', subtitle: 'Claim line removed successfully', kind: 'success' });
      setLineToRemove(null);
    } catch (error) {
      showSnackbar({ title: 'Error removing claim line', subtitle: error, kind: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  if (lines.length === 0) {
    return <p className={styles.empty}>No invoice lines.</p>;
  }

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.numCol}>#</th>
              <th>Description</th>
              <th className={styles.numeric}>Qty</th>
              <th className={styles.numeric}>Unit price</th>
              <th className={styles.numeric}>Amount</th>
              {canEditLines ? <th className={styles.actionCol}></th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const quantity = [line.quantity, line.unit].filter((v) => v !== null && v !== undefined && v !== '').join(' ');
              const flags = lineFlags(line);
              const codes = [line.item_code, line.intervention_code !== line.item_code ? line.intervention_code : null]
                .filter(Boolean)
                .join(' · ');
              const chargedOn = line.charge_date ? formatDate(parseDate(line.charge_date)) : '';
              // Silent when it is the invoice's own date, which the sheet already states.
              const showChargedOn = Boolean(chargedOn) && chargedOn !== (invoiceDate ?? '');
              return (
                <tr key={line.id ?? index}>
                  <td className={styles.numCol}>{index + 1}</td>
                  <td>
                    <span className={styles.lineName}>{line.item_name || line.item_code || 'Unnamed line'}</span>
                    {codes ? <span className={styles.lineSub}>{codes}</span> : null}
                    {showChargedOn ? <span className={styles.lineSub}>Charged {chargedOn}</span> : null}
                    {flags.length ? (
                      <span className={styles.lineFlags}>
                        {flags.map((flag) => (
                          <Tag size="sm" type={flag.type} key={flag.label}>
                            {flag.label}
                          </Tag>
                        ))}
                      </span>
                    ) : null}
                  </td>
                  <td className={styles.numeric}>{quantity || '—'}</td>
                  <td className={styles.numeric}>{money(line.unit_price)}</td>
                  <td className={styles.numeric}>{money(line.line_total_amount)}</td>
                  {canEditLines ? (
                    <td className={styles.actionCol}>
                      {/* Icon-only, at the end of the line it removes: unambiguous however
                          many lines there are, and it costs the row no width. */}
                      <Button
                        kind="danger--ghost"
                        size="sm"
                        hasIconOnly
                        renderIcon={TrashCan}
                        iconDescription="Remove line"
                        tooltipPosition="left"
                        onClick={() => requestRemoveLine(line)}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          {totals?.length ? (
            <tfoot>
              {totals.map((total) => (
                <tr key={total.label} className={total.strong ? styles.totalStrong : styles.totalRow}>
                  <td colSpan={3} />
                  <td className={styles.numeric}>{total.label}</td>
                  <td className={styles.numeric}>{total.value}</td>
                  {canEditLines ? <td className={styles.actionCol} /> : null}
                </tr>
              ))}
            </tfoot>
          ) : null}
        </table>
      </div>

      {lineToRemove ? (
        <ComposedModal
          open
          size="sm"
          onClose={() => {
            // Block dismissal while the removal is in flight.
            if (removing) {
              return false;
            }
            setLineToRemove(null);
          }}
        >
          <ModalHeader title="Remove claim line" />
          <ModalBody>
            <p className={styles.confirmText}>
              Are you sure you want to remove <strong>{lineToRemove.item_name || 'this line'}</strong> from the claim?
              This can’t be undone.
            </p>
            <div className={styles.confirmActions}>
              <Button kind="secondary" size="sm" disabled={removing} onClick={() => setLineToRemove(null)}>
                Cancel
              </Button>
              <Button kind="danger" size="sm" disabled={removing} onClick={confirmRemoveClaimLine}>
                {removing ? 'Removing…' : 'Remove line'}
              </Button>
            </div>
          </ModalBody>
        </ComposedModal>
      ) : null}
    </>
  );
};

export default ClaimInvoiceLineDetails;
