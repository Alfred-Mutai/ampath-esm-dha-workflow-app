import React from 'react';
import { type ClaimVisitInvoince } from '../../types';
import { Tag } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import ClaimInvoiceLineDetails from '../claim-invoice-line-details/claim-invoice-line-details.component';
import ClaimInvoicePanel, { type ClaimFactsShownAbove } from './claim-invoice-panel.component';
import RecordCards, { type RecordCardModel } from '../shared/record-cards.component';
import { claimStatusTagType as stateTagType } from '../../claim-statuses';

interface claimInvoiceDetailsProps {
  claimInvoices: ClaimVisitInvoince[];
  consentToken: string;
}

const money = (n: number | string) => Number(n ?? 0).toLocaleString('en-KE');

// Builder so the cards can be merged into a shared grid with the interventions.
// `canEditLines` follows the claim's content window — see ../../claim-statuses — and
// decides whether each line offers a Remove action.
export function buildInvoiceRecords(
  claimInvoices: ClaimVisitInvoince[],
  consentToken: string,
  canEditLines = false,
  /** What the claim page states above the panel, so the panel doesn't restate it. */
  claimFacts?: ClaimFactsShownAbove,
): RecordCardModel[] {
  return (claimInvoices ?? []).map((ci) => {
    const lineCount = ci.lines?.length ?? 0;
    return {
      tone: 'blue',
      kind: 'Invoice',
      title: `Invoice ${ci.invoice_number}`,
      // How the side panel renders this invoice, in place of the generic field grid.
      panel: (
        <ClaimInvoicePanel
          invoice={ci}
          consentToken={consentToken}
          canEditLines={canEditLines}
          claimFacts={claimFacts}
        />
      ),
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
      // Invoice lines expand beneath the invoice rather than in a modal, and start open:
      // the lines are what the panel is opened to read, so they shouldn't need a second
      // click to reach.
      expandable:
        lineCount > 0
          ? {
              label: (open: boolean) => `${open ? 'Hide' : 'Show'} line items (${lineCount})`,
              content: (
                <ClaimInvoiceLineDetails
                  claimInvoiceLines={ci.lines}
                  consentToken={consentToken}
                  canEditLines={canEditLines}
                />
              ),
              defaultOpen: true,
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
