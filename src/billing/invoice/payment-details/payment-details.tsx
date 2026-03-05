import React from 'react';
import { type Payment } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
interface PaymentDetailsProps {
  payments: Payment[];
}
const PaymentDetails: React.FC<PaymentDetailsProps> = ({ payments }) => {
  if (!payments || payments.length === 0) {
    return <>No Data to Display</>;
  }
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Payment Method</TableHeader>
            <TableHeader>Amount Tendered</TableHeader>
            <TableHeader>Date</TableHeader>
            <TableHeader>Voided</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((item, index) => {
            return (
              <>
                <TableRow id={item.uuid}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.instanceType.name}</TableCell>
                  <TableCell>KES {item.amountTendered}</TableCell>
                  <TableCell>{formatDate(parseDate(new Date(item.dateCreated).toISOString()))}</TableCell>
                  <TableCell>{item.voided ? 'YES' : 'NO'}</TableCell>
                </TableRow>
              </>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};
export default PaymentDetails;
