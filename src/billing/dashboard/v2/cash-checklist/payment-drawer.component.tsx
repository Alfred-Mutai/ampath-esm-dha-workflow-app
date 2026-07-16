import React, { useState } from 'react';
import { Button, Dropdown, NumberInput, TextInput } from '@carbon/react';
import { Close } from '@carbon/react/icons';
import styles from './payment-drawer.component.scss';
import { itemBalance, type BillLineItem, type BillSource, type PayInput, type PaymentMethod } from './cash-checklist.resource';

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

interface PaymentDrawerProps {
  item: BillLineItem;
  source: BillSource;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (input: PayInput) => void;
}

/** Side drawer to record a payment against a bill line item. Defaults to M-Pesa
 *  (reference entered manually pre-integration); SHA copays may also settle via SHA. */
const PaymentDrawer: React.FC<PaymentDrawerProps> = ({ item, source, busy, onClose, onSubmit }) => {
  const balance = itemBalance(item);
  const methods: PaymentMethod[] = source === 'SHA_COPAY' ? ['M-Pesa', 'SHA'] : ['M-Pesa'];
  const [method, setMethod] = useState<PaymentMethod>('M-Pesa');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState<number>(balance);
  const [refError, setRefError] = useState('');
  const [amtError, setAmtError] = useState('');

  const amountValid = amount > 0 && amount <= balance;
  const refValid = method !== 'M-Pesa' || reference.trim().length > 0;
  const canSubmit = amountValid && refValid && !busy;
  const newBalance = Math.max(0, balance - (amountValid ? amount : 0));

  const handleAmount = (value: string | number) => {
    const v = Number(value) || 0;
    setAmount(v);
    if (v <= 0) {
      setAmtError('Enter an amount to pay.');
    } else if (v > balance) {
      setAmtError(`Amount cannot exceed the balance of ${money(balance)}.`);
    } else {
      setAmtError('');
    }
  };

  const submit = () => {
    if (!amountValid) {
      setAmtError(amount <= 0 ? 'Enter an amount to pay.' : `Amount cannot exceed the balance of ${money(balance)}.`);
    }
    if (!refValid) {
      setRefError('Enter the M-Pesa reference number.');
    }
    if (!amountValid || !refValid) {
      return;
    }
    onSubmit({ amount, method, reference: method === 'M-Pesa' ? reference.trim() : undefined });
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Record payment">
        <header className={styles.header}>
          <div>
            <h5 className={styles.title}>Record payment</h5>
            <span className={styles.subtitle}>{item.service}</span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <Close size={20} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Amount</span>
              <span className={styles.summaryValue}>{money(item.amount)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Paid</span>
              <span className={styles.summaryValue}>{money(item.paidAmount)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Balance</span>
              <span className={`${styles.summaryValue} ${styles.summaryBalance}`}>{money(balance)}</span>
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.sectionLabel}>Payment</div>
            {methods.length > 1 ? (
              <Dropdown
                id="pay-method"
                titleText="Payment method"
                label="Select method"
                items={methods}
                selectedItem={method}
                onChange={({ selectedItem }) => {
                  setMethod((selectedItem as PaymentMethod) ?? 'M-Pesa');
                  setRefError('');
                }}
              />
            ) : (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Payment method</span>
                <div className={styles.methodCard}>
                  <span className={styles.methodDot} />
                  <span className={styles.methodCardText}>M-Pesa</span>
                  <span className={styles.methodCardSub}>Mobile money</span>
                </div>
              </div>
            )}

            {method === 'M-Pesa' ? (
              <TextInput
                id="mpesa-ref"
                labelText={
                  <span>
                    M-Pesa reference number<span className={styles.required}>*</span>
                  </span>
                }
                placeholder="e.g. SGH7X1K2QP"
                value={reference}
                invalid={!!refError}
                invalidText={refError}
                onFocus={() => {
                  if (!reference.trim()) {
                    setRefError('M-Pesa reference number is required.');
                  }
                }}
                onChange={(e) => {
                  setReference(e.target.value);
                  setRefError(e.target.value.trim() ? '' : 'M-Pesa reference number is required.');
                }}
              />
            ) : (
              <p className={styles.methodNote}>Settled against the patient&apos;s SHA cover.</p>
            )}

            <NumberInput
              id="pay-amount"
              label={
                <span>
                  Amount to pay (KES)<span className={styles.required}>*</span>
                </span>
              }
              helperText={`Up to the balance of ${money(balance)}`}
              min={0}
              max={balance}
              value={amount}
              invalid={!!amtError}
              invalidText={amtError}
              onFocus={() => {
                if (!amount || amount <= 0) {
                  setAmtError('Amount to pay is required.');
                }
              }}
              onChange={(_e, { value }) => handleAmount(value)}
            />

            <hr className={styles.divider} />

            <div className={`${styles.newBalance} ${newBalance > 0 ? styles.newBalanceDue : styles.newBalanceClear}`}>
              <span>{newBalance > 0 ? 'Balance after payment' : 'Fully paid after payment'}</span>
              <span className={styles.newBalanceValue}>{money(newBalance)}</span>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" disabled={!canSubmit} onClick={submit}>
            {busy ? 'Recording…' : 'Record payment'}
          </Button>
        </footer>
      </aside>
    </>
  );
};

export default PaymentDrawer;
