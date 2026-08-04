import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Tag } from '@carbon/react';
import { DocumentPdf } from '@carbon/react/icons';
import { closeWorkspace, formatDate, parseDate, showSnackbar, useSession } from '@openmrs/esm-framework';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { type ClaimVisitInvoince } from '../../types';
import { claimStatusTagType as stateTagType } from '../../claim-statuses';
import ClaimInvoiceLineDetails from '../claim-invoice-line-details/claim-invoice-line-details.component';
import ClaimInvoiceDocument from './claim-invoice-document.component';
import { RECORD_DETAILS_WORKSPACE } from '../shared/record-details.workspace';
import styles from './claim-invoice-panel.component.scss';

/**
 * What the claim page already states about itself, above this panel. An invoice inherits
 * most of it — same scheme, same service type, same provider — so repeating it here fills
 * the panel with facts the reader has just read. Passed in so the panel can show each one
 * only when this invoice disagrees with the claim, which is the case worth seeing.
 */
export interface ClaimFactsShownAbove {
  serviceType?: string;
  schemeCode?: string;
  schemeName?: string;
  providerName?: string;
  visitStart?: string;
  /** Not shown in the panel — carried for the printable invoice, which must name who it
      is for even though the page above already does. */
  patientName?: string;
  memberNumber?: string;
}

interface ClaimInvoicePanelProps {
  invoice: ClaimVisitInvoince;
  consentToken: string;
  /** Follows the claim's content window — see ../../claim-statuses. */
  canEditLines?: boolean;
  claimFacts?: ClaimFactsShownAbove;
}

