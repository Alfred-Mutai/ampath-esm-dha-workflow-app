import React, { useEffect, useMemo, useState } from 'react';
import styles from './invoice.scss';
import HeaderCard from './invoice-header/header-card/header-card';
import { useParams } from 'react-router-dom';
import { formatDate, navigate, parseDate, showSnackbar, usePatient } from '@openmrs/esm-framework';
import { type PayBillDto, type Bill } from '../types';
import { fetchBill, payBill } from './bill.resource';
import { Button, InlineLoading, Select, SelectItem, TextInput } from '@carbon/react';
import { type PaymentMode } from '../../shared/types';
import { fetchPaymentModes } from '../../shared/services/billing.resource';
import PaymentDetails from './payment-details/payment-details';
import LineItems from './line-items/line-items';
interface InvoinceProps {}
const Invoice: React.FC<InvoinceProps> = () => {
  const { billUuid, patientUuid } = useParams();
  // const { patient, isLoading: isLoadingPatient } = usePatient(patientUuid);
  const [bill, setBill] = useState<Bill>();
  const totalAmount = useMemo(() => getTotalAmount(bill), [bill]);
  const totalTendered = useMemo(() => getTotalTendered(bill), [bill]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode>();
  const [payAmount, setPayAmount] = useState<number>();
  const [refNo, setRefNo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (billUuid) {
      fetchInvoiceBill(billUuid);
      getPaymentMethods();
    }
  }, [billUuid]);
  async function fetchInvoiceBill(billUuid: string) {
    try {
      const resp = await fetchBill(billUuid);
      setBill(resp);
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching bill',
        subtitle: 'An error occurred while fetching the invoice bill',
      });
    }
  }

  if (!bill || !billUuid) {
    return;
  }
  const refresh = () => {
    fetchInvoiceBill(billUuid);
  };
  function getTotalAmount(bill: Bill) {
    let total = 0;
    const lineItems = bill?.lineItems ?? [];
    for (let i = 0; i < lineItems.length; i++) {
      total += lineItems[i].price * lineItems[i].quantity;
    }
    return total;
  }
  function getTotalTendered(bill: Bill) {
    if (!bill || !bill.payments) {
      return 0;
    }
    let total = 0;
    const payments = bill.payments ?? [];
    for (let i = 0; i < payments.length; i++) {
      total += payments[i].amountTendered;
    }
    return total;
  }
  async function getPaymentMethods() {
    const methods = await fetchPaymentModes();
    setPaymentModes(methods);
  }
  const paymentMethodHandler = (selectedPaymentModeUuid: string) => {
    const selectedPaymentMode = paymentModes.find((pm) => {
      return pm.uuid === selectedPaymentModeUuid;
    });
    setSelectedPaymentMode(selectedPaymentMode);
  };
  const amountHandler = (amount: number) => {
    setPayAmount(amount);
  };
  const refNoHandler = (refNo: string) => {
    setRefNo(refNo);
  };
  const showAlert = (type: string, title: string, subTitle: string) => {
    showSnackbar({
      kind: type,
      title: title,
      subtitle: subTitle,
    });
  };
  const isValidPaybillDto = (payBillDto: PayBillDto): boolean => {
    if (!payBillDto.amount) {
      showAlert('error', 'Missing Amount', 'Kindly add the total amount');
      return false;
    }
    if (!payBillDto.amountTendered) {
      showAlert('error', 'Missing Amount Tendered', 'Kindly add the amount tendered');
      return false;
    }
    if (!payBillDto.instanceType) {
      showAlert('error', 'Missing Payment mode', 'Kindly add the missing payment mode');
      return false;
    }
    if (payAmount > totalAmount - totalTendered) {
      showAlert('error', 'High Amount tendered value', 'The amount tendered is greater than the balance');
      return false;
    }
    return true;
  };
  const handlePayment = async () => {
    setLoading(true);
    const payBillDto = generatePayBillDto();
    if (isValidPaybillDto(payBillDto)) {
      try {
        const resp = await payBill(billUuid, payBillDto);
        if (resp && resp.uuid) {
          showAlert(
            'success',
            'Payment succesfull',
            `KES ${resp.amountTendered} (${resp.instanceType.name}) was succesfully paid`,
          );
        }
      } catch (error) {
        showAlert(
          'error',
          'Error Payming Bill',
          error.message ?? 'An error occurred while paying the bill. Kindly retry or contact support',
        );
      } finally {
        setLoading(false);
        refresh();
      }
    } else {
      setLoading(false);
    }
  };
  const generatePayBillDto = (): PayBillDto => {
    return {
      instanceType: selectedPaymentMode.uuid,
      amountTendered: payAmount,
      amount: totalAmount,
    };
  };

  const navigateToBillingPage = () => {
    navigate({ to: `${window.spaBase}/home/billing`, templateParams: {} });
  };

  return (
    <>
      <div className={styles.invoiceLayout}>
        <div className={styles.invoiceHeader}>
          <div className={styles.invoiceTitle}>
            <h4>Patient Invoice</h4>
          </div>
          {bill ? (
            <>
              <div className={styles.invoiceHeaderDetails}>
                <HeaderCard title="Total Amount" subTitle={`KES ${totalAmount}`} />
                <HeaderCard title="Amount Tendered" subTitle={`KES ${totalTendered}`} />
                <HeaderCard title="Invoice No" subTitle={bill.receiptNumber} />
                <HeaderCard title="Date and Time" subTitle={formatDate(parseDate(bill.dateCreated))} />
                <HeaderCard title="Invoice Status" subTitle={bill.status} />
              </div>
            </>
          ) : (
            <></>
          )}
        </div>
        <div className={styles.contentSection}>
          <div className={styles.lineItemsSection}>
            <div className={styles.lineItemsHeader}>
              <h5>Line Items</h5>
            </div>
            <div className={styles.lineItemsData}>
              {bill && bill.lineItems ? (
                <>
                  <LineItems
                    bill={bill}
                    lineItems={bill.lineItems.filter((res) => {
                      return !res.voided;
                    })}
                    refresh={refresh}
                  />
                </>
              ) : (
                <></>
              )}
            </div>
          </div>
          <div className={styles.paymentSection}>
            <div className={styles.paymentSectionHeader}>
              <h5>Payments</h5>
            </div>
            <div className={styles.paymentDetails}>
              {bill && bill.payments ? (
                <>
                  <PaymentDetails payments={bill.payments} />
                </>
              ) : (
                <></>
              )}
            </div>
            <div className={styles.paymentSectionHeader}>
              <h5>Make Payment</h5>
            </div>
            <div className={styles.paymentSectionContent}>
              <div className={styles.paymentMethodSection}>
                <div className={styles.formRow}>
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
                <div className={styles.formRow}>
                  <TextInput
                    id="amount"
                    type="number"
                    labelText="Amount"
                    onChange={(e) => amountHandler(parseInt(e.target.value))}
                  />
                </div>
                <div className={styles.formRow}>
                  <TextInput
                    id="reference-no"
                    labelText="Reference Number"
                    onChange={(e) => refNoHandler(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.processPaymentSection}>
                <div>Total Amount : {totalAmount}</div>
                <div>Total Tendered : {totalTendered}</div>
                <div className={styles.actionRow}>
                  <Button kind="secondary" onClick={navigateToBillingPage}>
                    Discard
                  </Button>
                  {bill.status === 'PENDING' ? (
                    <>
                      <Button kind="primary" onClick={handlePayment} disabled={loading}>
                        {loading ? (
                          <>
                            <InlineLoading description="Processing" />
                          </>
                        ) : (
                          <>Process Payment</>
                        )}
                      </Button>
                    </>
                  ) : (
                    <></>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Invoice;
