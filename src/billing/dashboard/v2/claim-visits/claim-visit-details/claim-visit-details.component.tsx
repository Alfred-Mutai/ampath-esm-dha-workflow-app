import React, { useMemo, useState } from 'react';
import styles from './claim-visit-details.component.scss';
import { type PatientFacilityBillDetails, type ClaimsVisit, ApplicableDocumentType } from '../../types';
import ClaimInvoiceDetails from '../claim-invoice-details/claim-invoice-details.component';
import ClaimInterventionDetails from '../claim-intervention-details/claim-intervention-details.component';
import ClaimDiagnosisDetails from '../claim-diagnosis-details/claim-diagnosis-details.component';
import { formatDate, launchWorkspace, parseDate } from '@openmrs/esm-framework';
import { Button } from '@carbon/react';
import CloseClaimModal from '../modal/close-claim/close-claim.modal';
import SubmitClaimModal from '../modal/submit-claim/submit-claim.modal';
import { useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import ClaimDocuments from '../claim-documents/claim-documents';
import ClaimDoctors from '../claim-doctors/claim-doctors';
import AddClaimDoctorModal from '../modal/claim-doctors/add-claim-doctor/add-claim-doctor.modal';
interface claimVisitDetailsProps {
  claimsVisit: ClaimsVisit;
  locationUuid: string;
  patientBillDetails?: PatientFacilityBillDetails;
}
const ClaimVisitDetails: React.FC<claimVisitDetailsProps> = ({ claimsVisit, locationUuid, patientBillDetails }) => {
  const [showCloseClaimModal, setShowCloseClaimModal] = useState<boolean>();
  const [showSubmitClaimModal, setSubmitCloseClaimModal] = useState<boolean>(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState<boolean>(false);

  const invoiceNumber = useMemo(() => {
    if (patientBillDetails) {
      return patientBillDetails.receipt_number;
    }
    return '';
  }, [patientBillDetails]);

  if (!claimsVisit) {
    return <>No Data</>;
  }

  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();

  function displayCloseClaimModal() {
    setShowCloseClaimModal(true);
  }
  function handleCloseClaimModal() {
    setShowCloseClaimModal(false);
  }
  function displayCloseSubmitClaimModal() {
    setSubmitCloseClaimModal(true);
  }
  function handleCloseSubmitClaimModal() {
    setSubmitCloseClaimModal(false);
  }
  function onSubmitSuccess() {
    handleCloseSubmitClaimModal();
    invalidateProviderClaimPreview();
  }
  function onCloseSuccess() {
    handleCloseClaimModal();
    invalidateProviderClaimPreview();
  }
  function handleAddDoctor() {
    setShowAddDoctorModal(true);
  }
  function handleCloseAddDoctorModal() {
    setShowAddDoctorModal(false);
  }

  const handleAddAttachment = () => {
    launchWorkspace('upload-intervention-attachments-workspace', {
      consentToken: claimsVisit.authorization_code,
      patientUuid: '10',
      claimInterventions: claimsVisit.interventions,
      bill: patientBillDetails,
    });
  };

  const handleGenerateAttachment = () => {
    launchWorkspace('generate-intervention-attachments-workspace', {
      consentToken: claimsVisit.authorization_code,
      patientUuid: '10',
      claimInterventions: claimsVisit.interventions,
      bill: patientBillDetails,
    });
  };
  return (
    <>
      <div className={styles.cvLayout}>
        <div className={styles.cvHeaderSection}>
          <div className={styles.headerTitle}>
            <h4>Claim Visit Details</h4>
          </div>
          <div className={styles.headerAction}>
            <Button kind="primary" onClick={displayCloseClaimModal}>
              Close Claim
            </Button>
            <Button kind="tertiary" onClick={displayCloseSubmitClaimModal}>
              Submit claim
            </Button>
          </div>
        </div>
        <div className={styles.cvContentSection}>
          <div className={styles.cvRow}>
            <div className={styles.cvWidth}>
              <ul className={styles.claimList}>
                <li>
                  <strong>State :</strong> {claimsVisit.workflow_state}{' '}
                </li>
                <li>
                  <strong>Status : </strong>
                  {claimsVisit.claim_auth_status}
                </li>
                <li>
                  <strong>Name :</strong> {claimsVisit.patient_name}
                </li>
                <li>
                  <strong>Member Number :</strong> {claimsVisit.member_number}
                </li>
                <li>
                  <strong>Scheme Code :</strong> {claimsVisit.scheme_code}
                </li>
                <li>
                  <strong>Scheme Name :</strong> {claimsVisit.scheme_name}
                </li>
                <li>
                  <strong>Service Type :</strong> {claimsVisit.service_type}
                </li>
                <li>
                  <strong>Provider :</strong> {claimsVisit.provider_name}
                </li>
                <li>
                  <strong>Visit Start :</strong> {formatDate(parseDate(claimsVisit.visit_start))}{' '}
                </li>
              </ul>
            </div>
            <div className={styles.cvWidth}>
              <ul className={styles.claimList}>
                <li>
                  <strong>Total Amount :</strong> {claimsVisit.total_claim_amount}
                </li>
                <li>
                  <strong>Total Net Amount :</strong> {claimsVisit.total_claim_net_amount}
                </li>
              </ul>
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvRow}>
              <h6>Invoices</h6>
            </div>
            <div className={styles.cvRow}>
              {claimsVisit.invoices && (
                <ClaimInvoiceDetails
                  claimInvoices={claimsVisit.invoices}
                  consentToken={claimsVisit.authorization_code}
                />
              )}
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
          <div className={styles.cvRow}>
            <div className={styles.cvRow}>
              <h6>Doctors</h6>
            </div>
            <div className={styles.cvRow}>{<ClaimDoctors claimDoctors={claimsVisit.claim_doctors ?? []} />}</div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvRow}>
              <div className={styles.generateButtonSection}>
                <Button onClick={handleAddAttachment}>Add Attachments</Button>
                <Button onClick={handleGenerateAttachment}>Generate Attachments</Button>
              </div>
            </div>
          </div>
          <div className={styles.cvRow}>
            <div className={styles.cvRow}>
              <h6>Attachments</h6>
            </div>
            <div className={styles.cvRow}>
              {<ClaimDocuments claimAttachments={claimsVisit.claim_attachments ?? []} />}
            </div>
          </div>
        </div>
      </div>
      {showCloseClaimModal && (
        <CloseClaimModal
          locationUuid={locationUuid}
          open={showCloseClaimModal}
          onClose={handleCloseClaimModal}
          onSuccess={onCloseSuccess}
          consentToken={claimsVisit.authorization_code}
        />
      )}
      {showSubmitClaimModal && (
        <SubmitClaimModal
          locationUuid={locationUuid}
          open={showSubmitClaimModal}
          onClose={handleCloseSubmitClaimModal}
          onSuccess={onSubmitSuccess}
          claimsVisit={claimsVisit}
          invoiceNumber={invoiceNumber}
        />
      )}
      {showAddDoctorModal && (
        <AddClaimDoctorModal
          open={showAddDoctorModal}
          handleClose={handleCloseAddDoctorModal}
          claimDoctors={[]}
          consentToken={claimsVisit.authorization_code}
        />
      )}
    </>
  );
};
export default ClaimVisitDetails;
