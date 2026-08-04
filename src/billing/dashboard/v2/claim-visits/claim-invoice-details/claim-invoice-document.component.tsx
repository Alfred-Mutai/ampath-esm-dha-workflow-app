import React, { forwardRef } from 'react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import { type ClaimVisitInvoince } from '../../types';

interface ClaimInvoiceDocumentProps {
  invoice: ClaimVisitInvoince;
  /** Who the invoice is for and under what cover — the claim's, not the invoice's. */
  patientName?: string;
  memberNumber?: string;
  schemeName?: string;
  /** Who produced this copy and when. A printed invoice leaves the system, so it has to
      say where it came from; without it a copy can't be told from a later reprint. */
  generatedBy?: string;
  generatedAt?: Date | null;
}

const money = (n: number | string) =>
  Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const date = (value?: string | null): string => {
  const v = (value ?? '').trim();
  if (!v) {
    return '—';
  }
  try {
    return formatDate(parseDate(v));
  } catch {
    return v;
  }
};

/**
 * The invoice as a document, laid out the way an invoice is: who issued it and to whom,
 * its number and date, the lines it charges for, and the total those lines come to.
 *
 * Rendered off-screen and rasterised into a PDF (html2canvas → jsPDF), so it is sized in
 * millimetres to an A4 content width and uses inline styles throughout — the CSS-module
 * classes the app is built with don't survive being cloned into html2canvas's canvas.
 */
const ClaimInvoiceDocument = forwardRef<HTMLDivElement, ClaimInvoiceDocumentProps>(
  ({ invoice, patientName, memberNumber, schemeName, generatedBy, generatedAt }, ref) => {
    const lines = invoice?.lines ?? [];
    const amount = Number(invoice?.total_inv_amount ?? 0);
    const net = Number(invoice?.total_inv_net_amount ?? 0);
    const copay = Number(invoice?.total_inv_copay ?? 0);
    const discount = Number(invoice?.total_inv_discount ?? 0);

    const cell: React.CSSProperties = {
      padding: '6px 8px',
      borderBottom: '1px solid #d0d0d0',
      verticalAlign: 'top',
    };
    const numericCell: React.CSSProperties = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' };
    const headCell: React.CSSProperties = {
      padding: '6px 8px',
      borderBottom: '2px solid #161616',
      textAlign: 'left',
      fontWeight: 700,
      textTransform: 'uppercase',
      fontSize: '9px',
      letterSpacing: '0.04em',
    };
    const totalRowLabel: React.CSSProperties = { padding: '4px 8px', textAlign: 'right' };
    const totalRowValue: React.CSSProperties = {
      padding: '4px 8px',
      textAlign: 'right',
      whiteSpace: 'nowrap',
      minWidth: '90px',
    };
    const metaLabel: React.CSSProperties = {
      fontSize: '9px',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: '#525252',
    };

    return (
      <div
        ref={ref}
        style={{
          all: 'initial',
          display: 'block',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          color: '#161616',
          width: '190mm',
          padding: '12mm',
          background: '#ffffff',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{invoice?.provider_name || 'Health facility'}</div>
            <div style={{ ...metaLabel, marginTop: '2px' }}>Provider</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.06em' }}>INVOICE</div>
            <div style={{ marginTop: '2px' }}>{invoice?.invoice_number || '—'}</div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '2px solid #161616', margin: '10px 0 12px' }} />

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div style={metaLabel}>Billed for</div>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{patientName || '—'}</div>
                {memberNumber ? <div style={{ marginTop: '1px' }}>{memberNumber}</div> : null}
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div style={metaLabel}>Invoice date</div>
                <div style={{ marginTop: '2px' }}>{date(invoice?.invoice_date)}</div>
                <div style={{ ...metaLabel, marginTop: '6px' }}>Cover</div>
                <div style={{ marginTop: '2px' }}>
                  {[schemeName, invoice?.scheme_code].filter(Boolean).join(' · ') || '—'}
                </div>
                {invoice?.service_type ? (
                  <>
                    <div style={{ ...metaLabel, marginTop: '6px' }}>Service type</div>
                    <div style={{ marginTop: '2px' }}>{invoice.service_type}</div>
                  </>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headCell, width: '24px' }}>#</th>
              <th style={headCell}>Description</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Qty</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Unit price</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length ? (
              lines.map((line, index) => (
                <tr key={line.id ?? index}>
                  <td style={cell}>{index + 1}</td>
                  <td style={cell}>
                    <div style={{ fontWeight: 700 }}>{line.item_name || line.item_code || 'Unnamed line'}</div>
                    <div style={{ color: '#525252', fontSize: '9px', marginTop: '1px' }}>
                      {[line.item_code, line.intervention_code !== line.item_code ? line.intervention_code : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </td>
                  <td style={numericCell}>{[line.quantity, line.unit].filter(Boolean).join(' ')}</td>
                  <td style={numericCell}>{money(line.unit_price)}</td>
                  <td style={numericCell}>{money(line.line_total_amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={{ ...cell, color: '#525252' }} colSpan={5}>
                  No lines on this invoice.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {/* A subtotal only says something when an adjustment sits between it and the
                total; otherwise it is the total stated twice. */}
            {discount > 0 || copay > 0 ? (
              <tr>
                <td colSpan={3} />
                <td style={totalRowLabel}>Subtotal</td>
                <td style={totalRowValue}>{money(amount)}</td>
              </tr>
            ) : null}
            {discount > 0 ? (
              <tr>
                <td colSpan={3} />
                <td style={totalRowLabel}>Discount</td>
                <td style={totalRowValue}>-{money(discount)}</td>
              </tr>
            ) : null}
            {copay > 0 ? (
              <tr>
                <td colSpan={3} />
                <td style={totalRowLabel}>Co-pay</td>
                <td style={totalRowValue}>{money(copay)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={3} />
              <td style={{ ...totalRowLabel, fontWeight: 700, borderTop: '2px solid #161616' }}>Total (KES)</td>
              <td style={{ ...totalRowValue, fontWeight: 700, borderTop: '2px solid #161616' }}>{money(net || amount)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: '16px', fontSize: '9px', color: '#525252' }}>
          {[invoice?.workflow_state ? `State: ${invoice.workflow_state}` : null,
            invoice?.dispatch_status ? `Dispatch: ${invoice.dispatch_status}` : null]
            .filter(Boolean)
            .join('   ·   ')}
        </div>

        <div
          style={{
            marginTop: '10px',
            paddingTop: '6px',
            borderTop: '1px solid #d0d0d0',
            fontSize: '9px',
            color: '#525252',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>Generated by {generatedBy?.trim() || 'Unknown user'}</span>
          <span>
            {generatedAt
              ? generatedAt.toLocaleString('en-KE', {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </span>
        </div>
      </div>
    );
  },
);

export default ClaimInvoiceDocument;
