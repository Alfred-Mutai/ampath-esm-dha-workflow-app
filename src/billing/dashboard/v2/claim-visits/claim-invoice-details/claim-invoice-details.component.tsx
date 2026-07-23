import React from 'react';
import { type ClaimVisitInvoince } from '../../types';
import { Tag } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import ClaimInvoiceLineDetails from '../claim-invoice-line-details/claim-invoice-line-details.component';
import RecordCards, { type RecordCardModel } from '../shared/record-cards.component';

interface claimInvoiceDetailsProps {
  claimInvoices: ClaimVisitInvoince[];
  consentToken: string;
}

const money = (n: number | string) => Number(n ?? 0).toLocaleString('en-KE');

const stateTagType = (value?: string): 'green' | 'red' | 'blue' | 'gray' => {
  const s = (value ?? '').toUpperCase();
  if (s === 'VALID' || s === 'DISPATCHED' || s === 'PAID') return 'green';
  if (s === 'INVALID' || s === 'REJECTED' || s === 'FAILED') return 'red';
  if (s === 'SUBMITTED' || s === 'PENDING' || s === 'DRAFT') return 'blue';
  return 'gray';
};

// Builder so the cards can be merged into a shared grid with the interventions.
export function buildInvoiceRecords(claimInvoices: ClaimVisitInvoince[], consentToken: string): RecordCardModel[] {
  return (claimInvoices ?? []).map((ci) => {
    const lineCount = ci.lines?.length ?? 0;
    return {
      tone: 'blue',
      kind: 'Invoice',
      title: `Invoice ${ci.invoice_number}`,
      badge: ci.workflow_state ? (
        <Tag size="sm" type={stateTagType(ci.workflow_state)}>
          {ci.workflow_state}
        </Tag>
      ) : undefined,
      fields: [
        { label: 'Date', value: ci.invoice_date ? formatDate(parseDate(ci.invoice_date)) : '' },
        {
          label: 'Dispatch status',
          value: ci.dispatch_status ? (
            <Tag size="sm" type={stateTagType(ci.dispatch_status)}>
              {ci.dispatch_status}
            </Tag>
          ) : (
            ''
          ),
        },
        { label: 'Scheme', value: ci.scheme_code },
        { label: 'Service type', value: ci.service_type },
        { label: 'Amount', value: `KES ${money(ci.total_inv_amount)}` },
        { label: 'Net', value: `KES ${money(ci.total_inv_net_amount)}` },
        { label: 'Co-pay', value: `KES ${money(ci.total_inv_copay)}` },
        { label: 'Discount', value: `KES ${money(ci.total_inv_discount)}` },
      ],
      // Invoice lines expand inline beneath the invoice rather than in a modal.
      expandable:
        lineCount > 0
          ? {
              label: (open: boolean) => `${open ? 'Hide' : 'Show'} line items (${lineCount})`,
              content: <ClaimInvoiceLineDetails claimInvoiceLines={ci.lines} consentToken={consentToken} />,
            }
          : undefined,
    };
  });
}

const ClaimInvoiceDetails: React.FC<claimInvoiceDetailsProps> = ({ claimInvoices, consentToken }) => (
  <RecordCards
    records={buildInvoiceRecords(claimInvoices, consentToken)}
    emptyMessage="No invoice data."
    layout="grid"
    gridFill="fill"
  />
);

export default ClaimInvoiceDetails;