const money = (n: number | string) =>
  `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const sameValue = (a?: string | null, b?: string | null): boolean =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

/**
 * States in which an invoice has left the building. A claim can still be a draft overall
 * while one of its invoices has already gone to the payer, and a line can't be pulled out
 * of an invoice that has been sent — so removal is withheld once any of these is reached,
 * on top of the claim-level draft check the caller already applies.
 */
const DISPATCHED_INVOICE_STATES = new Set(['DISPATCHED', 'SUBMITTED', 'SUBMITTED_PAYER', 'CLOSED']);

const invoiceHasBeenSent = (invoice: ClaimVisitInvoince): boolean =>
  DISPATCHED_INVOICE_STATES.has((invoice?.dispatch_status ?? '').trim().toUpperCase()) ||
  DISPATCHED_INVOICE_STATES.has((invoice?.workflow_state ?? '').trim().toUpperCase());

const asDate = (value?: string | null): string => {
  const v = (value ?? '').trim();
  if (!v) {
    return '';
  }
  try {
    return formatDate(parseDate(v));
  } catch {
    return v;
  }
};

/**
 * An invoice as the side panel shows it: a summary of what it comes to, then its lines
 * set out the way an invoice sets them out, and a preview of the invoice as a document.
 *
 * The generic labelled-field card gave the invoice number, its four money figures and
 * its lines' twenty-odd fields all the same weight, so what the invoice was worth was no
 * easier to find than which scheme it was raised under.
 */
const ClaimInvoicePanel: React.FC<ClaimInvoicePanelProps> = ({
  invoice,
  consentToken,
  canEditLines,
  claimFacts,
}) => {
  const amount = Number(invoice.total_inv_amount ?? 0);
  const net = Number(invoice.total_inv_net_amount ?? 0);
  const copay = Number(invoice.total_inv_copay ?? 0);
  const discount = Number(invoice.total_inv_discount ?? 0);
  // Two gates, both required: the claim must still take content edits, and this invoice
  // must not have been dispatched.
  const linesEditable = Boolean(canEditLines) && !invoiceHasBeenSent(invoice);

  const session = useSession();
  const generatedBy = session?.user?.person?.display || session?.user?.display || '';

  const documentRef = useRef<HTMLDivElement>(null);
  const objectUrl = useRef<string>('');
  const [preview, setPreview] = useState<string>('');
  const [rendering, setRendering] = useState(false);
  // Stamped when Preview is pressed, then captured on the render that follows — so the
  // sheet says when this copy was produced, not when the panel happened to open.
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [captureRequest, setCaptureRequest] = useState(0);

  // Object URLs outlive the component unless revoked, and each preview mints a new one.
  useEffect(
    () => () => {
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
      }
    },
    [],
  );

  // Runs after the render that carries the new timestamp into the off-screen document,
  // so what is rasterised is what the reader will see stamped on the sheet.
  useEffect(() => {
    if (!captureRequest) {
      return;
    }
    let cancelled = false;
    (async () => {
      const url = await buildPdf();
      if (!cancelled && url) {
        setPreview(url);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureRequest]);

  const startPreview = () => {
    if (rendering) {
      return;
    }
    setGeneratedAt(new Date());
    setCaptureRequest((n) => n + 1);
  };

  const buildPdf = async (): Promise<string> => {
    const element = documentRef.current;
    if (!element) {
      return '';
    }
    setRendering(true);
    try {
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight);
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
      }
      objectUrl.current = URL.createObjectURL(pdf.output('blob'));
      return objectUrl.current;
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Could not build the invoice PDF',
        subtitle: 'The invoice could not be rendered. Try again, or contact support.',
      });
      return '';
    } finally {
      setRendering(false);
    }
  };

  // Each fact is the claim's until this invoice says otherwise; only then is it worth a
  // slot here. With no claim context to compare against, all of them are shown. The
  // invoice's own date is the exception — it is the fact that dates this invoice, so it
  // is stated whether or not it matches the visit.
  const invoiceDate = asDate(invoice.invoice_date);
  const facts = [
    { label: 'Date', value: invoiceDate, repeated: false },
    {
      label: 'Service type',
      value: invoice.service_type,
      repeated: sameValue(invoice.service_type, claimFacts?.serviceType),
    },
    { label: 'Scheme', value: invoice.scheme_code, repeated: sameValue(invoice.scheme_code, claimFacts?.schemeCode) },
    {
      label: 'Provider',
      value: invoice.provider_name,
      repeated: sameValue(invoice.provider_name, claimFacts?.providerName),
    },
  ].filter((fact) => Boolean((fact.value ?? '').trim()) && !fact.repeated);
  // The date leads the sub-line on its own; whatever else survived joins it after it.
  const extraFacts = facts.filter((fact) => fact.label !== 'Date');

  // The invoice's closing figures, in the order an invoice states them. A subtotal only
  // says something when an adjustment sits between it and the total; with neither a
  // discount nor a co-pay it is the total repeated, so the total stands alone.
  const hasAdjustments = discount > 0 || copay > 0;
  const totals = [
    ...(hasAdjustments ? [{ label: 'Subtotal', value: money(amount) }] : []),
    ...(discount > 0 ? [{ label: 'Discount', value: `-${money(discount)}` }] : []),
    ...(copay > 0 ? [{ label: 'Co-pay', value: money(copay) }] : []),
    { label: 'Total', value: money(net || amount), strong: true },
  ];

  return (
    <div className={styles.panel}>
      {/* The invoice as a sheet: a masthead naming it, the facts that date and place it,
          then the lines and what they come to — the order an invoice is read in. */}
      <article className={styles.sheet}>
        {/* The invoice number is the panel's own title, so it isn't set again here. What
            is left are the particulars: when it was issued, where it stands, and anything
            about it the claim above didn't already state. */}
        <dl className={styles.meta}>
          <div>
            <dt>Invoice date</dt>
            <dd>{invoiceDate || '—'}</dd>
          </div>
          {extraFacts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
          <div>
            <dt>Status</dt>
            <dd className={styles.statusTags}>
              {invoice.workflow_state ? (
                <Tag size="sm" type={stateTagType(invoice.workflow_state)}>
                  {invoice.workflow_state}
                </Tag>
              ) : null}
              {invoice.dispatch_status ? (
                <Tag size="sm" type={stateTagType(invoice.dispatch_status)}>
                  {invoice.dispatch_status}
                </Tag>
              ) : null}
              {!invoice.workflow_state && !invoice.dispatch_status ? '—' : null}
            </dd>
          </div>
        </dl>

        <ClaimInvoiceLineDetails
          claimInvoiceLines={invoice.lines}
          consentToken={consentToken}
          canEditLines={linesEditable}
          totals={totals}
          // The sheet already dates the invoice; a line repeats its charge date only when
          // it was charged on a different day.
          invoiceDate={invoiceDate}
        />
      </article>

      {/* Held to the bottom of the panel however short the invoice is, and staying there
          when a long one scrolls. This panel is rendered from a record model rather than
          as a child of the workspace, so it has no closeWorkspace prop to call — it
          dismisses the panel by name instead. */}
      <div className={styles.footer}>
        <Button kind="secondary" size="sm" onClick={() => closeWorkspace(RECORD_DETAILS_WORKSPACE)}>
          Close
        </Button>
        {/* Plain text while it builds rather than an InlineLoading, whose own line height
            would make this button taller than the Close beside it. */}
        <Button kind="primary" size="sm" renderIcon={DocumentPdf} disabled={rendering} onClick={startPreview}>
          {rendering ? 'Building…' : 'Preview'}
        </Button>
      </div>

      {/* Off-screen source for the PDF: the invoice as a document, at A4 width. */}
      <div className={styles.hiddenDocument} aria-hidden="true">
        <ClaimInvoiceDocument
          ref={documentRef}
          invoice={invoice}
          patientName={claimFacts?.patientName}
          memberNumber={claimFacts?.memberNumber}
          schemeName={claimFacts?.schemeName}
          generatedBy={generatedBy}
          generatedAt={generatedAt}
        />
      </div>

      <Modal
        open={Boolean(preview)}
        passiveModal
        size="lg"
        modalHeading={`Invoice ${invoice.invoice_number ?? ''}`.trim()}
        onRequestClose={() => setPreview('')}
      >
        {preview ? <iframe src={preview} title="Invoice preview" className={styles.previewFrame} /> : null}
      </Modal>
    </div>
  );
};

export default ClaimInvoicePanel;
