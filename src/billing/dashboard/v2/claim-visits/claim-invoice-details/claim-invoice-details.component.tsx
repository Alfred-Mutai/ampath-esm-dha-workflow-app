import React, { useState } from "react";
import styles from './claim-invoice-details.component.scss';
import { type ClaimInvoiceLine, type ClaimVisitInvoince } from "../../types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import { formatDate, parseDate } from "@openmrs/esm-framework";
import ClaimInvoiceLinesModal from "../modal/claim-invoice-lines/claim-invoice-lines.modal";

interface claimInvoiceDetailsProps {
    claimInvoices: ClaimVisitInvoince[]
}
const ClaimInvoiceDetails: React.FC<claimInvoiceDetailsProps> = ({claimInvoices})=>{
   const [showClaimInvoiceLinesModal,setShowClaimInvoiceLinesModal] = useState<boolean>();
   const [selectedClaimInvoiceLines,setSelectedClaimInvoiceLines] = useState<ClaimInvoiceLine[]>([]);
   if(!claimInvoices || claimInvoices.length === 0){
      return <>No Invoice data</>
   }
   function handleClose(){
     setShowClaimInvoiceLinesModal(false);
   }
   function showClaimLinesModal(claimInvoiceLines: ClaimInvoiceLine[]){
     setSelectedClaimInvoiceLines(claimInvoiceLines);
     setShowClaimInvoiceLinesModal(true);
   }
   return <>
   <Table>
          <TableHead>
            <TableRow>
              <TableHeader>No</TableHeader>
              <TableHeader>Invoice No</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Dispatch Status</TableHeader>
              <TableHeader>State</TableHeader>
              <TableHeader>Patient</TableHeader>
              <TableHeader>Provider</TableHeader>
              <TableHeader>Lines</TableHeader>
              <TableHeader>Scheme</TableHeader>
              <TableHeader>Service Type</TableHeader>
              <TableHeader>Amount</TableHeader>
              <TableHeader>Net</TableHeader>
              <TableHeader>Co-Pay</TableHeader>
              <TableHeader>Discount</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {claimInvoices &&
              claimInvoices.map((ci, index) => {
                return (
                  <>
                    <TableRow key={ci.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{ci.invoice_number}</TableCell>
                      <TableCell>{formatDate(parseDate(ci.invoice_date))}</TableCell>
                      <TableCell>{ci.dispatch_status}</TableCell>
                      <TableCell>{ci.workflow_state}</TableCell>
                      <TableCell>{ci.patient_name}</TableCell>
                      <TableCell>{ci.provider_name}</TableCell>
                      <TableCell>
                        <div className={styles.linkBtn} onClick={()=>showClaimLinesModal(ci.lines)}>{ci.lines.length}</div>
                      </TableCell>
                      <TableCell>{ci.scheme_code}</TableCell>
                      <TableCell>{ci.service_type}</TableCell>
                      <TableCell>{ci.total_inv_amount}</TableCell>
                      <TableCell>{ci.total_inv_net_amount}</TableCell>
                      <TableCell>{ci.total_inv_copay}</TableCell>
                      <TableCell>{ci.total_inv_discount}</TableCell>
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>

        {
          showClaimInvoiceLinesModal && <ClaimInvoiceLinesModal 
          claimInvoiceLines={selectedClaimInvoiceLines}
          open={showClaimInvoiceLinesModal}
          handleClose={handleClose}
          />
        }
   </>
};

export default ClaimInvoiceDetails;