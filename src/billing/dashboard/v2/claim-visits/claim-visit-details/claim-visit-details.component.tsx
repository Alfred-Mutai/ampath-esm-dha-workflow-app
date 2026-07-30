import React, { useEffect, useMemo, useState } from 'react';
import styles from './claim-visit-details.component.scss';
import { type PatientFacilityBillDetails, type ClaimsVisit, type VisitIntervention, ApplicableDocumentType } from '../../types';
import { buildInvoiceRecords } from '../claim-invoice-details/claim-invoice-details.component';
import { buildInterventionRecords } from '../claim-intervention-details/claim-intervention-details.component';
import { buildDiagnosisRecords } from '../claim-diagnosis-details/claim-diagnosis-details.component';
import ClaimDoctors from '../claim-doctors/claim-doctors';
import RecordCards from '../shared/record-cards.component';
import { formatDate, launchWorkspace, parseDate, showSnackbar, useVisit } from '@openmrs/esm-framework';
import { Button, ButtonSkeleton, InlineLoading, Tag, Tooltip } from '@carbon/react';
import CloseClaimModal from '../modal/close-claim/close-claim.modal';
import SubmitClaimModal from '../modal/submit-claim/submit-claim.modal';
import { endVisit, useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import { invalidatePreauthPreview } from '../../../../../claims/claims.resource';
import AddClaimDoctorModal from '../modal/claim-doctors/add-claim-doctor/add-claim-doctor.modal';
import { VisitTypeUuids } from '../../../../../shared/constants/visit-types';
import { VisitType } from '../../../../../claims';
import {
  canDispatchClaim,
  canEditClaimContent,
  canEditClaimDocuments,
  claimStatusTagType,
} from '../../claim-statuses';
import { parseDocTypes, readSpecialtyFlags } from '../../preauth/preauth.resource';
const money = (n: number | string) => `KES ${Number(n ?? 0).toLocaleString('en-KE')}`;

interface claimVisitDetailsProps {
  claimsVisit: ClaimsVisit;
  locationUuid: string;
  patientBillDetails?: PatientFacilityBillDetails;
  /** Hide the patient name / member number when a surrounding page already shows them
      (e.g. the bill-details patient header), to avoid repeating identity fields. */
  hidePatientIdentity?: boolean;
  /** The claim is being fetched or revalidated, so its state may already be stale. */
  claimRefreshing?: boolean;
  /** No live `workflow_state` has arrived yet, so the one on `claimsVisit` is only the
      copy stored when the visit was recorded — frozen at DRAFT for any claim submitted
      since. The State tag holds back rather than assert it. */
  claimStateUnconfirmed?: boolean;
}
const ClaimVisitDetails: React.FC<claimVisitDetailsProps> = ({
  claimsVisit,
  locationUuid,
  patientBillDetails,
  hidePatientIdentity,
  claimRefreshing,
  claimStateUnconfirmed,
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

  // A claim can't be submitted to SHA without at least one recorded diagnosis.
  const hasDiagnosis = (claimsVisit?.claim_diagnoses ?? []).length > 0;

  // All hooks are above this point, so the early return is safe here.
  if (!claimsVisit) {
    return <>No Data</>;
  }

  // Each of these writes to the claim, so all three refuse to open on anything but a
  // settled draft — the visible gating below can lag a state change by a render.
  function displayCloseClaimModal() {
    if (!canActOnClaim) {
      return;
    }
    setShowCloseClaimModal(true);
  }
  function handleCloseClaimModal() {
    setShowCloseClaimModal(false);
  }
  function displayCloseSubmitClaimModal() {
    if (!canActOnClaim || !hasDiagnosis) {
      return;
    }
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

  // Scoped to a single intervention: the workspace defaults its "switch FROM"
  // selection to the sole ACTIVE entry in `currentInterventions` and only shows
  // a from-picker when more than one is passed, so a one-item array is enough
  // to target this specific card's intervention.
  const handleSwitchIntervention = (intervention: VisitIntervention) => {
    if (!canSwitchIntervention) {
      return;
    }
    launchWorkspace('switch-intervention-workspace', {
      consentToken: claimsVisit.authorization_code,
      currentInterventions: [intervention],
      patientId: patientBillDetails?.cr_no ?? claimsVisit.patient_number,
      patientUuid: patientBillDetails?.patient_uuid,
      visitUuid: activeVisit?.uuid,
      billDate: patientBillDetails?.bill_date ?? claimsVisit.visit_start,
      onSwitchSuccess: () => {
        invalidateProviderClaimPreview();
      },
    });
  };

  const handleRaisePreauth = (intervention: VisitIntervention) => {
    if (!canSwitchIntervention) {
      return;
    }
    const consentToken = claimsVisit.authorization_code;
    if (!consentToken) {
      showSnackbar({
        kind: 'error',
        title: 'No claim token',
        subtitle: 'This claim visit has no consent token.',
      });
      return;
    }
    if (!intervention.needs_preauth) {
      return;
    }
    if (intervention.preauth_exist) {
      showSnackbar({
        kind: 'info',
        title: 'Preauth already exists',
        subtitle: 'A preauth is already recorded for this intervention.',
      });
      return;
    }

    const requiredDocs = parseDocTypes(
      Array.isArray(intervention.required_preauth_document_types)
        ? (intervention.required_preauth_document_types as string[]).join(',')
        : (intervention.required_preauth_document_types as string | null | undefined),
    );
    const applicableDocs = Array.isArray(intervention.applicable_document_types)
      ? intervention.applicable_document_types.map(String)
      : parseDocTypes(intervention.applicable_document_types as string | null | undefined);

    launchWorkspace('preauth-form-workspace', {
      consentToken,
      patientUuid: patientBillDetails?.patient_uuid,
      locationUuid,
      billItem: {
        intervention_code: intervention.intervention_code,
        patient_uuid: patientBillDetails?.patient_uuid,
        patient_name: claimsVisit.patient_name ?? patientBillDetails?.patient_name,
        cr_no: patientBillDetails?.cr_no ?? claimsVisit.patient_number,
        billable_service: intervention.intervention_name,
        item_price: Number(intervention.keph_level_tarrif) || patientBillDetails?.item_price || 0,
        item_quantity: patientBillDetails?.item_quantity ?? 1,
        consent_token: consentToken,
      },
      intervention: {
        code: intervention.intervention_code,
        name: intervention.intervention_name,
        ...readSpecialtyFlags(intervention),
        requiredPreauthDocumentTypes: requiredDocs,
        applicableDocumentTypes: applicableDocs,
      },
      onSuccess: async () => {
        await invalidatePreauthPreview(consentToken, locationUuid);
        invalidateProviderClaimPreview();
      },
    });
  };

  // Which actions apply depends on where the claim sits in the lifecycle, grouped in
  // ../../claim-statuses from the HIE's own phases. Changing what the claim contains
  // needs an open claim (DRAFT, or DRAFT_RESUBMIT after a clarification); submitting or
  // closing additionally covers one already prepared or that failed to dispatch.
  const canEditContent = canEditClaimContent(claimsVisit.workflow_state);
  const canDispatch = canDispatchClaim(claimsVisit.workflow_state);

  // A refresh in flight means the claim on screen may already have moved on — most of
  // all right after a submit, where the previous response is still being served. The
  // actions stay visible but stand down until the claim settles, so the state can't be
  // acted on twice.
  const canActOnClaim = canDispatch && !claimRefreshing;
  const canSwitchIntervention = canEditContent && !claimRefreshing;

  const submitClaimButton = (
    <Button
      kind="primary"
      size="sm"
      onClick={displayCloseSubmitClaimModal}
      disabled={!canActOnClaim || !hasDiagnosis}
    >
      Submit claim
    </Button>
  );

  return (
    <>
      <div className={styles.cvLayout}>
        <div className={styles.cvHeader}>
          <div className={styles.cvHeaderText}>
            {/* State, Status and Scheme grouped together on the left; the long scheme
                name lives here as a meta item so it doesn't crowd the action buttons. */}
            <div className={styles.cvHeaderTags}>
              {claimStateUnconfirmed ? (
                /* Showing the stored state here would assert DRAFT for a claim already
                   submitted, then correct itself seconds later. Wait for the live one. */
                <span className={styles.cvMeta}>
                  <span className={styles.cvMetaLabel}>State</span>
                  <InlineLoading
                    status="active"
                    description="Confirming…"
                    className={styles.cvStateLoading}
                    aria-label="Confirming claim state"
                  />
                </span>
              ) : claimsVisit.workflow_state ? (
                <span className={styles.cvMeta}>
                  <span className={styles.cvMetaLabel}>State</span>
                  <Tag size="sm" type={claimStatusTagType(claimsVisit.workflow_state)}>{claimsVisit.workflow_state}</Tag>
                </span>
              ) : null}
              {claimsVisit.claim_auth_status ? (
                <span className={styles.cvMeta}>
                  <span className={styles.cvMetaLabel}>Status</span>
                  <Tag size="sm" type={claimStatusTagType(claimsVisit.claim_auth_status)}>{claimsVisit.claim_auth_status}</Tag>
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
          {/* Close / Submit while the claim can still be dispatched; content-editable
              states are a subset of those, so this covers the whole row. */}
          {canDispatch ? (
            <div className={styles.cvActions}>
              {claimRefreshing ? (
                /* The claim is being fetched or revalidated, so which actions apply is
                   not yet settled. Standing placeholders in the same row keep the
                   header from reflowing while it resolves. */
                <span className={styles.cvActionsLoading} aria-busy="true" aria-label="Loading claim actions">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ButtonSkeleton size="sm" key={i} />
                  ))}
                </span>
              ) : (
                <>
                  <Button
                    kind="danger--tertiary"
                    size="sm"
                    onClick={displayCloseClaimModal}
                    disabled={!canActOnClaim}
                  >
                    Close claim
                  </Button>
                  {/* A disabled button emits no pointer events, so the tooltip hangs off
                      the wrapping span instead — `.submitClaimWrap` drops pointer events
                      on the button so hover lands on the span. tabIndex keeps the reason
                      reachable by keyboard, since a disabled button can't be focused. */}
                  {hasDiagnosis ? (
                    submitClaimButton
                  ) : (
                    <Tooltip align="bottom" label="A diagnosis must be recorded before this claim can be submitted.">
                      <span className={styles.submitClaimWrap} tabIndex={0}>
                        {submitClaimButton}
                      </span>
                    </Tooltip>
                  )}
                </>
              )}
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
            records={buildInvoiceRecords(
              claimsVisit.invoices ?? [],
              claimsVisit.authorization_code,
              // Removing a line is a content edit, so it follows the same window as the
              // diagnoses and the Switch Intervention action.
              canSwitchIntervention,
            )}
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
              // Attachments have their own window: wider than content edits, because
              // DRAFT_RESUBMIT_DOCUMENTS exists purely so missing documents can be
              // supplied. Outside it the rows are read-only.
              isClaimDraft: canEditClaimDocuments(claimsVisit.workflow_state),
              canSwitchIntervention,
              onSwitchIntervention: handleSwitchIntervention,
              onRaisePreauth: handleRaisePreauth,
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
