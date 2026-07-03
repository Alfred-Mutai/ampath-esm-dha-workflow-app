import React, { useState } from 'react';
import { type PatientPayment, type PatientFacilityBillDetails } from '../../types';
import styles from './bill-details.scss';
import { OverflowMenu, OverflowMenuItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import BillItemPaymentModal from '../modals/bill-item-payment/bill-item-payment.modal';
import AddClaimLineModal from '../modals/add-claim-line/add-claim-line.modal';

interface billDetailsProps {
  patientBillDetails: PatientFacilityBillDetails[];
  patientPayments: PatientPayment[];
  locationUuid: string;
}
const BillDetails: React.FC<billDetailsProps> = ({ patientBillDetails, patientPayments, locationUuid }) => {
  const [showPaymentModal,setShowPaymentModal] = useState<boolean>(false);
  const [showAddClaimLineModal,setShowAddClaimLineModal] = useState<boolean>(false);
  const [selectedBillItem,setSelectedBillItem] = useState<PatientFacilityBillDetails | null>(null);
  if (!patientBillDetails && !patientPayments) {
    return <>No Data</>;
  }
  function handleBillItemPayment(patientBillDetail: PatientFacilityBillDetails){
      setSelectedBillItem(patientBillDetail);
      setShowPaymentModal(true);
  }
  function handleClosePayModal(){
     setShowPaymentModal(false);
  }
  function handleSuccessfullPayment(){
    handleClosePayModal();
  }
  function handleClaimLineAddition(patientBillDetail: PatientFacilityBillDetails){
    setSelectedBillItem(patientBillDetail);
    setShowAddClaimLineModal(true);
  }
  function handleCloseAddClaimItemModal(){
     setShowAddClaimLineModal(false);
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
                      <TableHeader>Intervention Code</TableHeader>
                      <TableHeader>Order No</TableHeader>
                      <TableHeader>Service Type</TableHeader>
                      <TableHeader>Payer</TableHeader>
                      <TableHeader>Quantity</TableHeader>
                      <TableHeader>Total</TableHeader>
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
                              <TableCell>{b.intervention_code ?? ''}</TableCell>
                              <TableCell>{b.order_no ?? ''}</TableCell>
                              <TableCell>{b.service_type ?? ''}</TableCell>
                              <TableCell>{b.payment_scheme}</TableCell>
                              <TableCell>{b.item_quantity}</TableCell>
                              <TableCell>Ksh {b.item_total_price}</TableCell>
                              <TableCell>
                                {
                                  (b.paid_status === 'PENDING' ||  b.paid_status === 'POSTED') ? (<>
                                   <OverflowMenu aria-label="overflow-menu">
                                      <OverflowMenuItem itemText="Pay" onClick={() => handleBillItemPayment(b)} />
                                        {
                                          b.intervention_code && <OverflowMenuItem itemText="Add Claim Line" onClick={() => handleClaimLineAddition(b)} />
                                        }
                                      
                                    </OverflowMenu>
                                  </>): (<></>)
                                }
                                
                              </TableCell>
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
                              <TableCell>
                                {formatDate(parseDate(p.payment_time))}</TableCell>
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
        {
          (showPaymentModal && selectedBillItem) && <BillItemPaymentModal 
          open={showPaymentModal} 
          billItem={selectedBillItem}
          onClose={handleClosePayModal} 
          onPay={handleSuccessfullPayment}/>
        }
        {
          (showAddClaimLineModal && selectedBillItem) && <AddClaimLineModal 
           open={showAddClaimLineModal}
           billItem={selectedBillItem}
           onClose={handleCloseAddClaimItemModal}
           onSuccess={handleCloseAddClaimItemModal}
           locationUuid={locationUuid}
          />
        }
      </div>
    </>
  );
};
export default BillDetails;
