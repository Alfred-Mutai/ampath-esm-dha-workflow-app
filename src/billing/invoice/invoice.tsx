// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import styles from './invoice.scss';
// import HeaderCard from './invoice-header/header-card/header-card';
// import { useParams } from 'react-router-dom';
// import {
//   ExtensionSlot,
//   formatDate,
//   navigate,
//   parseDate,
//   showSnackbar,
//   useConfig,
//   usePatient,
// } from '@openmrs/esm-framework';
// import { type PayBillDto, type Bill, type Payment } from '../types';
// import { fetchBill, payBill } from './bill.resource';
// import { Button, InlineLoading, Select, SelectItem, TextInput } from '@carbon/react';
// import { type HieBillPayment, type PaymentMode } from '../../shared/types';
// import { fetchPaymentModes } from '../../shared/services/billing.resource';
// import PaymentDetails from './payment-details/payment-details';
// import LineItems from './line-items/line-items';
// import { useReactToPrint } from 'react-to-print';
// import { Printer } from '@carbon/react/icons';
// import { t } from 'i18next';
// import PrintReceipt from './print-invoice/print-receipt.component';
// import { createClientPayment } from '../../shared/services/client-payment.resource';
// interface InvoinceProps {}
// const Invoice: React.FC<InvoinceProps> = () => {
//   const { billUuid, patientUuid } = useParams();
//   const { patient, isLoading: isLoadingPatient } = usePatient(patientUuid);
//   const [bill, setBill] = useState<Bill>();
//   const totalAmount = useMemo(() => getTotalAmount(bill), [bill]);
//   const totalTendered = useMemo(() => getTotalTendered(bill), [bill]);
//   const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
//   const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode>();
//   const [payAmount, setPayAmount] = useState<number>();
//   const [refNo, setRefNo] = useState<string>('');
//   const [loading, setLoading] = useState<boolean>(false);
//   const [isPrinting, setIsPrinting] = useState(false);
//   const onBeforeGetContentResolve = useRef<(() => void) | null>(null);
//   const componentRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (billUuid) {
//       fetchInvoiceBill(billUuid);
//       getPaymentMethods();
//     }
//   }, [billUuid]);
//   async function fetchInvoiceBill(billUuid: string) {
//     try {
//       const resp = await fetchBill(billUuid);
//       setBill(resp);
//     } catch (error) {
//       showSnackbar({
//         kind: 'error',
//         title: 'Error fetching bill',
//         subtitle: 'An error occurred while fetching the invoice bill',
//       });
//     }
//   }

//   const handleAfterPrint = useCallback(() => {
//     onBeforeGetContentResolve.current = null;
//     setIsPrinting(false);
//   }, []);

//   const handleOnBeforeGetContent = useCallback(() => {
//     return new Promise<void>((resolve) => {
//       if (patient && bill) {
//         setIsPrinting(true);
//         onBeforeGetContentResolve.current = resolve;
//       }
//     });
//   }, [bill, patient]);

//   const handlePrint = useReactToPrint({
//     contentRef: componentRef,
//     documentTitle: `Invoice ${bill?.receiptNumber} - ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0].family}`,
//     onBeforePrint: handleOnBeforeGetContent,
//     onAfterPrint: handleAfterPrint,
//     preserveAfterPrint: false,
//     onPrintError: (_, error) =>
//       showSnackbar({
//         title: t('errorPrintingInvoice', 'Error printing invoice'),
//         kind: 'error',
//         subtitle: error.message,
//       }),
//   });

//   useEffect(() => {
//     if (isPrinting && onBeforeGetContentResolve.current) {
//       onBeforeGetContentResolve.current();
//     }
//   }, [isPrinting]);

//   if (isLoadingPatient) {
//     return <></>;
//   }

