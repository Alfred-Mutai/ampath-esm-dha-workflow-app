import React, { forwardRef } from 'react';
import { type VisitIntervention } from '../../types';
import styles from './attachments.scss';

interface FinalBillComponentProps {
  bill?: any;
}

const FinalBillComponent = forwardRef<HTMLDivElement, FinalBillComponentProps>(({ bill }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        all: 'initial',
        display: 'block',
        fontFamily: 'Arial',
        fontSize: '10px',
        width: '190mm',
        padding: '10mm',
        background: '#fff',
        boxSizing: 'border-box',
      }}
    >
      <h1>KESSES SUB-COUNTY HOSPITAL</h1>
      <hr />
      <h2>FINAL BILL</h2>
      <p>
        <strong>Patient:</strong> {bill.patient_name}
      </p>
      <p>
        <strong>Claim Number:</strong> CLM-001245
      </p>
      <p>
        <strong>Date:</strong> {bill.bill_date}
      </p>
      <div className={styles.invoice}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '20px',
          }}
        >
          <thead>
            <tr>
              <th>Bill Item</th>
              <th>Intervention Code</th>
              <th>Order No</th>
              <th>Service Type</th>
              <th>Payer</th>
              <th>Payment Status</th>
              <th>Quantity</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>{bill.billable_service}</td>
              <td>{bill.intervention_code}</td>
              <td>{bill.order_no}</td>
              <td>{bill.service_type}</td>
              <td>{bill.payment_scheme}</td>
              <td>{bill.payment_status}</td>
              <td>{bill.item_quantity}</td>
              <td>{bill.item_price}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default FinalBillComponent;
