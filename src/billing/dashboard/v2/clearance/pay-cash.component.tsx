import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from '@carbon/react';
import React, { useMemo } from 'react';
import { type PendingLineItem } from '../types';

import styles from './pay-cash.scss';
import { closeWorkspace } from '@openmrs/esm-framework';

interface PayCashComponentProps {
  lineItems: PendingLineItem[];
}

const PayCashComponent: React.FC<PayCashComponentProps> = ({ lineItems }) => {
  const totalAmount = useMemo(() => lineItems.reduce((sum, item) => sum + item.quantity * item.price, 0), [lineItems]);

  const amountDue = totalAmount;

  const onCancel = () => {
    closeWorkspace('pay-cash-workspace', { ignoreChanges: true });
  };

  const onProcessPayment = () => {};
  return (
    <>
      <div>
        <Table aria-label="sample table" size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Index</TableHeader>
              <TableHeader>Bill Item</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Quantity</TableHeader>
              <TableHeader>Price</TableHeader>
              <TableHeader>Total</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{item.billable_service}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.price}</TableCell>
                <TableCell>{item.quantity * item.price}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

            <Button kind="primary" size="sm" onClick={onProcessPayment}>
              Process Payment
            </Button>
          </div>
        </Tile>
      </div>
    </>
  );
};

export default PayCashComponent;