//   if (!bill || !billUuid) {
//     return;
//   }
//   const refresh = () => {
//     fetchInvoiceBill(billUuid);
//   };
//   function getTotalAmount(bill: Bill) {
//     let total = 0;
//     const lineItems = bill?.lineItems ?? [];
//     for (let i = 0; i < lineItems.length; i++) {
//       total += lineItems[i].price * lineItems[i].quantity;
//     }
//     return total;
//   }
//   function getTotalTendered(bill: Bill) {
//     if (!bill || !bill.payments) {
//       return 0;
//     }
//     let total = 0;
//     const payments = bill.payments ?? [];
//     for (let i = 0; i < payments.length; i++) {
//       total += payments[i].amountTendered;
//     }
//     return total;
//   }
//   async function getPaymentMethods() {
//     const methods = await fetchPaymentModes();
//     setPaymentModes(methods);
//   }
//   const paymentMethodHandler = (selectedPaymentModeUuid: string) => {
//     const selectedPaymentMode = paymentModes.find((pm) => {
//       return pm.uuid === selectedPaymentModeUuid;
//     });
//     setSelectedPaymentMode(selectedPaymentMode);
//   };
//   const amountHandler = (amount: number) => {
//     setPayAmount(amount);
//   };
//   const refNoHandler = (refNo: string) => {
//     setRefNo(refNo);
//   };
//   const showAlert = (type: string, title: string, subTitle: string) => {
//     showSnackbar({
//       kind: type,
//       title: title,
//       subtitle: subTitle,
//     });
//   };
//   const isValidPaybillDto = (payBillDto: PayBillDto): boolean => {
//     if (!payBillDto.amount) {
//       showAlert('error', 'Missing Amount', 'Kindly add the total amount');
//       return false;
//     }
//     if (!payBillDto.amountTendered) {
//       showAlert('error', 'Missing Amount Tendered', 'Kindly add the amount tendered');
//       return false;
//     }
//     if (!payBillDto.instanceType) {
//       showAlert('error', 'Missing Payment mode', 'Kindly add the missing payment mode');
//       return false;
//     }
//     if (payAmount > totalAmount - totalTendered) {
//       showAlert('error', 'High Amount tendered value', 'The amount tendered is greater than the balance');
//       return false;
//     }
//     return true;
//   };
//   const handlePayment = async () => {
//     setLoading(true);
//     const payBillDto = generatePayBillDto();
//     if (isValidPaybillDto(payBillDto)) {
//       try {
//         const resp = await payBill(billUuid, payBillDto);
//         if (resp && resp.uuid) {
//           if (refNo) {
//             await createBillPaymentReference(resp);
//           }

//           showAlert(
//             'success',
//             'Payment succesfull',
//             `KES ${resp.amountTendered} (${resp.instanceType.name}) was succesfully paid`,
//           );

//           clearData();
//         }
//       } catch (error) {
//         showAlert(
//           'error',
//           'Error Payming Bill',
//           error.message ?? 'An error occurred while paying the bill. Kindly retry or contact support',
//         );
//       } finally {
//         setLoading(false);
//         refresh();
//       }
//     } else {
//       setLoading(false);
//     }
//   };
//   const generatePayBillDto = (): PayBillDto => {
//     return {
//       instanceType: selectedPaymentMode.uuid,
//       amountTendered: payAmount,
//       amount: totalAmount,
//     };
//   };

//   const navigateToBillingPage = () => {
//     navigate({ to: `${window.spaBase}/home/billing`, templateParams: {} });
//   };

//   async function createBillPaymentReference(payment: Payment) {
//     // save bill and  reference number to hie
//     const payload: HieBillPayment = {
//       paymentUuid: payment.uuid,
//       billUuid: billUuid,
//       referenceNo: refNo,
//     };
//     await createClientPayment(payload);
//   }

//   function clearData() {
//     setPayAmount(0);
//     setRefNo('');
//   }

