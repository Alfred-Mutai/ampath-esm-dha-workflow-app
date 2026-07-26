import React, { useState } from 'react';
import { type ClaimInvoiceLine } from '../../types';
import { Button, ComposedModal, ModalBody, ModalHeader } from '@carbon/react';
import { TrashCan } from '@carbon/react/icons';
import styles from './claim-invoice-line-details.component.scss';
import { formatDate, parseDate, showSnackbar, useSession } from '@openmrs/esm-framework';
import { removeClaimItem, useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import RecordCards, { YesNo, type RecordCardModel } from '../shared/record-cards.component';

interface claimLineDetailsProps {
  claimInvoiceLines: ClaimInvoiceLine[];
  consentToken: string;
  /** Removing a line edits the claim, so it is offered only while the claim is open to
      content changes. Defaults to read-only rather than assuming permission. */
  canEditLines?: boolean;
}

const money = (n: number | string) => `KES ${Number(n ?? 0).toLocaleString('en-KE')}`;

const ClaimInvoiceLineDetails: React.FC<claimLineDetailsProps> = ({
  claimInvoiceLines,
  consentToken,
  canEditLines = false,
}) => {
  const sessionLocation = useSession();
  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();
  // Line the user has asked to remove, awaiting confirmation.
  const [lineToRemove, setLineToRemove] = useState<ClaimInvoiceLine | null>(null);
  const [removing, setRemoving] = useState(false);

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

  const records: RecordCardModel[] = (claimInvoiceLines ?? []).map((ci) => ({
    tone: 'gray',
    kind: 'Line',
    title: ci.item_name,
    fields: [
      { label: 'Item code', value: ci.item_code },
      { label: 'Intervention code', value: ci.intervention_code },
      { label: 'Quantity', value: [ci.quantity, ci.unit].filter((v) => v != null && v !== '').join(' ') },
      { label: 'Unit price', value: money(ci.unit_price) },
      { label: 'Line total', value: money(ci.line_total_amount) },
      { label: 'Net', value: money(ci.line_net_amount) },
      { label: 'Discount', value: money(ci.discount) },
      { label: 'Scheme', value: ci.scheme_code },
      { label: 'Line number', value: ci.line_number },
      { label: 'Charge date', value: ci.charge_date ? formatDate(parseDate(ci.charge_date)) : '' },
      { label: 'Active', value: <YesNo value={ci.is_active} /> },
      { label: 'Cancellation', value: <YesNo value={ci.is_cancellation} /> },
      { label: 'Return', value: <YesNo value={ci.is_return} /> },
      { label: 'UHC exceeded', value: <YesNo value={ci.uhc_exceeded} /> },
    ],
    actions: canEditLines ? (
      <Button kind="danger--tertiary" size="sm" renderIcon={TrashCan} onClick={() => requestRemoveLine(ci)}>
        Remove line
      </Button>
    ) : undefined,
  }));

  return (
    <>
      <RecordCards records={records} emptyMessage="No invoice lines." numbered layout="grid" tone="gray" />
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
