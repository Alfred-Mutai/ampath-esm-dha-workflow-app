import React from "react";
import { type PatientFacilityBillDetails } from "../../types";
import styles from './bill-details.scss';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";

interface billDetailsProps {
    patientBillDetails: PatientFacilityBillDetails[];
}
const BillDetails: React.FC<billDetailsProps> = ({patientBillDetails})=>{
   if(!patientBillDetails){
       return <>No Data</>
   }
   return <>
     <div className={styles.billDetailsLayout}>
        <Table aria-label="sample table" size="lg">
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Bill Item</TableHeader>
            <TableHeader>Payer</TableHeader>
            <TableHeader>Quantity</TableHeader>
            <TableHeader>Total</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Select</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {patientBillDetails &&
            patientBillDetails.map((b,index) => {
              return (
                <>
                  <TableRow key={b.patient_uuid}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{b.billable_service}</TableCell>
                    <TableCell>{b.payment_scheme}</TableCell>
                    <TableCell>{b.item_quantity}</TableCell>
                    <TableCell>Ksh {b.item_total_price}</TableCell>
                    <TableCell>{b.paid_status}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </>
              );
            })}
        </TableBody>
      </Table>
     </div>
   </>
}
export default BillDetails;