//   return (
//     <>
//       <div className={styles.invoiceLayout}>
//         <div className={styles.patientHeader}>
//           {patient && patientUuid && <ExtensionSlot name="patient-header-slot" state={{ patient, patientUuid }} />}
//         </div>
//         <div className={styles.invoiceHeader}>
//           <div className={styles.invoiceTitle}>
//             <h4>Patient Invoice</h4>
//           </div>
//           {bill ? (
//             <>
//               <div className={styles.invoiceHeaderDetails}>
//                 <HeaderCard title="Total Amount" subTitle={`KES ${totalAmount}`} />
//                 <HeaderCard title="Amount Tendered" subTitle={`KES ${totalTendered}`} />
//                 <HeaderCard title="Invoice No" subTitle={bill.receiptNumber} />
//                 <HeaderCard title="Date and Time" subTitle={formatDate(parseDate(bill.dateCreated))} />
//                 <HeaderCard title="Invoice Status" subTitle={bill.status} />
//               </div>
//             </>
//           ) : (
//             <></>
//           )}
//         </div>
//         <div className={styles.printActions}>
//           <Button
//             disabled={isPrinting || isLoadingPatient || loading}
//             onClick={handlePrint}
//             renderIcon={(props) => <Printer size={24} {...props} />}
//             iconDescription={t('printBill', 'Print bill')}
//           >
//             {t('printBill', 'Print bill')}
//           </Button>
//           {(bill?.status === 'PAID' || payAmount > 0) && <PrintReceipt billUuid={bill?.uuid} />}
//         </div>
//         <div className={styles.contentSection}>
//           <div className={styles.lineItemsSection}>
//             <div className={styles.lineItemsHeader}>
//               <h5>Line Items</h5>
//             </div>
//             <div className={styles.lineItemsData}>
//               {bill && bill.lineItems ? (
//                 <>
//                   <LineItems
//                     bill={bill}
//                     lineItems={bill.lineItems.filter((res) => {
//                       return !res.voided;
//                     })}
//                     refresh={refresh}
//                   />
//                 </>
//               ) : (
//                 <></>
//               )}
//             </div>
//           </div>
//           <div className={styles.paymentSection}>
//             <div className={styles.paymentSectionHeader}>
//               <h5>Payments</h5>
//             </div>
//             <div className={styles.paymentDetails}>
//               {bill && bill.payments ? (
//                 <>
//                   <PaymentDetails payments={bill.payments} />
//                 </>
//               ) : (
//                 <></>
//               )}
//             </div>
//             <div className={styles.paymentSectionHeader}>
//               <h5>Make Payment</h5>
//             </div>
//             <div className={styles.paymentSectionContent}>
//               <div className={styles.paymentMethodSection}>
//                 <div className={styles.formRow}>
//                   <Select
//                     id="payment-method"
//                     labelText="Payment Method"
//                     onChange={($event) => paymentMethodHandler($event.target.value)}
//                   >
//                     <SelectItem value="" text="Select" />;
//                     {paymentModes &&
//                       paymentModes.map((pm) => {
//                         return <SelectItem value={pm.uuid} text={pm.name} />;
//                       })}
//                   </Select>
//                 </div>
//                 <div className={styles.formRow}>
//                   <TextInput
//                     id="amount"
//                     type="number"
//                     labelText="Amount"
//                     onChange={(e) => amountHandler(parseInt(e.target.value))}
//                   />
//                 </div>
//                 <div className={styles.formRow}>
//                   <TextInput
//                     id="reference-no"
//                     labelText="Reference Number"
//                     onChange={(e) => refNoHandler(e.target.value)}
//                   />
//                 </div>
//               </div>
//               <div className={styles.processPaymentSection}>
//                 <div>Total Amount : {totalAmount}</div>
//                 <div>Total Tendered : {totalTendered}</div>
//                 <div>Total Due : {totalAmount - totalTendered}</div>
//                 <div className={styles.actionRow}>
//                   <Button kind="secondary" onClick={navigateToBillingPage}>
//                     Discard
//                   </Button>
//                   {bill.status !== 'PAID' ? (
//                     <>
//                       <Button kind="primary" onClick={handlePayment} disabled={loading}>
//                         {loading ? (
//                           <>
//                             <InlineLoading description="Processing" />
//                           </>
//                         ) : (
//                           <>Process Payment</>
//                         )}
//                       </Button>
//                     </>
//                   ) : (
//                     <></>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// };

// export default Invoice;

import React, { useEffect, useState } from 'react';
import {
  Grid,
  Column,
  Tile,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Tag,
  Stack,
  Checkbox,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';

import { fetchBillById, processPayment, fetchPaymentModes } from '../api/billing.api';

type LineItemStatus = 'PENDING' | 'PAID' | 'CLAIMED' | 'WAIVED';

type LineItem = {
  id: string;
  service: string;
  dept: string;
  price: number;
  payerType: 'CASH' | 'SHA';
  supportsSha: boolean;
  quantity: number;
  paidQuantity?: number;
  waivedAmount?: number;
  claimedAmount?: number;
  waiverAllowed: boolean;
  status: LineItemStatus;
  paymentReference?: string;
  selected?: boolean;
};

type PaymentLog = {
  id: string;
  type: 'CASH' | 'WAIVER' | 'SHA';
  items: LineItem[];
  totalAmount: number;
  reference?: string;
  claimNumber?: string;
  timestamp: string;
};

const headers = [
  { key: 'service', header: 'Bill Item' },
  { key: 'payerType', header: 'Payer' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'price', header: 'Price' },
  { key: 'balance', header: 'Total' },
  { key: 'status', header: 'Status' },
  { key: 'select', header: 'Select' },
  { key: 'actions', header: 'Actions' },
];

const formatBillDate = (dateString?: string) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });

  if (isToday) return timeStr;
  if (isYesterday) return `Yesterday ${timeStr}`;

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
};

