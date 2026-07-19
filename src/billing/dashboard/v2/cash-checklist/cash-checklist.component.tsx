import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  ContentSwitcher,
  InlineLoading,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { ArrowLeft, Checkmark, DocumentPdf, Receipt } from '@carbon/react/icons';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { useReactToPrint } from 'react-to-print';
import styles from './cash-checklist.component.scss';
import {
  billBalance,
  billPaid,
  billStatus,
  billTotal,
  closeBill,
  getPayableBills,
  itemBalance,
  itemStatus,
  payItem,
  type BillLineItem,
  type CashBill,
  type PayInput,
} from './cash-checklist.resource';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';
import BillDocument from './bill-document.component';
import PaymentDrawer from './payment-drawer.component';

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

const BILL_TAG: Record<string, 'gray' | 'blue' | 'teal' | 'green'> = {
  OPEN: 'gray',
  PARTIAL: 'blue',
  SETTLED: 'teal',
  PAID: 'green',
};
const BILL_LABEL: Record<string, string> = {
  OPEN: 'Open',
  PARTIAL: 'Partially paid',
  SETTLED: 'Fully paid',
  PAID: 'Paid',
};
const ITEM_TAG: Record<string, 'gray' | 'blue' | 'green'> = { UNPAID: 'gray', PARTIAL: 'blue', PAID: 'green' };

