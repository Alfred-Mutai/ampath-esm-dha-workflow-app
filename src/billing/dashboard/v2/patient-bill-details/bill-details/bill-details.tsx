import React from 'react';
import { type PatientPayment, type PatientFacilityBillDetails } from '../../types';
import styles from './bill-details.scss';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';

interface billDetailsProps {
  patientBillDetails: PatientFacilityBillDetails[];
  patientPayments: PatientPayment[];
}
const BillDetails: React.FC<billDetailsProps> = ({ patientBillDetails, patientPayments }) => {
  if (!patientBillDetails && !patientPayments) {
    return <>No Data</>;
  }
  return (
    <>
      <div className={styles.billDetailsLayout}>
        {patientBillDetails.length > 0 ? (
          <>
            <div className={styles.billRow}>
              <div>
                <h6>Bill Items</h6>
              </div>
              <div>
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
                      patientBillDetails.map((b, index) => {
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
            </div>
          </>
        ) : (
          <></>
        )}
        {patientPayments.length > 0 ? (
          <>
            <div className={styles.billRow}>
              <div>
                <h6>Bill Payments</h6>
              </div>
              <div>
                <Table aria-label="sample table" size="lg">
                  <TableHead>
                    <TableRow>
                      <TableHeader>No</TableHeader>
                      <TableHeader>Payment Type</TableHeader>
                      <TableHeader>Amount</TableHeader>
                      <TableHeader>Amount Tendered</TableHeader>
                      <TableHeader>Date / Time</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientPayments &&
                      patientPayments.map((p, index) => {
                        return (
                          <>
                            <TableRow key={p.cashier_bill_payment_uuid}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{p.payment_mode}</TableCell>
                              <TableCell>Ksh {p.amount}</TableCell>
                              <TableCell>Ksh {p.amount_tendered}</TableCell>
                              <TableCell>{formatDate(parseDate(p.payment_time))}</TableCell>
                            </TableRow>
                          </>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <></>
        )}
      </div>
    </>
  );
};
export default BillDetails;
