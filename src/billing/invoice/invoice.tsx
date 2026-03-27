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
  SkeletonText,
  SkeletonPlaceholder,
} from '@carbon/react';
import { navigate, showSnackbar } from '@openmrs/esm-framework';

import {
  Receipt,
  DocumentAdd,
  Subtract,
  Money,
  View,
  CheckmarkFilled,
  WarningAlt,
  PendingFilled,
} from '@carbon/react/icons';
import {
  fetchBillById,
  processPayment,
  fetchPaymentModes,
  checkClaimStatus,
  raiseSHAClaim,
  UpdateBillItemStatus,
} from '../api/billing.api';
import EligibilityTags from '../../registry/eligibility/eliigibility-tags/eligibility-tags';

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

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
};

const formatCurrency = (value: number) => `Ksh ${value.toLocaleString()}`;

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

  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [modalType, setModalType] = useState<
    'CASH' | 'WAIVER' | 'SHA' | 'CHECK_SHA' | 'EDIT_QUANTITY' | 'CONFIRM_DELETE' | null
  >(null);
  const [reference, setReference] = useState('');
  const [waiverType, setWaiverType] = useState<'PERCENT' | 'AMOUNT'>('AMOUNT');

  const [waiverPercent, setWaiverPercent] = useState('');
  const [waiverAmount, setWaiverAmount] = useState('');
  const [editItem, setEditItem] = useState<LineItem | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);

  const [claimResponse, setClaimResponse] = useState<any | null>(null);
  const [checkingClaim, setCheckingClaim] = useState(false);

  const percent = Number(waiverPercent || 0);
  const amount = Number(waiverAmount || 0);

  useEffect(() => {
    setWaiverPercent('');
    setWaiverAmount('');
  }, [waiverType]);

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

  const hasPendingSha = pendingShaItems.length > 0;

  const isSha = (i: LineItem) => (i.payerType ?? '').toUpperCase() === 'SHA';
  const status = (i: LineItem) => (i.status ?? '').toUpperCase();

  const claimedShaItems = items.filter((i) => isSha(i) && ['CLAIMED', 'PAID'].includes(status(i)));

  const hasClaimedSha = claimedShaItems.length > 0;

  // All Cash items fully paid
  const allCashSettled = items
    .filter((i) => (i.payerType ?? '').toUpperCase() === 'CASH')
    .every((i) => (i.status ?? '').toUpperCase() === 'PAID');

  const selectedCashItems = items.filter((i) => i.selected && i.payerType === 'CASH' && i.status === 'PENDING');

  // const totalBalance = items.reduce((acc, i) => acc + getBalance(i), 0);
  const totalPaid = items.reduce((acc, i) => {
    const payer = (i.payerType ?? '').toString().trim().toUpperCase();
    const status = (i.status ?? '').toString().trim().toUpperCase();
    const qty = Number(i.quantity ?? 0);
    const price = Number(i.price ?? 0);

    if (payer === 'CASH' && status === 'PAID') {
      return acc + qty * price;
    }

    return acc;
  }, 0);

  const billTotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const totalWaived = items.reduce((acc, i) => acc + (i.waivedAmount || 0), 0);

  const totalClaimed = items.reduce((acc, i) => {
    const payer = (i.payerType ?? '').toUpperCase();
    const status = (i.status ?? '').toUpperCase();

    if (payer === 'SHA' && (status === 'CLAIMED' || status === 'PAID')) {
      return acc + (i.claimedAmount ?? i.price * i.quantity);
    }

    return acc;
  }, 0);

  const showAlert = (type: string, title: string, subTitle: string) => {
    showSnackbar({
      kind: type,
      title: title,
      subtitle: subTitle,
    });
  };

  // Balance per item: remaining amount to be settled
  const totalBalance = billTotal - (totalPaid + totalClaimed + totalWaived);

  // Auto-select SHA items
  useEffect(() => {
    setItems((prev) => {
      if (prev.length === 0) return prev;

      return prev.map((i) => {
        if (shaOnlyBill) return { ...i, selected: true };

        if (i.status === 'PENDING' && i.payerType.toUpperCase() === 'SHA') {
          return { ...i, selected: true };
        }

        return i;
      });
    });
  }, [shaOnlyBill]);

  const crId =
    bill?.patient?.identifiers?.find((id: any) => id.identifierType?.display?.toLowerCase().includes('cr'))
      ?.identifier || '';

  const locationUuid = bill?.cashPoint?.location?.uuid || '';

  // ----- Render Raise SHA Claim Button -----
  const showShaClaimButton = () => {
    // Show Raise Claim if pending SHA exists
    if (hasPendingSha && (shaOnlyBill || allCashSettled)) {
      return 'RAISE';
    }

    // Show Check Status if all SHA items are already claimed/paid
    if (!hasPendingSha && hasClaimedSha) {
      return 'STATUS';
    }

    return null;
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
    return 'Unpaid';
  };

  const processCashPayment = async () => {
    if (!reference.trim()) return showAlert('error', 'Cash Payment', 'Payment reference required');

    if (selectedCashItems.length === 0) showAlert('error', 'Cash Payment', 'No items selected');

    try {
      setCashLoading(true);
      // 1️⃣ Fetch payment modes and find Cash UUID
      const paymentModesResponse = await fetchPaymentModes();

      // Find the UUID for Cash
      const cashMode = paymentModesResponse.results.find((mode) => mode.name.toLowerCase() === 'cash');
      if (!cashMode) {
        setCashLoading(false);
        showAlert('error', 'Cash Payment', 'Cash payment mode not found');
        return;
      }
      const cashUuid = cashMode.uuid;

      // 2️⃣ Prepare payload for line item payments
      const payload = {
        instanceType: cashUuid,
        amount: selectedCashItems.reduce((acc, i) => acc + getBalance(i), 0),
        amountTendered: selectedCashItems.reduce((acc, i) => acc + getBalance(i), 0),
      };

      // 3️⃣ Call payment endpoint
      const response = await processPayment(billId, payload);
      if (!response.ok) {
        setCashLoading(false);
        showAlert('error', 'Cash Payment', 'Payment processing failed');
        return;
      }

      const statusPayload = {
        billUuid: billId,
        cashModeUuid: cashUuid,
        billItemsUuid: selectedCashItems.map((item) => item.id),
      };

      const statusResponse = await UpdateBillItemStatus(statusPayload);
      if (!statusResponse?.success) {
        setCashLoading(false);
        showAlert('error', 'Cash Payment', statusResponse?.message ?? 'Status update failed');
        return;
      }

      showAlert('success', 'Cash Payment', 'Payment processed successfully');

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
      setCashLoading(false);
    } catch (error) {
      console.error('Payment failed', error);
      setCashLoading(false);
      showAlert('error', 'Cash Payment', 'Payment failed. Please try again.');
    }
  };

  const handleCheckSHAClaim = async () => {
    if (!billId) return showSnackbar({ kind: 'error', title: 'SHA Claim Status', subtitle: 'Bill ID is required' });

    setCheckingClaim(true);

    const res = await checkClaimStatus(billId);

    if (!res.success) {
      setCheckingClaim(false);
      return showSnackbar({
        kind: 'error',
        title: 'SHA Claim Status',
        subtitle: res.message,
      });
    }

    setClaimResponse(res.data);
    setModalType('CHECK_SHA');
    setCheckingClaim(false);
  };

  const applyWaiver = async () => {
    return showAlert(
      'error',
      'Waiver Application',
      'Waiver functionality is currently unavailable. Please contact support.',
    );

    setWaiverLoading(true);

    const appliedAmount = waiverType === 'PERCENT' ? Math.round((totalBalance * percent) / 100) : waiverAmount;
    if (amount <= 0) return;
    showAlert('error', 'Waiver Application', 'Waiver amount must be greater than zero');

    // 1️⃣ Fetch payment modes and find Cash UUID
    const waiverModesResponse = await fetchPaymentModes();

    // Find the UUID for Cash
    const waiverMode = waiverModesResponse.results.find((mode) => mode.name.toLowerCase() === 'waiver');
    if (!waiverMode) showAlert('error', 'Waiver Application', 'Waiver payment mode not found. Please contact support.');

    const waiverUuid = waiverMode.uuid;

    // 2️⃣ Prepare payload for line item payments
    const payload = {
      instanceType: waiverUuid,
      amount: appliedAmount,
      amountTendered: appliedAmount,
    };

    // 3️⃣ Call payment endpoint
    const response = await processPayment(billId, payload);
    if (!response.ok)
      showAlert('error', 'Waiver Application', 'Failed to apply waiver. Please try again or contact support.');

    showAlert('success', 'Waiver Application', 'Waiver applied successfully');

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
      amount,
    );
    setWaiverAmount('');
    setWaiverPercent('');
    setModalType(null);
    setWaiverLoading(false);
  };

  const shaButtonState = showShaClaimButton();

  const applySHAClaim = async () => {
    try {
      setShaLoading(true);

      const paymentModesResponse = await fetchPaymentModes();
      const shaMode = paymentModesResponse.results.find((mode) => mode.name.toLowerCase() === 'sha');

      if (!shaMode) {
        showAlert('error', 'SHA Claim', 'SHA payment mode not found. Please contact support.');
        setShaLoading(false);
        return;
      }

      // 1️⃣ Check if claim already exists
      const claimStatus = await checkClaimStatus(billId);
      let claimExists = false;

      if (claimStatus.success && claimStatus.data) {
        claimExists = true;
      }

      // 2️⃣ Raise claim if not existing
      if (!claimExists) {
        const claimResponse = await raiseSHAClaim(billId);

        if (!claimResponse.success) {
          showAlert('error', 'SHA Claim', claimResponse.message || 'Failed to raise SHA claim.');
          setShaLoading(false);
          return;
        }
      }

      // 3️⃣ Process SHA payment
      const totalAmount = pendingShaItems.reduce((acc, i) => acc + getBalance(i), 0);

      const payload = {
        instanceType: shaMode.uuid,
        amount: totalAmount,
        amountTendered: totalAmount,
      };

      const paymentResponse = await processPayment(billId, payload);

      if (!paymentResponse.ok) {
        showAlert('error', 'SHA Claim', 'Payment failed after claim creation.');
        setShaLoading(false);
        return;
      }

      // 4️⃣ Refresh bill
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
          status: (li.paymentStatus?.toUpperCase() as LineItemStatus) || 'PENDING',
        })) || [];

      setItems(mappedItems);

      // 5️⃣ Add transaction log
      addLog('SHA', pendingShaItems, totalAmount);

      showAlert('success', 'SHA Claim', 'SHA claim processed successfully');

      setModalType(null);
    } catch (error) {
      console.error('SHA claim flow failed', error);
      showAlert('error', 'SHA Claim', 'Unexpected error while processing SHA claim.');
    } finally {
      setShaLoading(false);
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

  const statusText = `${billState}${billStatus() ? ` (${billStatus()})` : ''}`;

  const [cashLoading, setCashLoading] = useState(false);
  const [waiverLoading, setWaiverLoading] = useState(false);
  const [shaLoading, setShaLoading] = useState(false);

  const handlePrintInvoice = () => {
    // For partially paid / unpaid bills
    const billUrl = `/billing/print-invoice/${billId}`;
    window.open(billUrl, '_blank');
  };

  const handlePrintReceipt = () => {
    // For fully paid bills
    const receiptUrl = `/billing/print-receipt/${billId}`;
    window.open(receiptUrl, '_blank');
  };

  const getClaimTagType = (status?: string) => {
    const s = status?.toLowerCase() || '';

    if (s.includes('approved') || s.includes('paid')) return 'green';
    if (s.includes('pending')) return 'warm-gray';
    if (s.includes('rejected') || s.includes('failed')) return 'red';

    return 'cool-gray';
  };

  const handleRaiseShaConfirm = () => {
    const confirmed = window.confirm(
      'Raise SHA claim for this bill?\n\nConfirm that all cash items are settled if any and that there are no additional items to add to the claim.',
    );

    if (confirmed) {
      setModalType('SHA');
    }
  };

  return (
    <Grid fullWidth style={{ padding: '0' }}>
      {/* Breadcrumb & Bill Info */}
      <Column lg={16} style={{ marginTop: '1rem' }}>
        <Breadcrumb style={{ marginBottom: '1rem' }}>
          <BreadcrumbItem onClick={navigateToBillingPage}>Bills</BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>{loading ? <SkeletonText width="120px" /> : billNumber}</BreadcrumbItem>
        </Breadcrumb>

        <Tile style={{ paddingTop: '1rem' }}>
          {/* Patient Name on Top */}
          {loading ? (
            <SkeletonText width="200px" />
          ) : (
            <>
              <h5 style={{ marginBottom: '0.5rem' }}>{patientName}</h5>

              {crId && locationUuid && <EligibilityTags crId={crId} locationUuid={locationUuid} />}
            </>
          )}

          {/* Row with three columns */}
          <Grid fullWidth>
            <Column sm={4} md={4} lg={4}>
              <p>
                <strong>Bill No:</strong> {loading ? <SkeletonText width="100px" /> : billNumber}
              </p>
            </Column>
            <Column sm={4} md={4} lg={4}>
              <p>
                <strong>Cash Point:</strong> {loading ? <SkeletonText width="120px" /> : cashPoint}
              </p>
            </Column>
            <Column sm={4} md={4} lg={4}>
              <p>
                <strong>Bill Date:</strong>{' '}
                {loading ? <SkeletonText width="150px" /> : formatBillDate(bill?.dateCreated)}
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
                {!allCashSettled && (
                  <Tile
                    style={{
                      background: '#fff5f5',
                      border: '1px solid #f5c2c2',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1rem',
                      width: '100%',
                    }}
                  >
                    <p
                      style={{
                        color: '#da1e28',
                        margin: 0,
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                      }}
                    >
                      Please select cash item(s) to continue. SHA claims (if any) will be available after all cash
                      payments are completed.
                    </p>
                  </Tile>
                )}

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
                      <Button disabled={loading} renderIcon={Money} size="sm" onClick={() => setModalType('CASH')}>
                        Pay Selected Cash Items
                      </Button>
                    )}

                    {shaButtonState === 'RAISE' && (
                      <Button
                        disabled={loading || checkingClaim}
                        size="sm"
                        kind="secondary"
                        renderIcon={DocumentAdd}
                        onClick={handleRaiseShaConfirm}
                      >
                        Raise SHA Claim
                      </Button>
                    )}

                    {shaButtonState === 'STATUS' && (
                      <Button
                        disabled={loading || checkingClaim}
                        size="sm"
                        kind="tertiary"
                        renderIcon={View}
                        onClick={handleCheckSHAClaim}
                      >
                        {checkingClaim ? 'Checking Status...' : 'Check SHA Claim Status'}
                      </Button>
                    )}

                    {totalBalance > 0 && (
                      <Button
                        disabled={loading}
                        renderIcon={Subtract}
                        size="sm"
                        kind="tertiary"
                        onClick={() => setModalType('WAIVER')}
                      >
                        Apply Waiver
                      </Button>
                    )}

                    {totalBalance === 0 && (
                      <Button disabled size="sm" kind="tertiary" renderIcon={Receipt} onClick={handlePrintReceipt}>
                        Print Receipt
                      </Button>
                    )}
                  </Stack>
                </div>

                {/* Bill Items Table */}
                {loading ? (
                  <SkeletonPlaceholder style={{ height: '300px', width: '100%' }} />
                ) : (
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
                                  <Checkbox
                                    id={`select-${i.id}`}
                                    labelText=""
                                    checked={shaOnlyBill ? true : !!i.selected}
                                    disabled={i.status !== 'PENDING' || shaOnlyBill || i.payerType !== 'CASH'}
                                    onChange={() => toggleSelect(i.id)}
                                  />
                                </TableCell>

                                <TableCell>
                                  <OverflowMenu ariaLabel="Actions" size="sm" disabled={i.status !== 'PENDING'}>
                                    <OverflowMenuItem itemText="Edit Quantity" onClick={() => openEditQuantity(i)} />
                                    <OverflowMenuItem
                                      itemText="Delete Item"
                                      onClick={() => {
                                        setEditItem(i);
                                        setModalType('CONFIRM_DELETE');
                                      }}
                                    />
                                  </OverflowMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </DataTable>
                )}
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
                      amount: formatCurrency(p.amount),
                      amountTendered: p.amountTendered ? formatCurrency(p.amountTendered) : '-',
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
              <Tile style={{ padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>
                  <u>Bill Summary</u>
                </h4>

                <Stack gap={3}>
                  {/* Status */}
                  {loading ? (
                    <SkeletonText width="100%" />
                  ) : (
                    <Tag type={totalBalance === 0 ? 'green' : totalBalance < billTotal ? 'teal' : 'red'}>
                      {totalBalance === 0 && <CheckmarkFilled size={12} style={{ marginRight: 4 }} />}
                      {totalBalance > 0 && totalBalance < billTotal && (
                        <WarningAlt size={12} style={{ marginRight: 4 }} />
                      )}
                      {totalBalance === billTotal && <PendingFilled size={12} style={{ marginRight: 4 }} />}
                      {statusText}
                    </Tag>
                  )}

                  {/* Divider */}
                  <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0' }} />

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{fontWeight: 'bold'}}>Total</span>
                    <strong>
                      {loading ? (
                        <SkeletonText width="100px" />
                      ) : (
                        `Ksh ${Number(billTotal).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      )}
                    </strong>
                  </div>

                  {/* Paid */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#24a148', fontWeight: 'bold' }}>Paid</span>
                    <strong style={{ color: '#24a148' }}>
                      {loading ? (
                        <SkeletonText width="100px" />
                      ) : (
                        `Ksh ${Number(totalPaid).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      )}
                    </strong>
                  </div>

                  {/* Claimed */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#0f62fe', fontWeight: 'bold' }}>Claimed</span>
                    <strong style={{ color: '#0f62fe' }}>
                      {loading ? (
                        <SkeletonText width="100px" />
                      ) : (
                        `Ksh ${Number(totalClaimed).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      )}
                    </strong>
                  </div>

                  {/* Waived */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8a3ffc', fontWeight: 'bold' }}>Waived</span>
                    <strong style={{ color: '#8a3ffc' }}>
                      {loading ? (
                        <SkeletonText width="100px" />
                      ) : (
                        `Ksh ${Number(totalWaived).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      )}
                    </strong>
                  </div>

                  {/* Divider */}
                  <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0' }} />

                  {/* Balance */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold' }}>Balance</span>
                    <strong
                      style={{
                        color: totalBalance > 0 ? '#da1e28' : '#24a148',
                        fontSize: '1.1rem',
                      }}
                    >
                      {loading ? (
                        <SkeletonText width="100px" />
                      ) : (
                        `Ksh ${Number(totalBalance).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      )}
                    </strong>
                  </div>
                </Stack>
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
        primaryButtonText={cashLoading ? 'Processing...' : 'Submit'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={cashLoading}
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
        primaryButtonText={waiverLoading ? 'Applying...' : 'Submit'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={
          waiverLoading ||
          (waiverType === 'PERCENT'
            ? waiverPercent === '' || Number(waiverPercent) < 1 || Number(waiverPercent) > 100
            : waiverAmount === '' || Number(waiverAmount) < 1)
        }
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
            invalid={waiverPercent !== '' && (Number(waiverPercent) < 1 || Number(waiverPercent) > 100)}
            invalidText="Percentage must be between 1 and 100"
            onChange={(_e, state) => setWaiverPercent(String(state.value))}
          />
        ) : (
          <NumberInput
            id="waiver-amount"
            label="Waiver Amount"
            min={0}
            value={waiverAmount}
            invalid={waiverAmount !== '' && Number(waiverAmount) < 1}
            invalidText="Amount cannot be less than 1"
            onChange={(_e, state) => setWaiverAmount(String(state.value))}
          />
        )}
      </Modal>

      {/* SHA Claim */}
      <Modal
        open={modalType === 'SHA'}
        modalHeading="Confirm SHA Claim"
        primaryButtonText={shaLoading ? 'Submitting...' : 'Submit Claim'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={shaLoading}
        onRequestClose={() => setModalType(null)}
        onRequestSubmit={applySHAClaim}
      >
        <Stack gap={4}>
          {/* ===== Info ===== */}
          <Tile>
            <p style={{ marginBottom: '0.5rem' }}>
              You are about to submit the following items for <strong>SHA claim</strong>.
            </p>
            <p style={{ color: '#6f6f6f', marginBottom: 0 }}>
              Please confirm all services are correct before proceeding.
            </p>
          </Tile>

          {/* ===== Items Table ===== */}
          <Tile>
            <h5 style={{ marginBottom: '1rem' }}>Claim Items</h5>

            <DataTable
              rows={pendingShaItems.map((i) => ({
                id: i.id,
                service: i.service,
                quantity: i.quantity,
                unitPrice: `Ksh ${Number(i.price).toLocaleString()}`,
                total: `Ksh ${getBalance(i).toLocaleString()}`,
              }))}
              headers={[
                { key: 'service', header: 'Service' },
                { key: 'quantity', header: 'Qty' },
                { key: 'unitPrice', header: 'Unit Price' },
                { key: 'total', header: 'Total' },
              ]}
            >
              {({ rows, headers, getHeaderProps, getRowProps }) => (
                <Table size="sm" useZebraStyles>
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
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          </Tile>

          {/* ===== Summary ===== */}
          <Tile>
            <Grid fullWidth>
              <Column lg={8}>
                <p>
                  <strong>Items:</strong> {pendingShaItems.length}
                </p>
              </Column>

              <Column lg={8} style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  Total: Ksh {pendingShaItems.reduce((acc, i) => acc + getBalance(i), 0).toLocaleString()}
                </p>
              </Column>
            </Grid>
          </Tile>
        </Stack>
      </Modal>

      {/* claim status */}
      <Modal
        open={modalType === 'CHECK_SHA'}
        modalHeading="SHA Claim Status"
        primaryButtonText="Close"
        secondaryButtonText={null}
        onRequestClose={() => setModalType(null)}
        onRequestSubmit={() => setModalType(null)}
      >
        {claimResponse ? (
          <Stack gap={4}>
            <Tile>
              <h5 style={{ marginBottom: '0.5rem' }}>Patient Information</h5>
              <p>
                <strong>Name:</strong> {claimResponse.patientFullName}
              </p>
              <p>
                <strong>Gender:</strong> {claimResponse.gender}
              </p>

              <h5 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Facility</h5>
              <p>
                {claimResponse.facilityName} ({claimResponse.facilityLevel})
              </p>
            </Tile>

            <Tile>
              <h5 style={{ marginBottom: '0.5rem' }}>Claim Details</h5>

              <p>
                <strong>Status:</strong>{' '}
                <Tag type={getClaimTagType(claimResponse.claim_Status)}>{claimResponse.claim_Status}</Tag>
              </p>

              <p>
                <strong>Response:</strong> {claimResponse.claim_Response || '-'}
              </p>
            </Tile>

            {claimResponse.services?.length > 0 && (
              <Tile>
                <h5 style={{ marginBottom: '1rem' }}>Services</h5>

                <DataTable
                  rows={claimResponse.services.map((s: any) => ({
                    id: s.serviceCode,
                    name: s.serviceDisplay,
                    code: s.serviceCode,
                    quantity: s.quantity,
                    amount: `Ksh ${Number(s.totalAmount).toLocaleString()}`,
                  }))}
                  headers={[
                    { key: 'name', header: 'Service' },
                    { key: 'code', header: 'Code' },
                    { key: 'quantity', header: 'Qty' },
                    { key: 'amount', header: 'Total Amount' },
                  ]}
                >
                  {({ rows, headers, getHeaderProps, getRowProps }) => (
                    <Table size="sm">
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
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </DataTable>
              </Tile>
            )}

            {claimResponse.diagnoses?.length > 0 && (
              <Tile>
                <h5 style={{ marginBottom: '1rem' }}>Diagnoses</h5>

                <DataTable
                  rows={claimResponse.diagnoses.map((d: any, index: number) => ({
                    id: `${d.Code}-${index}`,
                    name: d.Display,
                    code: d.Code,
                  }))}
                  headers={[
                    { key: 'name', header: 'Diagnosis' },
                    { key: 'code', header: 'Code' },
                  ]}
                >
                  {({ rows, headers, getHeaderProps, getRowProps }) => (
                    <Table size="sm">
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
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </DataTable>
              </Tile>
            )}
          </Stack>
        ) : (
          <Tile>
            <p>No claim data available.</p>
          </Tile>
        )}
      </Modal>
    </Grid>
  );
};

export default BillDetails;
