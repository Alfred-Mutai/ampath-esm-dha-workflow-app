import React from "react";
import { type ClaimInvoiceLine } from "../../types"
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import { formatDate, parseDate, showSnackbar, useSession } from "@openmrs/esm-framework";
import { CloseLarge } from "@carbon/react/icons";
import { removeClaimItem } from "../../../../billing-claims.resource";

interface claimLineDetailsProps {
  claimInvoiceLines: ClaimInvoiceLine[];
  consentToken: string;
}
const ClaimInvoiceLineDetails: React.FC<claimLineDetailsProps> = ({ claimInvoiceLines, consentToken }) => {
  const sessionLocation = useSession();

  const handleRemoveClaimLine = async (claimInvoiceLine: ClaimInvoiceLine) => {
    try {
      const payload = {
        consentToken,
        lineGuid: claimInvoiceLine.id,
        locationUuid: sessionLocation?.sessionLocation?.uuid
      }
      await removeClaimItem(payload);
      showSnackbar({
        title: 'Success removing claim line',
        subtitle: 'Claim line removed successfully',
        kind: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'Error removing claim line',
        subtitle: error,
        kind: 'error',
      });
    }
  }

  return <>
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>No</TableHeader>
          <TableHeader>Item Code</TableHeader>
          <TableHeader>Item Name</TableHeader>
          <TableHeader>Intervention Code</TableHeader>
          <TableHeader>Line Total Amount</TableHeader>
          <TableHeader>Line Net Amount</TableHeader>
          <TableHeader>Quantity</TableHeader>
          <TableHeader>Unit</TableHeader>
          <TableHeader>Unit Price</TableHeader>
          <TableHeader>Is Active</TableHeader>
          <TableHeader>Is Cancellation</TableHeader>
          <TableHeader>Is Return</TableHeader>
          <TableHeader>UHC Exceeded</TableHeader>
          <TableHeader>Charge Date</TableHeader>
          <TableHeader>Is Return</TableHeader>
          <TableHeader>Line Number</TableHeader>
          <TableHeader>Scheme Code</TableHeader>
          <TableHeader>Scheme Name</TableHeader>
          <TableHeader>Discount</TableHeader>
          <TableHeader>Action</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {claimInvoiceLines &&
          claimInvoiceLines.map((ci, index) => {
            return (
              <>
                <TableRow key={ci.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{ci.item_code}</TableCell>
                  <TableCell>{ci.item_name}</TableCell>
                  <TableCell>{ci.intervention_code}</TableCell>
                  <TableCell>{ci.line_total_amount}</TableCell>
                  <TableCell>{ci.line_net_amount}</TableCell>
                  <TableCell>{ci.quantity}</TableCell>
                  <TableCell>{ci.unit}</TableCell>
                  <TableCell>{ci.unit_price}</TableCell>
                  <TableCell>{ci.is_active}</TableCell>
                  <TableCell>{ci.is_cancellation}</TableCell>
                  <TableCell>{ci.is_return}</TableCell>
                  <TableCell>{ci.uhc_exceeded}</TableCell>
                  <TableCell>{formatDate(parseDate(ci.charge_date))}</TableCell>
                  <TableCell>{ci.is_return}</TableCell>
                  <TableCell>{ci.line_number}</TableCell>
                  <TableCell>{ci.scheme_code}</TableCell>
                  <TableCell>{ci.scheme_name}</TableCell>
                  <TableCell>{ci.discount}</TableCell>
                  <TableCell>
                    <Button
                      hasIconOnly
                      iconDescription="Remove claim line"
                      size="sm"
                      kind="danger"
                      onClick={async () => await handleRemoveClaimLine(ci)}
                      renderIcon={() => <CloseLarge />}
                    />

                  </TableCell>
                </TableRow>
              </>
            );
          })}
      </TableBody>
    </Table>
  </>
}
export default ClaimInvoiceLineDetails;