// Add headers for transaction logs
const logHeaders = [
  { key: 'timestamp', header: 'Timestamp' },
  { key: 'type', header: 'Type' },
  { key: 'items', header: 'Items' },
  { key: 'totalAmount', header: 'Amount' },
  { key: 'reference', header: 'Reference / Claim #' },
];

const navigateToBillingPage = () => {
  navigate({ to: `${window.spaBase}/home/billing`, templateParams: {} });
};

const getBillIdFromUrl = () => {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1];
};

const BillDetails: React.FC = () => {
  const [bill, setBill] = useState<any>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const billId = getBillIdFromUrl();

  useEffect(() => {
    async function loadBill() {
      try {
        const data = await fetchBillById(billId);

        setBill(data);

        const mappedItems: LineItem[] =
          data?.lineItems?.map((li: any) => ({
            id: li.uuid,
            service: li.billableService || 'Service',
            payerType: (li.priceName && li.priceName.toUpperCase()) || 'CASH',
            supportsSha: li.supportsSha || false,
            waiverAllowed: li.waiverAllowed || false,
            quantity: li.quantity || 1,
            price: li.price || 0,
            status: (li.paymentStatus?.toUpperCase() as LineItemStatus) || 'PENDING',
          })) || [];

        setItems(mappedItems);
      } catch (error) {
        console.error('Failed to fetch bill', error);
      } finally {
        setLoading(false);
      }
    }

    loadBill();
  }, [billId, setItems]);

  const billNumber = bill?.receiptNumber || bill?.id || '';
  const cashPoint = bill?.cashPoint?.name || '';
  const billState = bill?.status || '';
  const patientName = bill?.patient?.display || '';

  // const [items, setItems] = useState<LineItem[]>(initialItems);
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [modalType, setModalType] = useState<
    'CASH' | 'WAIVER' | 'SHA' | 'CHECK_SHA' | 'EDIT_QUANTITY' | 'CONFIRM_DELETE' | null
  >(null);
  const [reference, setReference] = useState('');
  const [waiverType, setWaiverType] = useState<'PERCENT' | 'AMOUNT'>('AMOUNT');
  const [waiverPercent, setWaiverPercent] = useState(0);
  const [waiverAmount, setWaiverAmount] = useState(0);
  const [editItem, setEditItem] = useState<LineItem | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);

  const getBalance = (i: LineItem) =>
    i.price * i.quantity - (i.paidQuantity || 0) * i.price - (i.waivedAmount || 0) - (i.claimedAmount || 0);

  const toggleSelect = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)));
  const deleteItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const addLog = (type: 'CASH' | 'WAIVER' | 'SHA', affectedItems: LineItem[], totalAmount: number) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${type}-${prev.length + 1}`,
        type,
        items: affectedItems,
        totalAmount,
        reference: type === 'CASH' ? reference : undefined,
        timestamp: new Date().toLocaleString(),
      },
    ]);
  };

  // SHA flags
  const shaOnlyBill = items.length > 0 && items.every((i) => (i.payerType || '').toUpperCase() === 'SHA');

  const pendingShaItems = items.filter((i) => i.status === 'PENDING' && i.payerType.toUpperCase() === 'SHA');

  const claimedShaItems = items.filter((i) => i.status === 'CLAIMED' && i.payerType.toUpperCase() === 'SHA');

  const hasPendingSha = pendingShaItems.length > 0;
  const hasClaimedSha = claimedShaItems.length > 0;

  // All Cash items fully paid
  const allCashSettled = items.filter((i) => i.payerType === 'CASH').every((i) => getBalance(i) === 0);

  const selectedCashItems = items.filter((i) => i.selected && i.payerType === 'CASH' && i.status === 'PENDING');

  // const totalBalance = items.reduce((acc, i) => acc + getBalance(i), 0);
  const totalPaid = items.reduce((acc, i) => {
    const payer = (i.payerType ?? '').toString().trim().toUpperCase();
    const qty = Number(i.quantity ?? 0); // <- use quantity, not paidQuantity
    const price = Number(i.price ?? 0);

    if (payer === 'CASH') {
      return acc + qty * price;
    }
    return acc;
  }, 0);

  const billTotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  const totalWaived = items.reduce((acc, i) => acc + (i.waivedAmount || 0), 0);
  const totalClaimed = items.reduce((acc, i) => {
    return i.payerType.toUpperCase() === 'SHA' ? acc + (i.claimedAmount ?? getBalance(i)) : acc;
  }, 0);

  // Balance per item: remaining amount to be settled
  const totalBalance = billTotal - (totalPaid + totalClaimed + totalWaived);

  // Auto-select SHA items
  useEffect(() => {
    setItems((prev) =>
      prev.map((i) => {
        if (shaOnlyBill) {
          return { ...i, selected: true };
        }
        if (i.status === 'PENDING' && i.payerType.toUpperCase() === 'SHA') {
          return { ...i, selected: true };
        }
        return i;
      }),
    );
  }, [shaOnlyBill, items]);

  // ----- Render Raise SHA Claim Button -----
  const showShaClaimButton = () => {
    if (shaOnlyBill) return true; // SHA-only bills can always claim
    if (hasPendingSha && allCashSettled) return true; // mixed bills: only if all cash paid
    return false;
  };

  const statusTag = (status: LineItemStatus) => {
    switch (status) {
      case 'PAID':
        return <Tag type="green">Paid (Cash)</Tag>;
      case 'CLAIMED':
        return <Tag type="blue">Claimed</Tag>;
      case 'WAIVED':
        return <Tag type="purple">Waived</Tag>;
      default:
        return <Tag type="red">Pending</Tag>;
    }
  };

  // Prepare transaction rows
  const transactionRows = logs.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    type: l.type,
    items: l.items.map((i) => i.service).join(', '),
    totalAmount: l.totalAmount,
    reference: l.reference ?? l.claimNumber ?? '-',
  }));

  const billStatus = () => {
    if (totalBalance === 0) return 'Fully Settled';
    if (totalBalance < billTotal) return 'Partially Settled';
    return '';
  };

  const processCashPayment = async () => {
    if (!reference.trim()) return alert('Payment reference required');
    if (selectedCashItems.length === 0) return alert('No items selected');

    try {
      // 1️⃣ Fetch payment modes and find Cash UUID
      const paymentModesResponse = await fetchPaymentModes();

      // Find the UUID for Cash
      const cashMode = paymentModesResponse.results.find((mode) => mode.name.toLowerCase() === 'cash');
      if (!cashMode) throw new Error('Cash payment mode not found');
      const cashUuid = cashMode.uuid;

      // 2️⃣ Prepare payload for line item payments
      const payload = {
        instanceType: cashUuid,
        amount: selectedCashItems.reduce((acc, i) => acc + getBalance(i), 0),
        amountTendered: selectedCashItems.reduce((acc, i) => acc + getBalance(i), 0),
      };

      // 3️⃣ Call payment endpoint
      const response = await processPayment(billId, payload);
      if (!response.ok) throw new Error('Payment failed');

      alert('Payment successful');

      // 4️⃣ Re-fetch bill and update local state instead of manual update
      const refreshedBill = await fetchBillById(billId);

      setBill(refreshedBill);

      const mappedItems: LineItem[] =
        refreshedBill?.lineItems?.map((li: any) => ({
          id: li.uuid,
          service: li.billableService || 'Service',
          payerType: (li.priceName && li.priceName.toUpperCase()) || 'CASH',
          supportsSha: li.supportsSha || false,
          waiverAllowed: li.waiverAllowed || false,
          quantity: li.quantity || 1,
          price: li.price || 0,
          status: (li.paymentStatus && li.paymentStatus.toUpperCase()) || 'CASH',
        })) || [];

      setItems(mappedItems);

      addLog('CASH', selectedCashItems, payload.amountTendered);

      setReference('');
      setModalType(null);
    } catch (error) {
      console.error('Payment failed', error);
      alert('Payment failed. Please try again.');
    }
  };

  const applyWaiver = async () => {
    const appliedAmount = waiverType === 'PERCENT' ? Math.round((totalBalance * waiverPercent) / 100) : waiverAmount;
    if (appliedAmount <= 0) return alert('Invalid waiver');

    return alert('Waiver functionality is currently unavailable. Please contact support.');

    // 1️⃣ Fetch payment modes and find Cash UUID
    const waiverModesResponse = await fetchPaymentModes();

    // Find the UUID for Cash
    const waiverMode = waiverModesResponse.results.find((mode) => mode.name.toLowerCase() === 'sha');
    if (!waiverMode) throw new Error('Waiver payment mode not found');
    const waiverUuid = waiverMode.uuid;

    // 2️⃣ Prepare payload for line item payments
    const payload = {
      instanceType: waiverUuid,
      amount: appliedAmount,
      amountTendered: appliedAmount,
    };

    // 3️⃣ Call payment endpoint
    const response = await processPayment(billId, payload);
    if (!response.ok) throw new Error('Payment failed');

    alert('Waiver successful');

    // 4️⃣ Re-fetch bill and update local state instead of manual update
    const refreshedBill = await fetchBillById(billId);

    setBill(refreshedBill);

    const mappedItems: LineItem[] =
      refreshedBill?.lineItems?.map((li: any) => ({
        id: li.uuid,
        service: li.billableService || 'Service',
        payerType: (li.priceName && li.priceName.toUpperCase()) || 'CASH',
        supportsSha: li.supportsSha || false,
        waiverAllowed: li.waiverAllowed || false,
        quantity: li.quantity || 1,
        price: li.price || 0,
        status: (li.paymentStatus && li.paymentStatus.toUpperCase()) || 'CASH',
      })) || [];

    setItems(mappedItems);

    addLog(
      'WAIVER',
      items.filter((i) => i.waiverAllowed),
      appliedAmount,
    );
    setWaiverAmount(0);
    setWaiverPercent(0);
    setModalType(null);
  };

  const applySHAClaim = async () => {
    try {
      // 1️⃣ Fetch payment modes and find Cash UUID
      const paymentModesResponse = await fetchPaymentModes();

      // Find the UUID for Cash
      const shaMode = paymentModesResponse.results.find((mode) => mode.name.toLowerCase() === 'sha');
      if (!shaMode) throw new Error('SHA payment mode not found');
      const shaUuid = shaMode.uuid;

      // 2️⃣ Prepare payload for line item payments
      const payload = {
        instanceType: shaUuid,
        amount: pendingShaItems.reduce((acc, i) => acc + getBalance(i), 0),
        amountTendered: pendingShaItems.reduce((acc, i) => acc + getBalance(i), 0),
      };

      // 3️⃣ Call payment endpoint
      const response = await processPayment(billId, payload);
      if (!response.ok) throw new Error('Payment failed');

      alert('Payment successful');

      // 4️⃣ Re-fetch bill and update local state instead of manual update
      const refreshedBill = await fetchBillById(billId);

      setBill(refreshedBill);

      const mappedItems: LineItem[] =
        refreshedBill?.lineItems?.map((li: any) => ({
          id: li.uuid,
          service: li.billableService || 'Service',
          payerType: (li.priceName && li.priceName.toUpperCase()) || 'CASH',
          supportsSha: li.supportsSha || false,
          waiverAllowed: li.waiverAllowed || false,
          quantity: li.quantity || 1,
          price: li.price || 0,
          status: (li.paymentStatus && li.paymentStatus.toUpperCase()) || 'CASH',
        })) || [];

      setItems(mappedItems);

      addLog('SHA', pendingShaItems, payload.amountTendered);

      setReference('');
      setModalType(null);
    } catch (error) {
      console.error('Payment failed', error);
      alert('Payment failed. Please try again.');
    }
  };

  const openEditQuantity = (item: LineItem) => {
    setEditItem(item);
    setEditQuantity(item.quantity);
    setModalType('EDIT_QUANTITY');
  };
  const saveEditQuantity = () => {
    if (!editItem) return;
    if (editQuantity < 1) return alert('Quantity must be at least 1');
    setItems((prev) => prev.map((i) => (i.id === editItem.id ? { ...i, quantity: editQuantity } : i)));
    setModalType(null);
  };

  return (
    <Grid fullWidth style={{ padding: '0' }}>
      {/* Breadcrumb & Bill Info */}
      <Column lg={16} style={{ marginTop: '1rem' }}>
        <Breadcrumb style={{ marginBottom: '1rem' }}>
          <BreadcrumbItem onClick={navigateToBillingPage}>Bills</BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>{billNumber}</BreadcrumbItem>
        </Breadcrumb>

        <Tile style={{ paddingTop: '1rem' }}>
          {/* Patient Name on Top */}
          <h5 style={{ marginBottom: '1rem' }}>{patientName}</h5>

          {/* Row with three columns */}
          <Grid fullWidth>
            <Column sm={4} md={4} lg={4}>
              <p>
                <strong>Bill No:</strong> {billNumber}
              </p>
            </Column>
            <Column sm={4} md={4} lg={4}>
              <p>
                <strong>Cash Point:</strong> {bill?.cashPoint?.name || '-'}
              </p>
            </Column>
            <Column sm={4} md={4} lg={4}>
              <p>
                <strong>Bill Date:</strong> {formatBillDate(bill?.dateCreated)}
              </p>
            </Column>
          </Grid>
        </Tile>
      </Column>

      {/* ===== Bordered Main Section ===== */}
      <Column lg={16}>
        <div
          style={{
            borderTop: '1px solid #e0e0e0',
            paddingTop: '1rem',
            marginTop: '1rem',
            background: '#fff',
          }}
        >
          <Grid fullWidth>
            {/* Left Section */}
            <Column lg={12}>
              <Tile>
                {/* Header with buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h4>
                    <u>Bill Items</u>
                  </h4>

                  <Stack orientation="horizontal" gap={2}>
                    {selectedCashItems.length > 0 && (
                      <Button size="sm" onClick={() => setModalType('CASH')}>
                        Pay Selected Cash Items
                      </Button>
                    )}

                    {totalBalance > 0 && (
                      <Button size="sm" kind="ghost" onClick={() => setModalType('WAIVER')}>
                        Apply Waiver
                      </Button>
                    )}

                    {showShaClaimButton() && (
                      <Button
                        size="sm"
                        kind="secondary"
                        onClick={() => setModalType(hasPendingSha ? 'SHA' : 'CHECK_SHA')}
                      >
                        {hasPendingSha ? 'Raise SHA Claim' : 'Check SHA Claim Status'}
                      </Button>
                    )}
                  </Stack>
                </div>

                {/* Bill Items Table */}
                <DataTable rows={items} headers={headers}>
                  {({ rows, headers, getHeaderProps, getRowProps }) => (
                    <Table>
                      <TableHead>
                        <TableRow>
                          {headers.map((h) => (
                            <TableHeader key={h.key} {...getHeaderProps({ header: h })}>
                              {h.header}
                            </TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {rows.map((row) => {
                          const i = items.find((it) => it.id === row.id)!;

                          return (
                            <TableRow key={i.id} {...getRowProps({ row })}>
                              <TableCell>{i.service}</TableCell>
                              <TableCell>{i.payerType}</TableCell>
                              <TableCell>{i.quantity}</TableCell>
                              <TableCell>Ksh {i.price}</TableCell>
                              <TableCell>Ksh {getBalance(i)}</TableCell>
                              <TableCell>
                                {i.payerType.toUpperCase() === 'SHA' && i.status.toUpperCase() === 'PAID'
                                  ? statusTag('CLAIMED')
                                  : statusTag(i.status)}
                              </TableCell>

                              <TableCell>
                                {/* {i.status === 'PENDING' && i.payerType === 'CASH' && !shaOnlyBill && (
                                  <Checkbox
                                    id={`select-${i.id}`}
                                    labelText=""
                                    checked={!!i.selected}
                                    onChange={() => toggleSelect(i.id)}
                                  />
                                )} */}

                                {i.status === 'PENDING' && (
                                  <Checkbox
                                    id={`select-${i.id}`}
                                    labelText=""
                                    checked={shaOnlyBill ? true : !!i.selected}
                                    disabled={shaOnlyBill || i.payerType !== 'CASH'}
                                    onChange={() => toggleSelect(i.id)}
                                  />
                                )}
                              </TableCell>

                              <TableCell>
                                {i.status === 'PENDING' && (
                                  <OverflowMenu ariaLabel="Actions" size="sm">
                                    <OverflowMenuItem itemText="Edit Quantity" onClick={() => openEditQuantity(i)} />
                                    <OverflowMenuItem
                                      itemText="Delete Item"
                                      onClick={() => {
                                        setEditItem(i);
                                        setModalType('CONFIRM_DELETE');
                                      }}
                                    />
                                  </OverflowMenu>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </DataTable>
              </Tile>

              {bill?.payments?.length > 0 && (
                <Tile style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '1rem' }}>
                    <u>Payment Details</u>
                  </h4>

                  <DataTable
                    rows={bill.payments.map((p: any) => ({
                      id: p.uuid,
                      type: p.instanceType?.name || '-',
                      amount: `Ksh ${p.amount}`,
                      amountTendered: `Ksh ${p.amountTendered || '-'}`,
                      dateCreated: formatBillDate(p.dateCreated),
                    }))}
                    headers={[
                      { key: 'type', header: 'Payment Type' },
                      { key: 'amount', header: 'Amount' },
                      { key: 'amountTendered', header: 'Amount Tendered' },
                      { key: 'dateCreated', header: 'Date / Time' },
                    ]}
                  >
                    {({ rows, headers, getHeaderProps, getRowProps }) => (
                      <Table>
                        <TableHead>
                          <TableRow>
                            {headers.map((h) => (
                              <TableHeader key={h.key} {...getHeaderProps({ header: h })}>
                                {h.header}
                              </TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id} {...getRowProps({ row })}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>{cell.value || '-'}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </DataTable>
                </Tile>
              )}
            </Column>

            {/* Right Summary */}
            <Column lg={4}>
              <Tile>
                <h4 style={{ paddingBottom: '1rem' }}>
                  <u>Bill Summary</u>
                </h4>

                <p>
                  <strong>Status:</strong> {billState} {billStatus() ? `(${billStatus()})` : ''}
                </p>
                <p>
                  <strong>Total:</strong> Ksh {billTotal}
                </p>
                <p>
                  <strong>Paid:</strong> Ksh {totalPaid}
                </p>
                <p>
                  <strong>Waived:</strong> Ksh {totalWaived}
                </p>
                <p>
                  <strong>Claimed:</strong> Ksh {totalClaimed}
                </p>
                <p>
                  <strong>Balance:</strong> Ksh {totalBalance}
                </p>
              </Tile>
            </Column>
          </Grid>
        </div>
      </Column>

      {/* ================= MODALS ================= */}

      {/* Cash Payment */}
      <Modal
        open={modalType === 'CASH'}
        modalHeading="Cash Payment"
        primaryButtonText="Submit"
        secondaryButtonText="Cancel"
        onRequestClose={() => setModalType(null)}
        onRequestSubmit={processCashPayment}
      >
        <div style={{ marginBottom: '1rem' }}>
          <TextInput
            id="cash-payment-ref"
            labelText="Payment Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <ul>
          {selectedCashItems.map((i) => (
            <li key={i.id} style={{ marginBottom: '0.5rem' }}>
              {i.service} - Ksh {getBalance(i)}
            </li>
          ))}
        </ul>

        <p style={{ marginTop: '1rem' }}>
          <strong>Total: Ksh {selectedCashItems.reduce((acc, i) => acc + getBalance(i), 0)}</strong>
        </p>
      </Modal>

      {/* Waiver */}
      <Modal
        open={modalType === 'WAIVER'}
        modalHeading="Apply Waiver"
        primaryButtonText="Submit"
        secondaryButtonText="Cancel"
        onRequestClose={() => setModalType(null)}
        onRequestSubmit={applyWaiver}
      >
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="waiver-type-amount">
            <input
              type="radio"
              id="waiver-type-amount"
              name="waiver-type"
              value="AMOUNT"
              checked={waiverType === 'AMOUNT'}
              onChange={() => setWaiverType('AMOUNT')}
            />{' '}
            Amount
          </label>

          <label htmlFor="waiver-type-percent" style={{ marginLeft: '1rem' }}>
            <input
              type="radio"
              id="waiver-type-percent"
              name="waiver-type"
              value="PERCENT"
              checked={waiverType === 'PERCENT'}
              onChange={() => setWaiverType('PERCENT')}
            />{' '}
            Percentage
          </label>
        </div>

        {waiverType === 'PERCENT' ? (
          <NumberInput
            id="waiver-percent"
            label="Waiver Percentage"
            min={0}
            max={100}
            value={waiverPercent}
            onChange={(_e, state) => setWaiverPercent(Number(state.value))}
          />
        ) : (
          <NumberInput
            id="waiver-amount"
            label="Waiver Amount"
            min={0}
            value={waiverAmount}
            onChange={(_e, state) => setWaiverAmount(Number(state.value))}
          />
        )}
      </Modal>

      {/* SHA Claim */}
      <Modal
        open={modalType === 'SHA'}
        modalHeading="SHA Claim"
        primaryButtonText="Submit Claim"
        secondaryButtonText="Cancel"
        onRequestClose={() => setModalType(null)}
        onRequestSubmit={applySHAClaim}
      >
        <ul>
          {pendingShaItems.map((i) => (
            <li key={i.id}>
              {i.service} - Ksh {getBalance(i)}
            </li>
          ))}
        </ul>

        <p style={{ marginTop: '1rem' }}>
          <strong>Total: Ksh {pendingShaItems.reduce((acc, i) => acc + getBalance(i), 0)}</strong>
        </p>
      </Modal>
    </Grid>
  );
};

export default BillDetails;
