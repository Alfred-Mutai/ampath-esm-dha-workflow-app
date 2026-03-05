import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { type LineItem } from '../../../shared/types';
interface LineItemsProps {
  lineItems: LineItem[];
}
const LineItems: React.FC<LineItemsProps> = ({ lineItems }) => {
  if (!lineItems || lineItems.length === 0) {
    return <>No Data to Display</>;
  }
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Bill Item</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Quantity</TableHeader>
            <TableHeader>Price</TableHeader>
            <TableHeader>Total</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {lineItems.map((item, index) => {
            return (
              <>
                <TableRow id={item.uuid}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.billableService}</TableCell>
                  <TableCell>{item.paymentStatus}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>KES {item.price}</TableCell>
                  <TableCell>KES {item.price * item.quantity}</TableCell>
                </TableRow>
              </>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};
export default LineItems;
