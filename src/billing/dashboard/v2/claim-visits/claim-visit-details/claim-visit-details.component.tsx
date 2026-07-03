import React, { useState } from 'react';
import styles from './claim-visit-details.component.scss';
import { type ClaimsVisit } from '../../types';
import ClaimInvoiceDetails from '../claim-invoice-details/claim-invoice-details.component';
import ClaimInterventionDetails from '../claim-intervention-details/claim-intervention-details.component';
import ClaimDiagnosisDetails from '../claim-diagnosis-details/claim-diagnosis-details.component';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import { Button } from '@carbon/react';
import CloseClaimModal from '../modal/close-claim/close-claim.modal';
interface claimVisitDetailsProps {
  claimsVisit: ClaimsVisit;
  locationUuid: string;
}
const ClaimVisitDetails: React.FC<claimVisitDetailsProps> = ({ claimsVisit, locationUuid }) => {
  const [showCloseClaimModal,setShowCloseClaimModal] = useState<boolean>();
  if (!claimsVisit) {
    return <>No Data</>;
  }
  function displayCloseClaimModal(){
    setShowCloseClaimModal(true);
  }
  function handleCloseClaimModal(){
    setShowCloseClaimModal(false);
  }
  return (
    <>
      <div className={styles.cvLayout}>
        <div className={styles.cvHeaderSection}>
          <div className={styles.headerTitle}>
              <h4>Claim Visit Details</h4>
          </div>
          <div className={styles.headerAction}>
             <Button kind='primary' onClick={displayCloseClaimModal}>Close Claim</Button>
          </div>
        </div>
        <div className={styles.cvContentSection}>
          <div className={styles.cvRow}>
            <div className={styles.cvWidth}>
                <ul className={styles.claimList}>
                  <li><strong>State :</strong> {claimsVisit.workflow_state} </li>
                  <li><strong>Status : </strong>{claimsVisit.claim_auth_status}</li>
                  <li><strong>Name :</strong>  {claimsVisit.patient_name}</li>
                  <li><strong>Member Number :</strong> {claimsVisit.member_number}</li>
                  <li><strong>Scheme Code :</strong> {claimsVisit.scheme_code}</li>
                  <li><strong>Scheme Name :</strong> {claimsVisit.scheme_name}</li>
                  <li><strong>Service Type :</strong> {claimsVisit.service_type}</li>
                  <li><strong>Provider :</strong> {claimsVisit.provider_name}</li>
                  <li><strong>Visit Start :</strong> {formatDate(parseDate(claimsVisit.visit_start))} </li>
                 
                </ul>
            </div>
            <div className={styles.cvWidth}>
                <ul className={styles.claimList}>
                  <li><strong>Total Amount :</strong> {claimsVisit.total_claim_amount}</li>
                  <li><strong>Total Net Amount :</strong> {claimsVisit.total_claim_net_amount}</li>
                  <li><strong>Total Co-Pay :</strong> {claimsVisit.total_claim_copay}</li>
                  <li><strong>Total Claim Discount:</strong> {claimsVisit.total_claim_discount}</li>
                  <li><strong>Total Claim Splits:</strong> {claimsVisit.total_claim_splits}</li>
                  <li><strong>No of Invoices : </strong>{claimsVisit.number_of_invoices}</li>
                  <li><strong>Diagnosis Count :</strong> {claimsVisit.diagnoses_count}</li>
                  <li><strong>Attachments Count :</strong> {claimsVisit.claim_attachments_count}</li>
                  <li><strong>Invoice Attachment Count :</strong> {claimsVisit.invoice_attachments_count}</li>
                </ul>
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvRow}>
              <h6>Invoices</h6>
            </div>
            <div className={styles.cvRow}>
              {claimsVisit.invoices && <ClaimInvoiceDetails claimInvoices={claimsVisit.invoices} />}
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvRow}>
              <h6>Interventions</h6>
            </div>
            <div className={styles.cvRow}>
              {claimsVisit.interventions && <ClaimInterventionDetails claimInterventions={claimsVisit.interventions} />}
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvRow}>
              <h6>Diagnosis</h6>
            </div>
            <div className={styles.cvRow}>
              {claimsVisit.claim_diagnoses && <ClaimDiagnosisDetails claimDiagnosiss={claimsVisit.claim_diagnoses} />}
            </div>
          </div>
        </div>
      </div>
      {
        showCloseClaimModal && <CloseClaimModal 
          locationUuid={locationUuid}
          open={showCloseClaimModal}
          onClose={handleCloseClaimModal}
          onSuccess={handleCloseClaimModal}
          consentToken={claimsVisit.authorization_code}
        />
      }
    </>
  );
};
export default ClaimVisitDetails;
