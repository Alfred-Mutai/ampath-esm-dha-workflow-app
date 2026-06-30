import React from 'react';
import styles from './claim-visit-details.component.scss';
import { type ClaimsVisit } from '../../types';
import ClaimInvoiceDetails from '../claim-invoice-details/claim-invoice-details.component';
import ClaimInterventionDetails from '../claim-intervention-details/claim-intervention-details.component';
import ClaimDiagnosisDetails from '../claim-diagnosis-details/claim-diagnosis-details.component';
import { formatDate, parseDate } from '@openmrs/esm-framework';
interface claimVisitDetailsProps {
  claimsVisit: ClaimsVisit;
}
const ClaimVisitDetails: React.FC<claimVisitDetailsProps> = ({ claimsVisit }) => {
  if (!claimsVisit) {
    return <>No Data</>;
  }
  return (
    <>
      <div className={styles.cvLayout}>
        <div className={styles.cvHeaderSection}>
          <h4>Claim Visit Details</h4>
        </div>
        <div className={styles.cvContentSection}>
          <div className={styles.cvRow}>
            <div className={styles.cvWidth}>
              <span>State : {claimsVisit.workflow_state}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Status : {claimsVisit.claim_auth_status}</span>
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvWidth}>
              <span>Total Amount : {claimsVisit.total_claim_amount}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Total Net Amount : {claimsVisit.total_claim_net_amount}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Total Co-Pay : {claimsVisit.total_claim_copay}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Total Claim Discount: {claimsVisit.total_claim_discount}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Total Claim Status: {claimsVisit.total_claim_discount}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Total Claim Splits: {claimsVisit.total_claim_splits}</span>
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvWidth}>
              <span>Name : {claimsVisit.patient_name}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Member Number : {claimsVisit.member_number}</span>
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvWidth}>
              <span>Scheme Code : {claimsVisit.scheme_code}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Scheme Name : {claimsVisit.scheme_name}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Provider : {claimsVisit.provider_name}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Service Type : {claimsVisit.service_type}</span>
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvWidth}>
              <span>Visit Start : {formatDate(parseDate(claimsVisit.visit_start))}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>No of Invoices : {claimsVisit.number_of_invoices}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Diagnosis Count : {claimsVisit.diagnoses_count}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Attachments Count : {claimsVisit.claim_attachments_count}</span>
            </div>
            <div className={styles.cvWidth}>
              <span>Invoice Attachment Count : {claimsVisit.invoice_attachments_count}</span>
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
              <h6>Dignosis</h6>
            </div>
            <div className={styles.cvRow}>
              {claimsVisit.claim_diagnoses && <ClaimDiagnosisDetails claimDiagnosiss={claimsVisit.claim_diagnoses} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
export default ClaimVisitDetails;
