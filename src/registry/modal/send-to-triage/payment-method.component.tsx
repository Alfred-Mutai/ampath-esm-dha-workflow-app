import { Select, SelectItem } from '@carbon/react';
import React from 'react';

import styles from './send-to-triage.modal.scss';
import { type ServicePrice } from '../../../shared/types';

interface PaymentMethodComponentProps {
  paymentMethodHandler: (value: string) => void;
  paymentModes: { uuid: string; name: string }[];
  billableServicesHandler: (value: string) => void;
  filteredBillableServices: ServicePrice[] | null;
}

const PaymentMethodComponent: React.FC<PaymentMethodComponentProps> = ({
  paymentMethodHandler,
  paymentModes,
  billableServicesHandler,
  filteredBillableServices,
}) => {
  return (
    <>
      <div className={styles.formRow}>
        <div className={styles.formControl}>
          <Select
            id="payment-method"
            labelText="Payment Method"
            onChange={($event) => paymentMethodHandler($event.target.value)}
          >
            <SelectItem value="" text="Select" />;
            {paymentModes &&
              paymentModes.map((pm) => {
                return <SelectItem value={pm.uuid} text={pm.name} />;
              })}
          </Select>
        </div>
        <div className={styles.formControl}>
          <Select
            id="billable-service"
            labelText="Billable Services"
            onChange={($event) => billableServicesHandler($event.target.value)}
          >
            <SelectItem value="" text="Select" />;
            {filteredBillableServices &&
              filteredBillableServices.map((sp) => {
                return <SelectItem value={sp.uuid} text={`${sp.billableService.display}(${sp.name}:${sp.price})`} />;
              })}
          </Select>
        </div>
      </div>
    </>
  );
};

export default PaymentMethodComponent;
