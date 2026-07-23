import React, { useEffect, useMemo, useState } from 'react';
import styles from './claim-visit-details.component.scss';
import { type PatientFacilityBillDetails, type ClaimsVisit, ApplicableDocumentType } from '../../types';
import ClaimInvoiceDetails from '../claim-invoice-details/claim-invoice-details.component';
import ClaimInterventionDetails from '../claim-intervention-details/claim-intervention-details.component';
import ClaimDiagnosisDetails from '../claim-diagnosis-details/claim-diagnosis-details.component';
import { formatDate, launchWorkspace, parseDate, showSnackbar, useVisit } from '@openmrs/esm-framework';
import { Button } from '@carbon/react';
import CloseClaimModal from '../modal/close-claim/close-claim.modal';
import SubmitClaimModal from '../modal/submit-claim/submit-claim.modal';
import { endVisit, useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import ClaimDocuments from '../claim-documents/claim-documents';
import ClaimDoctors from '../claim-doctors/claim-doctors';
import AddClaimDoctorModal from '../modal/claim-doctors/add-claim-doctor/add-claim-doctor.modal';
import { VisitTypeUuids } from '../../../../../shared/constants/visit-types';
import { VisitType } from '../../../../../claims';
interface claimVisitDetailsProps {
  claimsVisit: ClaimsVisit;
  locationUuid: string;
  patientBillDetails?: PatientFacilityBillDetails;
  onBillDetailsChange?: () => void;
}
const ClaimVisitDetails: React.FC<claimVisitDetailsProps> = ({
  claimsVisit,
  locationUuid,
  patientBillDetails,
  onBillDetailsChange,
}) => {
  const [showCloseClaimModal, setShowCloseClaimModal] = useState<boolean>();
  const [showSubmitClaimModal, setSubmitCloseClaimModal] = useState<boolean>(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState<boolean>(false);
  const [triggerEndVisit, setTriggerEndVisit] = useState<boolean>(false);
  const { activeVisit } = useVisit(patientBillDetails?.patient_uuid);

  const invoiceNumber = useMemo(() => {
    if (patientBillDetails) {
      return patientBillDetails.receipt_number;
    }
    return '';
  }, [patientBillDetails]);

  useEffect(() => {
    if (triggerEndVisit && activeVisit) {
      handleCloseVisit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerEndVisit, activeVisit]);

  function handleCloseVisit() {
    endVisit(activeVisit?.uuid)
      .then((v) => {
        showSnackbar({
          title: 'Success closing claim',
          kind: 'success',
          subtitle: 'Claim closed successfully',
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }

  const visitType: VisitType = useMemo(() => {
    if (activeVisit) {
      const visitTypeUuid = activeVisit?.visitType?.uuid;
      if (visitTypeUuid) {
        if (visitTypeUuid === VisitTypeUuids.OPD_VISIT_TYPE_UUID) {
          return 'OUTPATIENT';
        }
        if (visitTypeUuid === VisitTypeUuids.INPATIENT_VISIT_TYPE_UUID) {
          return 'INPATIENT';
        }
      }
    }
    return 'OUTPATIENT';
  }, [activeVisit, VisitTypeUuids]);

  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();

  if (!claimsVisit) {
    return <>No Data</>;
  }

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
    setTriggerEndVisit(true);
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

  const handleSwitchIntervention = () => {
    launchWorkspace('switch-intervention-workspace', {
      consentToken: claimsVisit.authorization_code,
      currentInterventions: claimsVisit.interventions,
      patientId: patientBillDetails?.cr_no ?? claimsVisit.patient_number,
      patientUuid: patientBillDetails?.patient_uuid,
      visitUuid: activeVisit?.uuid,
      billDate: patientBillDetails?.bill_date ?? claimsVisit.visit_start,
      onSwitchSuccess: () => {
        invalidateProviderClaimPreview();
        onBillDetailsChange?.();
      },
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
            <Button
              kind="tertiary"
              onClick={handleSwitchIntervention}
              disabled={
                !claimsVisit.interventions?.some((iv) => (iv.workflow_state ?? '').toUpperCase() === 'ACTIVE')
              }
            >
              Switch Intervention
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
              {claimsVisit.interventions && (
                <ClaimInterventionDetails
                  patientBillDetails={patientBillDetails}
                  claimInterventions={claimsVisit.interventions}
                  consentToken={claimsVisit.authorization_code}
                />
              )}
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
          visitType={visitType}
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
