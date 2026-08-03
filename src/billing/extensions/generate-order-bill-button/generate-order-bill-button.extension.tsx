import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InlineLoading } from '@carbon/react';
import styles from './generate-order-bill-button.scss';
import { Order } from '@openmrs/esm-patient-common-lib';

type BillStatus = 'BLANK' | 'PENDING' | 'PAID' | 'POSTED' | 'PENDING PREAUTHORIZATION' | 'NEEDS PREAUTHORIZATION' | 'AWAITING CLAIM VISIT';

interface GenerateOrderBillButtonProps {
  order: Order;
  billStatus: BillStatus;
  isLoading: boolean;
  launchBillWorkspace?: () => void
}

const GenerateOrderBillButton: React.FC<GenerateOrderBillButtonProps> = ({
  order,
  billStatus = 'BLANK',
  isLoading,
  launchBillWorkspace
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <InlineLoading />
  }

  return billStatus === 'PENDING' ? (
    <Button className={styles.actionButton} size="sm" kind="danger" key={order.uuid}>
      {t('pendingPayment', 'Pending payment')}
    </Button>
  ) : billStatus === 'NEEDS PREAUTHORIZATION' ? (
    <Button className={styles.actionButton} size="sm" kind="secondary" key={order.uuid}>
      {t('needsPreauthorization', 'Needs preauthorization')}
    </Button>
  ) : billStatus === 'PENDING PREAUTHORIZATION' ? (
    <Button className={styles.actionButton} size="sm" kind="danger--tertiary" key={order.uuid}>
      {t('pendingPreauthorization', 'Pending preauthorization')}
    </Button>
  ) : billStatus === 'AWAITING CLAIM VISIT' ? (
    <Button className={styles.actionButton} size="sm" kind="tertiary" key={order.uuid}>
      {t('awaitingClaimVisit', 'Awaiting claim visit')}
    </Button>
  ) : billStatus === 'BLANK' ? (
    <Button className={styles.actionButton} size="sm" kind="primary" key={order.uuid} onClick={launchBillWorkspace}>
      {t('generateBill', 'Generate bill')}
    </Button>
  ) : null;
};

export default GenerateOrderBillButton;