const CashChecklist: React.FC<{ date?: string }> = ({ date }) => {
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const [bills, setBills] = useState<CashBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'open' | 'paid' | 'all'>('open');
  const [reload, setReload] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  // Payment drawer
  const [payItemTarget, setPayItemTarget] = useState<BillLineItem | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPayableBills(locationUuid)
      .then((data) => active && setBills(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [locationUuid, reload]);

  const selected = bills.find((b) => b.id === selectedId) ?? null;
  const docKind: 'invoice' | 'receipt' = selected?.closed ? 'receipt' : 'invoice';

  const docRef = useRef<HTMLDivElement>(null);
  const printDocument = useReactToPrint({
    contentRef: docRef,
    documentTitle: selected ? `${selected.closed ? 'Receipt' : 'Invoice'}-${selected.billNo}` : 'Bill',
    pageStyle: '@page { size: A4; margin: 16mm; }',
  });

  const handlePay = async (input: PayInput) => {
    if (!selected || !payItemTarget) {
      return;
    }
    setPaying(true);
    try {
      const entry = await payItem(selected.id, payItemTarget.id, input);
      showSnackbar({
        kind: 'success',
        title: 'Payment recorded',
        subtitle: `${entry.method} ${money(entry.amount)} · receipt ${entry.receiptNo}${entry.reference ? ` · ref ${entry.reference}` : ''}.`,
      });
      setPayItemTarget(null);
      setReload((k) => k + 1);
    } finally {
      setPaying(false);
    }
  };

  const close = async (billId: string) => {
    setClosing(true);
    try {
      await closeBill(billId);
      showSnackbar({ kind: 'success', title: 'Bill closed', subtitle: 'Marked as paid; no further items can be added.' });
      setReload((k) => k + 1);
    } finally {
      setClosing(false);
    }
  };

  // ---- Bill detail ----
  if (selected) {
    const status = billStatus(selected);
    const balance = billBalance(selected);
    const canClose = !selected.closed && balance === 0;
    return (
      <div className={styles.wrap}>
        <Button kind="ghost" size="sm" renderIcon={ArrowLeft} className={styles.back} onClick={() => setSelectedId(null)}>
          Back to cash payments
        </Button>

        <div className={styles.detailHead}>
          <div>
            <div className={styles.billNo}>{selected.billNo}</div>
            <h5 className={styles.name}>{selected.patientName}</h5>
            <div className={styles.meta}>
              CR {selected.crNumber} · {selected.date} ·{' '}
              {selected.source === 'SHA_COPAY' ? `SHA copay · ${selected.claimCode}` : 'Cash'}
            </div>
          </div>
          <div className={styles.detailActions}>
            <Tag type={BILL_TAG[status]} size="md">
              {BILL_LABEL[status]}
            </Tag>
            {selected.closed ? (
              <Button kind="tertiary" size="sm" renderIcon={Receipt} onClick={() => printDocument()}>
                Generate receipt
              </Button>
            ) : (
              <>
                <Button kind="tertiary" size="sm" renderIcon={DocumentPdf} onClick={() => printDocument()}>
                  Generate invoice
                </Button>
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={Checkmark}
                  disabled={!canClose || closing}
                  onClick={() => close(selected.id)}
                >
                  {closing ? 'Closing…' : 'Close bill'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className={styles.tableCard}>
          <Table size="sm" aria-label="bill line items" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Code</TableHeader>
                <TableHeader>Service</TableHeader>
                <TableHeader className={styles.num}>Amount</TableHeader>
                <TableHeader className={styles.num}>Balance</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {selected.lineItems.map((i) => {
                const st = itemStatus(i);
                const bal = itemBalance(i);
                return (
                  <TableRow key={i.id}>
                    <TableCell className={styles.mono}>{i.code}</TableCell>
                    <TableCell>{i.service}</TableCell>
                    <TableCell className={styles.num}>{money(i.amount)}</TableCell>
                    <TableCell className={styles.num}>{bal ? money(bal) : '—'}</TableCell>
                    <TableCell>
                      <Tag size="sm" type={ITEM_TAG[st]}>
                        {st === 'PAID' ? 'Paid' : st === 'PARTIAL' ? `Partial · ${money(i.paidAmount)}` : 'Unpaid'}
                      </Tag>
                    </TableCell>
                    <TableCell>
                      {bal > 0 && !selected.closed ? (
                        <Button kind="primary" size="sm" onClick={() => setPayItemTarget(i)}>
                          Pay &amp; release
                        </Button>
                      ) : (
                        <span className={styles.receiptRef}>{bal === 0 ? 'Settled' : '—'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className={styles.summaryLine}>
          <span>Total {money(billTotal(selected))}</span>
          <span className={styles.paidAmt}>Paid {money(billPaid(selected))}</span>
          <span className={styles.balanceAmt}>Balance {money(balance)}</span>
        </div>

        <h6 className={styles.sectionTitle}>Payment entries</h6>
        {selected.payments.length === 0 ? (
          <p className={styles.noPayments}>No payments recorded yet.</p>
        ) : (
          <ul className={styles.payments}>
            {selected.payments.map((p) => (
              <li key={p.id} className={styles.payment}>
                <Receipt size={16} className={styles.payIcon} />
                <div className={styles.payBody}>
                  <span className={styles.payService}>{p.service}</span>
                  <span className={styles.payMeta}>
                    {p.receiptNo} · {new Date(p.at).toLocaleString('en-KE')} · {p.method}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                </div>
                <span className={styles.payAmt}>{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.printArea} aria-hidden="true">
          <BillDocument ref={docRef} bill={selected} kind={docKind} />
        </div>

        {payItemTarget ? (
          <PaymentDrawer
            item={payItemTarget}
            source={selected.source}
            busy={paying}
            onClose={() => setPayItemTarget(null)}
            onSubmit={handlePay}
          />
        ) : null}
      </div>
    );
  }

  // ---- Bill list ----
  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <h5 className={styles.title}>Cash payments</h5>
        <p className={styles.subtitle}>
          Cash clients and SHA copays settle each item before service. A bill stays open while services add items; close
          it once fully paid. Open a bill to pay items and issue an invoice (pending) or receipt (paid).
        </p>
      </div>

      {loading ? (
        <InlineLoading description="Loading bills…" className={styles.loading} />
      ) : bills.length === 0 ? (
        <EmptyState message="No cash bills." />
      ) : (
        (() => {
          const base = bills.filter((b) => {
            const closed = billStatus(b) === 'PAID';
            const matchesView = view === 'all' || (view === 'open' ? !closed : closed);
            return (!date || b.date === date) && matchesView;
          });
          const term = search.trim().toLowerCase();
          const filtered = base.filter(
            (b) => !term || `${b.patientName} ${b.crNumber} ${b.billNo}`.toLowerCase().includes(term),
          );
          return (
            <>
              <div className={styles.viewSwitch}>
                <ContentSwitcher
                  size="sm"
                  selectedIndex={['open', 'paid', 'all'].indexOf(view)}
                  onChange={({ index }) => setView((['open', 'paid', 'all'] as const)[index ?? 0])}
                >
                  <Switch name="open" text="Open" />
                  <Switch name="paid" text="Paid" />
                  <Switch name="all" text="All payments" />
                </ContentSwitcher>
              </div>
              {base.length === 0 ? (
                <EmptyState message="No cash bills for the selected date." />
              ) : (
              <>
              <TableToolbar
                id="cash-payments"
                search={search}
                onSearch={setSearch}
                searchPlaceholder="Search patient or bill…"
              />
              {filtered.length === 0 ? (
                <EmptyState message="No cash bills match your search." />
              ) : (
                <div className={styles.tableCard}>
                  <Table size="sm" aria-label="cash bills" useZebraStyles>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Bill</TableHeader>
                        <TableHeader>Date</TableHeader>
                        <TableHeader>Patient</TableHeader>
                        <TableHeader>Type</TableHeader>
                        <TableHeader className={styles.num}>Total</TableHeader>
                        <TableHeader className={styles.num}>Balance</TableHeader>
                        <TableHeader>Status</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map((b) => {
                        const status = billStatus(b);
                        return (
                          <TableRow key={b.id}>
                            <TableCell>
                              <button type="button" className={styles.billLink} onClick={() => setSelectedId(b.id)}>
                                {b.billNo}
                              </button>
                            </TableCell>
                            <TableCell>{b.date}</TableCell>
                            <TableCell>{b.patientName}</TableCell>
                            <TableCell>
                              <Tag size="sm" type={b.source === 'SHA_COPAY' ? 'purple' : 'teal'}>
                                {b.source === 'SHA_COPAY' ? 'SHA copay' : 'Cash'}
                              </Tag>
                            </TableCell>
                            <TableCell className={styles.num}>{money(billTotal(b))}</TableCell>
                            <TableCell className={styles.num}>{billBalance(b) ? money(billBalance(b)) : '—'}</TableCell>
                            <TableCell>
                              <Tag size="sm" type={BILL_TAG[status]}>
                                {BILL_LABEL[status]}
                              </Tag>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              </>
              )}
            </>
          );
        })()
      )}
    </div>
  );
};

export default CashChecklist;
