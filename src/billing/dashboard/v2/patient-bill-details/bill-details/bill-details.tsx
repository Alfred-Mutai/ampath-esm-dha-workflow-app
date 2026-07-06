import React, { useMemo, useState } from 'react';
import { type PatientPayment, type PatientFacilityBillDetails } from '../../types';
import styles from './bill-details.scss';
import { OverflowMenu, OverflowMenuItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import BillItemPaymentModal from '../modals/bill-item-payment/bill-item-payment.modal';
import AddClaimLineModal from '../modals/add-claim-line/add-claim-line.modal';
import { type AmrsVisitDiagnosis } from '../../../../types';
import VisitDiagnosisDetails from '../visit-diagnosis-details/visit-diagnosis-details.component';

interface billDetailsProps {
  patientBillDetails: PatientFacilityBillDetails[];
  patientPayments: PatientPayment[];
  amrsVisitDiagnosis: AmrsVisitDiagnosis[];
  consentToken: string;
  locationUuid: string;
}
const BillDetails: React.FC<billDetailsProps> = ({ patientBillDetails, patientPayments, amrsVisitDiagnosis, consentToken, locationUuid }) => {
  const [showPaymentModal,setShowPaymentModal] = useState<boolean>(false);
  const [showAddClaimLineModal,setShowAddClaimLineModal] = useState<boolean>(false);
  const [selectedBillItem,setSelectedBillItem] = useState<PatientFacilityBillDetails | null>(null);
  const setDiagnosisInterventionCode = useMemo(()=>getConsultationBillIntervantionCode(),[patientBillDetails]);
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
  function getConsultationBillIntervantionCode(){
    if(!patientBillDetails || patientBillDetails.length === 0){
        return '';
    }
     const consultationBill = patientBillDetails.find((b)=>{
        return b.billable_service.toLocaleLowerCase().trim().includes('consultation');
     });
    if(consultationBill){
       return consultationBill.intervention_code;
    }else{
      return patientBillDetails[0].intervention_code ?? '';
    }
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
                      <TableHeader>Payment Status</TableHeader>
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
                              <TableCell>{b.payment_status}</TableCell>
                              <TableCell>{b.item_quantity}</TableCell>
                              <TableCell>Ksh {b.item_total_price}</TableCell>
                              <TableCell>
                                <OverflowMenu aria-label="overflow-menu">
                                  {
                                    (b.payment_status !== 'PAID') && <OverflowMenuItem itemText="Pay" onClick={() => handleBillItemPayment(b)} />
                                  }
                                  {
                                    (b.intervention_code && b.has_claim_line === 0) && <OverflowMenuItem itemText="Add Claim Line" onClick={() => handleClaimLineAddition(b)} />
                                  }
                              </OverflowMenu>
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
          amrsVisitDiagnosis.length > 0 ? (<>
           <div className={styles.billRow}>
              <div>
                <h6>Patient Dignosis</h6>
              </div>
              <div>
             <VisitDiagnosisDetails 
              amrsVisitDiagnosis={amrsVisitDiagnosis}
              consentToken={consentToken}
              locationUuid={locationUuid}
              interventionCode={setDiagnosisInterventionCode}
             />
             </div>
          </div>
          
          </>):(<></>)
        }
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
