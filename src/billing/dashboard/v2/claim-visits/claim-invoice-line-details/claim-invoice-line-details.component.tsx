import React from "react";
import { type ClaimInvoiceLine } from "../../types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import { formatDate, parseDate } from "@openmrs/esm-framework";

interface claimLineDetailsProps {
    claimInvoiceLines: ClaimInvoiceLine[] 
}
const ClaimInvoiceLineDetails: React.FC<claimLineDetailsProps> = ({claimInvoiceLines})=>{
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
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>
  </>
}
export default ClaimInvoiceLineDetails;