import React, { useEffect, useMemo, useState } from 'react';
import { Button, ButtonSet, Form, InlineLoading, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { showSnackbar, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import styles from './bill-item-payment.workspace.scss';
import { type PatientFacilityBillDetails } from '../../../types';
import { type PaymentMode } from '../../../../../../shared/types';
import { fetchPaymentModes } from '../../../../../../shared/services/billing.resource';
import { payBillItem } from '../../../../../billing-claims.resource';

interface BillItemPaymentWorkspaceProps extends DefaultWorkspaceProps {
  billItem: PatientFacilityBillDetails;
  onPay?: () => void;
}

const BillItemPaymentWorkspace: React.FC<BillItemPaymentWorkspaceProps> = ({ billItem, onPay, closeWorkspace }) => {
  const [amountToPay, setAmountToPay] = useState<number>(0);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [selectedPaymentModeUuid, setSelectedPaymentModeUuid] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const billItemPaymentMode = useMemo(
    () => paymentModes.find((pm) => pm.name === billItem?.payment_scheme),
    [paymentModes, billItem],
  );

  useEffect(() => {
    if (billItem) {
      fetchPaymentModes().then(setPaymentModes);
    }
  }, [billItem]);

  // Either the scheme resolves its own payment mode, or the user picks one.
  const resolvedPaymentModeUuid = billItemPaymentMode?.uuid ?? selectedPaymentModeUuid;
  const canPay = !submitting && Boolean(resolvedPaymentModeUuid) && amountToPay > 0;

  async function payForBillItem(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const resp = await payBillItem(billItem.bill_uuid, {
        instanceType: resolvedPaymentModeUuid,
        amountTendered: amountToPay,
        amount: billItem.item_total_price,
      });
      if (resp) {
        showSnackbar({
          kind: 'success',
          title: 'Bill item payment succesfully made',
          subtitle: '',
        });
        onPay?.();
        closeWorkspace();
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'An error occurred while making bill item payment',
        subtitle: 'An error occurred while making bill item payment, please try again or contact support',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form className={styles.form} onSubmit={payForBillItem}>
      <div className={styles.formContent}>
        <Stack gap={5}>
          <TextInput id="bill-item" labelText="Billable item" value={billItem.billable_service ?? '—'} readOnly />
          <TextInput id="bill-item-amount" labelText="Amount" value={`Ksh ${billItem.item_total_price}`} readOnly />
          {billItemPaymentMode ? (
            <TextInput id="payment-mode" labelText="Payment mode" value={billItemPaymentMode.name} readOnly />
          ) : (
            <Select
              id="payment-mode"
              labelText="Payment mode"
              value={selectedPaymentModeUuid}
              onChange={($event) => setSelectedPaymentModeUuid($event.target.value)}
            >
              <SelectItem value="" text="Select" />
              {paymentModes.map((pm) => (
                <SelectItem key={pm.uuid} value={pm.uuid} text={pm.name} />
              ))}
            </Select>
          )}
          <TextInput
            id="pay-amount"
            labelText="Pay amount"
            type="number"
            min={0}
            value={amountToPay || ''}
            onChange={(v) => setAmountToPay(Number(v.target.value))}
          />
        </Stack>
      </div>

      <ButtonSet className={styles.buttonSet}>
        <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
          Cancel
        </Button>
        <Button className={styles.button} kind="primary" type="submit" disabled={!canPay}>
          {submitting ? <InlineLoading description="Paying..." /> : 'Pay'}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default BillItemPaymentWorkspace;
