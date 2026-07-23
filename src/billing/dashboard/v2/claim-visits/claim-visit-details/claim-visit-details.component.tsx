import React, { useEffect, useMemo, useState } from 'react';
import styles from './claim-visit-details.component.scss';
import { type PatientFacilityBillDetails, type ClaimsVisit, ApplicableDocumentType } from '../../types';
import { buildInvoiceRecords } from '../claim-invoice-details/claim-invoice-details.component';
import { buildInterventionRecords } from '../claim-intervention-details/claim-intervention-details.component';
import { buildDiagnosisRecords } from '../claim-diagnosis-details/claim-diagnosis-details.component';
import ClaimDoctors from '../claim-doctors/claim-doctors';
import RecordCards from '../shared/record-cards.component';
import { formatDate, launchWorkspace, parseDate, showSnackbar, useVisit } from '@openmrs/esm-framework';
import { Button, Tag } from '@carbon/react';
import CloseClaimModal from '../modal/close-claim/close-claim.modal';
import SubmitClaimModal from '../modal/submit-claim/submit-claim.modal';
import { endVisit, useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import AddClaimDoctorModal from '../modal/claim-doctors/add-claim-doctor/add-claim-doctor.modal';
import { VisitTypeUuids } from '../../../../../shared/constants/visit-types';
import { VisitType } from '../../../../../claims';
const money = (n: number | string) => `KES ${Number(n ?? 0).toLocaleString('en-KE')}`;

// Tag colour for a claim state / auth status.
const stateTagType = (value?: string): 'green' | 'red' | 'blue' | 'gray' => {
  const s = (value ?? '').toUpperCase();
  if (s === 'AUTHORIZED' || s === 'APPROVED' || s === 'PAID' || s === 'VALID') return 'green';
  if (s === 'REJECTED' || s === 'EXPIRED' || s === 'INVALID' || s === 'CANCELLED') return 'red';
  if (s === 'SUBMITTED' || s === 'PENDING' || s === 'DRAFT') return 'blue';
  return 'gray';
};

interface claimVisitDetailsProps {
  claimsVisit: ClaimsVisit;
  locationUuid: string;
  patientBillDetails?: PatientFacilityBillDetails;
  /** Hide the patient name / member number when a surrounding page already shows them
      (e.g. the bill-details patient header), to avoid repeating identity fields. */
  hidePatientIdentity?: boolean;
}
const ClaimVisitDetails: React.FC<claimVisitDetailsProps> = ({ claimsVisit, locationUuid, patientBillDetails, hidePatientIdentity }) => {
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

  // A claim can't be submitted to SHA without at least one recorded diagnosis.
  const hasDiagnosis = (claimsVisit?.claim_diagnoses ?? []).length > 0;

  // All hooks are above this point, so the early return is safe here.
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
      },
    });
  };

  // Actions only apply while the claim is still a draft (case-insensitive).
  const isDraft = (claimsVisit.workflow_state ?? '').trim().toLowerCase() === 'draft';

  return (
    <>
      <div className={styles.cvLayout}>
        <div className={styles.cvHeader}>
          <div className={styles.cvHeaderText}>
            {/* State, Status and Scheme grouped together on the left; the long scheme
                name lives here as a meta item so it doesn't crowd the action buttons. */}
            <div className={styles.cvHeaderTags}>
              {claimsVisit.workflow_state ? (
                <span className={styles.cvMeta}>
                  <span className={styles.cvMetaLabel}>State</span>
                  <Tag size="sm" type={stateTagType(claimsVisit.workflow_state)}>{claimsVisit.workflow_state}</Tag>
                </span>
              ) : null}
              {claimsVisit.claim_auth_status ? (
                <span className={styles.cvMeta}>
                  <span className={styles.cvMetaLabel}>Status</span>
                  <Tag size="sm" type={stateTagType(claimsVisit.claim_auth_status)}>{claimsVisit.claim_auth_status}</Tag>
                </span>
              ) : null}
              {claimsVisit.scheme_name ? (
                <span className={styles.cvMeta}>
                  <span className={styles.cvMetaLabel}>Scheme</span>
                  <span className={styles.cvSchemeValue}>{claimsVisit.scheme_name}</span>
                </span>
              ) : null}
            </div>
          </div>
          {/* Close / Submit only while the claim is still a draft. */}
          {isDraft ? (
            <div className={styles.cvActions}>
              <Button kind="danger--tertiary" size="sm" onClick={displayCloseClaimModal}>
                Close claim
              </Button>
              {/* Disabled buttons don't emit hover events in some browsers, so the wrapping
                  span carries the title to explain why submission is blocked. */}
              <span
                className={styles.submitClaimWrap}
                title={hasDiagnosis ? undefined : 'A diagnosis must be recorded before this claim can be submitted.'}
              >
                <Button
                  kind="primary"
                  size="sm"
                  onClick={displayCloseSubmitClaimModal}
                  disabled={!hasDiagnosis}
                >
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
              </span>
            </div>
          ) : null}
        </div>

        <section className={styles.card}>
          <dl className={styles.detailsGrid}>
            {!hidePatientIdentity ? (
              <>
                <div className={styles.detailRow}>
                  <dt>Name</dt>
                  <dd>{claimsVisit.patient_name}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Member number</dt>
                  <dd>{claimsVisit.member_number}</dd>
                </div>
              </>
            ) : null}
            <div className={styles.detailRow}>
              <dt>Scheme code</dt>
              <dd>{claimsVisit.scheme_code}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Service type</dt>
              <dd>{claimsVisit.service_type}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Provider</dt>
              <dd>{claimsVisit.provider_name}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Visit start</dt>
              <dd>{formatDate(parseDate(claimsVisit.visit_start))}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Total amount</dt>
              <dd>{money(claimsVisit.total_claim_amount)}</dd>
            </div>
            {/* Net only differs from the gross when a discount or co-pay applies; when
                they match, one figure says it all — so the duplicate row is dropped. */}
            {Number(claimsVisit.total_claim_net_amount ?? 0) !== Number(claimsVisit.total_claim_amount ?? 0) ? (
              <div className={styles.detailRow}>
                <dt>Net amount</dt>
                <dd>{money(claimsVisit.total_claim_net_amount)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Each category is its own section on its own row, all using the same grid
            approach (fills the row when few, up to three across). */}
        <section className={styles.section}>
          <h5 className={styles.sectionTitle}>Invoices</h5>
          <RecordCards
            records={buildInvoiceRecords(claimsVisit.invoices ?? [], claimsVisit.authorization_code)}
            emptyMessage="No invoices on this claim."
            layout="grid"
          />
        </section>

        <section className={styles.section}>
          <h5 className={styles.sectionTitle}>Interventions</h5>
          <RecordCards
            records={buildInterventionRecords(claimsVisit.interventions ?? [], {
              consentToken: claimsVisit.authorization_code,
              locationUuid,
              claimAttachments: claimsVisit.claim_attachments ?? [],
              bill: patientBillDetails,
            })}
            emptyMessage="No interventions on this claim."
            layout="grid"
          />
        </section>

        <section className={styles.section}>
          <h5 className={styles.sectionTitle}>Diagnosis</h5>
          <RecordCards
            records={buildDiagnosisRecords(claimsVisit.claim_diagnoses ?? [])}
            emptyMessage="No diagnosis data."
            layout="grid"
          />
        </section>

        <section className={styles.section}>
          <h5 className={styles.sectionTitle}>Doctors</h5>
          <ClaimDoctors claimDoctors={claimsVisit.claim_doctors ?? []} />
        </section>
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
