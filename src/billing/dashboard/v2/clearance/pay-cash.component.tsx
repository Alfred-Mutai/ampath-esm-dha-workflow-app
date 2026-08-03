import React, { useMemo, useState } from 'react';
import {
  Button,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectAll,
  TableSelectRow,
  Tile,
} from '@carbon/react';

import { closeWorkspace } from '@openmrs/esm-framework';
import { type PendingLineItem } from '../types';

import styles from './pay-cash.scss';

interface PayCashComponentProps {
  lineItems?: PendingLineItem[];
}

const PayCashComponent: React.FC<PayCashComponentProps> = ({ lineItems = [] }) => {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [amountTendered, setAmountTendered] = useState(0);

  const toggleRow = (index: number) => {
    setSelectedRows((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const toggleAllRows = () => {
    if (selectedRows.length === lineItems.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(lineItems.map((_, index) => index));
    }
  };

  const selectedLineItems = useMemo(() => selectedRows.map((index) => lineItems[index]), [selectedRows, lineItems]);

  const totalAmount = useMemo(
    () => selectedLineItems.reduce((sum, item) => sum + (item?.quantity ?? 0) * (item?.price ?? 0), 0),
    [selectedLineItems],
  );

  const amountDue = totalAmount;

  const hasSelection = selectedRows.length > 0;

  const onCancel = () => {
    closeWorkspace('pay-cash-workspace', { ignoreChanges: true });
  };

  const exceedsAmountDue = amountTendered > amountDue;
  const hasValidAmount = hasSelection && amountTendered > 0 && amountTendered <= amountDue;

  const onProcessPayment = () => {
    if (!hasValidAmount) {
      return;
    }
  };

  return (
    <div>
      <Table aria-label="Pending cash bill items" size="sm">
        <TableHead>
          <TableRow>
            <TableSelectAll
              id="select-all-bill-items"
              name="select-all-bill-items"
              checked={lineItems.length > 0 && selectedRows.length === lineItems.length}
              indeterminate={selectedRows.length > 0 && selectedRows.length < lineItems.length}
              onSelect={toggleAllRows}
            />

            <TableHeader>Index</TableHeader>
            <TableHeader>Bill Item</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Quantity</TableHeader>
            <TableHeader>Price</TableHeader>
            <TableHeader>Total</TableHeader>
          </TableRow>
        </TableHead>

        <TableBody>
          {lineItems.map((item, index) => {
            const rowTotal = (item.quantity ?? 0) * (item.price ?? 0);

            return (
              <TableRow key={index}>
                <TableSelectRow
                  id={`bill-item-${index}`}
                  name={`bill-item-${index}`}
                  checked={selectedRows.includes(index)}
                  onSelect={() => toggleRow(index)}
                />

                <TableCell>{index + 1}</TableCell>
                <TableCell>{item.billable_service}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>{item.quantity ?? 0}</TableCell>
                <TableCell>{item.price ?? 0}</TableCell>
                <TableCell>{rowTotal}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {hasSelection && (
        <Tile className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span>Total Amount</span>
            <strong>
              KES{' '}
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>

          <div className={styles.summaryRow}>
            <span>Amount Due</span>
            <strong>
              KES{' '}
              {amountDue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>

          <div className={styles.actions}>
            <Button kind="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>

            <Button kind="primary" size="sm" disabled={!hasSelection} onClick={onProcessPayment}>
              Process Payment
            </Button>
          </div>
        </Tile>
      )}

      {exceedsAmountDue && (
        <InlineNotification
          kind="error"
          lowContrast
          title="Invalid amount"
          subtitle="Amount tendered cannot be greater than the amount due."
        />
      )}
    </div>
  );
};

export default PayCashComponent;
