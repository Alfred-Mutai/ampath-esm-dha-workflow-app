import React, { useEffect, useMemo, useState } from 'react';
import styles from './claim-visit-details.component.scss';
import {
  type PatientFacilityBillDetails,
  type ClaimsVisit,
  type VisitIntervention,
  ApplicableDocumentType,
} from '../../types';
import { buildInvoiceRecords } from '../claim-invoice-details/claim-invoice-details.component';
import { buildInterventionRecords } from '../claim-intervention-details/claim-intervention-details.component';
import { buildDiagnosisRecords } from '../claim-diagnosis-details/claim-diagnosis-details.component';
import ClaimDoctors from '../claim-doctors/claim-doctors';
import ClaimHistory from '../claim-history/claim-history.component';
import RecordTable from '../shared/record-table.component';
import { formatDate, launchWorkspace, parseDate, showSnackbar, useVisit } from '@openmrs/esm-framework';
import { Button, ButtonSkeleton, Tooltip } from '@carbon/react';
import CloseClaimModal from '../modal/close-claim/close-claim.modal';
import SubmitClaimModal from '../modal/submit-claim/submit-claim.modal';
import { endVisit, useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import { invalidatePreauthPreview, usePreauthPreview } from '../../../../../claims/claims.resource';
import AddClaimDoctorModal from '../modal/claim-doctors/add-claim-doctor/add-claim-doctor.modal';
import { VisitTypeUuids } from '../../../../../shared/constants/visit-types';
import { VisitType } from '../../../../../claims';
import { canDispatchClaim, canEditClaimContent, canEditClaimDocuments } from '../../claim-statuses';
import { parseDocTypes, readSpecialtyFlags, resolveUnitPriceFromPatientBills } from '../../preauth/preauth.resource';
const money = (n: number | string) =>
  `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The HIE returns names and places in block capitals, which read as shouting and are
 * harder to scan than the same words cased normally. Codes (SHIF, CR…) are left alone —
 * only free text goes through this. Capitalises after an apostrophe or hyphen too, so
 * O'Brien and Ali-Hassan survive; "McLeod" is the known miss.
 */
const titleCase = (value?: string | null): string => {
  const v = (value ?? '').trim();
  if (!v) {
    return '';
  }
  // Anything with lower-case letters already is left as the source wrote it.
  if (v !== v.toUpperCase()) {
    return v;
  }
  return v.toLowerCase().replace(/(^|[\s'’\-\/])([a-z])/g, (_m, boundary, letter) => boundary + letter.toUpperCase());
};

/**
 * A section heading carrying how many records are under it, so the page can be scanned
 * for what a claim actually holds without reading four tables to find the empty ones.
 *
 * `blocking` marks a count of zero that is stopping something, and colours it to match
 * the callout in the section body — so the problem is visible from the heading, which is
 * as far as most readers scan.
 */
const SectionTitle: React.FC<{ label: string; count: number; blocking?: boolean }> = ({ label, count, blocking }) => {
  const tone = count > 0 ? '' : blocking ? styles.sectionCountDanger : styles.sectionCountEmpty;
  return (
    <h5 className={styles.sectionTitle}>
      {label}
      <span className={`${styles.sectionCount} ${tone}`}>{count}</span>
    </h5>
  );
};

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

  const { preview: preauthPreview } = usePreauthPreview(claimsVisit?.authorization_code, locationUuid);

  // A claim can't be submitted to SHA without at least one recorded diagnosis.
  const hasDiagnosis = (claimsVisit?.claim_diagnoses ?? []).length > 0;

  // Nor without someone named as having provided the care. Unlike the diagnosis this is
  // not enforced by the submit endpoint — it is a house rule, and one that currently has
  // no way to be satisfied from this page: `AddClaimDoctorModal` is a stub whose handlers
  // are empty, and no endpoint for attaching a doctor to a claim exists yet. A claim whose
  // source data carries no doctor therefore cannot be submitted here until that is built.
  const hasDoctor = (claimsVisit?.claim_doctors ?? []).some((doctor) => (doctor?.doctor_name ?? '').trim());

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
    if (!canActOnClaim || !hasDiagnosis || !hasDoctor) {
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

  const handleRaisePreauth = async (intervention: VisitIntervention) => {
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

    const requiredDocs = parseDocTypes(
      Array.isArray(intervention.required_preauth_document_types)
        ? (intervention.required_preauth_document_types as string[]).join(',')
        : (intervention.required_preauth_document_types as string | null | undefined),
    );
    const applicableDocs = Array.isArray(intervention.applicable_document_types)
      ? intervention.applicable_document_types.map(String)
      : parseDocTypes(intervention.applicable_document_types as string | null | undefined);

    const patientUuid = patientBillDetails?.patient_uuid;
    let itemPrice = Number(patientBillDetails?.item_price) || Number(intervention.keph_level_tarrif) || 0;
    let billableService = intervention.intervention_name;
    let billDate = patientBillDetails?.bill_date ?? claimsVisit.visit_start;

    if (patientUuid && locationUuid) {
      const { unitPrice, billLine } = await resolveUnitPriceFromPatientBills({
        patientUuid,
        locationUuid,
        billingDate: billDate,
        interventionCode: intervention.intervention_code,
        serviceHint: intervention.intervention_name,
      });
      if (unitPrice) {
        itemPrice = Number(unitPrice);
      }
      if (billLine?.billable_service) {
        billableService = billLine.billable_service;
      }
      if (billLine?.bill_date) {
        billDate = billLine.bill_date;
      }
    }

    launchWorkspace('preauth-form-workspace', {
      consentToken,
      patientUuid,
      locationUuid,
      billItem: {
        intervention_code: intervention.intervention_code,
        patient_uuid: patientUuid,
        patient_name: claimsVisit.patient_name ?? patientBillDetails?.patient_name,
        cr_no: patientBillDetails?.cr_no ?? claimsVisit.patient_number,
        billable_service: billableService,
        bill_date: billDate,
        item_price: itemPrice,
        item_total_price: itemPrice,
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

  // Named once here so each section can be counted in its heading without the
  // `?? []` appearing twice per category.
  const diagnoses = claimsVisit.claim_diagnoses ?? [];
  const interventions = claimsVisit.interventions ?? [];
  const invoices = claimsVisit.invoices ?? [];
  const doctors = claimsVisit.claim_doctors ?? [];

  // "SHIF — Social Health Insurance Fund". The code alone is what the payer is filed
  // under and the name alone is what a reader recognises, so the header carries both and
  // the details grid below carries neither.
  const schemeLabel = [claimsVisit.scheme_code, claimsVisit.scheme_name].filter(Boolean).join(' — ');

  // What is stopping a submit, if anything. Named rather than inlined so the tooltip can
  // say which of the two is missing — and say both when both are — instead of always
  // blaming the diagnosis. An empty string means nothing is in the way.
  const submitBlockedReason = !hasDiagnosis
    ? hasDoctor
      ? 'A diagnosis must be recorded before this claim can be submitted.'
      : 'A diagnosis and an attending doctor must be recorded before this claim can be submitted.'
    : !hasDoctor
      ? 'An attending doctor must be recorded before this claim can be submitted.'
      : '';

  const submitClaimButton = (
    <Button
      kind="primary"
      size="sm"
      onClick={displayCloseSubmitClaimModal}
      disabled={!canActOnClaim || Boolean(submitBlockedReason)}
    >
      Submit claim
    </Button>
  );

  return (
    <>
      <div className={styles.cvLayout}>
        {/* Who the claim is for, and what it comes to. The state and the authorisation
            status were tagged here as well as in the history rail, and the actions sat at
            the right; both belong to the rail — the first as its subject, the second as
            what follows from it — which leaves the header to name the claim and price
            it. */}
        <div className={styles.cvHeader}>
          {!hidePatientIdentity ? (
            <div className={styles.cvHeaderText}>
              <h4 className={styles.claimPatient}>{titleCase(claimsVisit.patient_name) || '—'}</h4>
              {claimsVisit.member_number ? (
                <span className={styles.claimPatientSub}>{claimsVisit.member_number}</span>
              ) : null}
            </div>
          ) : null}

          {/* The figure sits with the name rather than in the rail: who the claim is for
              and what it comes to are the two things the page is opened to read, and they
              are read together. */}
          <div className={styles.claimAmount}>
            <span className={styles.claimAmountLabel}>Total amount</span>
            <span className={styles.claimAmountValue}>{money(claimsVisit.total_claim_amount)}</span>
            {/* Net only differs from the gross when a discount or co-pay applies; when
                they match, one figure says it all. */}
            {Number(claimsVisit.total_claim_net_amount ?? 0) !== Number(claimsVisit.total_claim_amount ?? 0) ? (
              <span className={styles.claimAmountNet}>Net {money(claimsVisit.total_claim_net_amount)}</span>
            ) : null}
          </div>
        </div>

        {/* Everything that describes the claim rather than identifies or prices it, as
            one strip of labelled values across the full width. The scheme is among them
            rather than trailing the member number after a dot: it is the same kind of
            fact as the three beside it, and being labelled like them it can be found by
            looking for its heading instead of read out of a run-on line. */}
        <dl className={styles.detailsGrid}>
          {schemeLabel ? (
            <div className={styles.detailRow}>
              <dt>Scheme</dt>
              <dd>{schemeLabel}</dd>
            </div>
          ) : null}
          <div className={styles.detailRow}>
            <dt>Service type</dt>
            <dd>{titleCase(claimsVisit.service_type) || '—'}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Provider</dt>
            <dd>{titleCase(claimsVisit.provider_name) || '—'}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Visit start</dt>
            <dd>{claimsVisit.visit_start ? formatDate(parseDate(claimsVisit.visit_start)) : '—'}</dd>
          </div>
        </dl>

        {/* The claim's contents on the left, a standing rail on the right. The rail runs
            the length of the page rather than sitting in the summary, because what it
            carries — where the claim has got to and what it comes to — is what you are
            checking the tables against, and is wanted just as much four tables down as at
            the top. */}
        <div className={styles.cvBody}>
          <div className={styles.cvMain}>
            {/* Each category is its own section, listed as a short table: the few fields
                that tell one record from another, with the rest — and each record's own
                actions — in the side drawer the row opens.

                In the order a claim is checked rather than the order it was built: what
                was found, what was done about it, what it is being billed at, who did it.
                That also puts the diagnoses first, which is the one section that can stop
                the claim being submitted at all. */}
            <section className={styles.section}>
              {/* A missing diagnosis is the one absence on this page that stops the claim
                  going anywhere, and only while the claim can still be dispatched — on a
                  closed one it is just something that never happened. */}
              <SectionTitle label="Diagnoses" count={diagnoses.length} blocking={canDispatch} />
              <RecordTable
                records={buildDiagnosisRecords(diagnoses, {
                  // Named by the claim above; the panel drops the member number when it
                  // matches.
                  memberNumber: claimsVisit.member_number,
                  patientNumber: claimsVisit.patient_number,
                })}
                columns={[
                  { header: 'Diagnosis', source: 'title' },
                  { header: 'Diagnosis code', field: 'Diagnosis code' },
                  { header: 'Intervention code', field: 'Intervention code' },
                  { header: 'Recorded on', field: 'Recorded on' },
                ]}
                // The empty state is the reason the Submit button beside it is disabled, so
                // it says so rather than leaving the two to be connected by hovering.
                emptyMessage={
                  canDispatch
                    ? 'No diagnosis recorded. SHA needs at least one before this claim can be submitted.'
                    : 'No diagnosis was recorded on this claim.'
                }
                emptyTone={canDispatch ? 'danger' : 'neutral'}
                ariaLabel="claim diagnoses"
              />
            </section>

            <section className={styles.section}>
              <SectionTitle label="Interventions" count={interventions.length} />
              <RecordTable
                records={buildInterventionRecords(
                  interventions,
                  {
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
                    preauthPreview,
                  },
                  // Named by the claim above; the panel drops the scheme when it matches.
                  { schemeCode: claimsVisit.scheme_code, schemeName: claimsVisit.scheme_name },
                )}
                columns={[
                  { header: 'Intervention', source: 'title' },
                  { header: 'Code', field: 'Code' },
                  { header: 'Payment mechanism', field: 'Payment mechanism' },
                  { header: 'Needs preauth', field: 'Needs preauth' },
                  { header: 'State', source: 'badge' },
                ]}
                emptyMessage="No interventions on this claim."
                ariaLabel="claim interventions"
              />
            </section>

            <section className={styles.section}>
              <SectionTitle label="Invoices" count={invoices.length} />
              <RecordTable
                records={buildInvoiceRecords(
                  invoices,
                  claimsVisit.authorization_code,
                  // Removing a line is a content edit, so it follows the same window as the
                  // diagnoses and the Switch Intervention action.
                  canSwitchIntervention,
                  // The claim states these above; the panel shows each only if this invoice
                  // disagrees with the claim. The patient's details aren't shown in the
                  // panel at all — they are there for the printable invoice, which has to
                  // name who it is for.
                  {
                    serviceType: claimsVisit.service_type,
                    schemeCode: claimsVisit.scheme_code,
                    schemeName: claimsVisit.scheme_name,
                    providerName: claimsVisit.provider_name,
                    visitStart: claimsVisit.visit_start,
                    patientName: titleCase(claimsVisit.patient_name),
                    memberNumber: claimsVisit.member_number,
                  },
                )}
                // An invoice is what the claim is actually worth, and there are rarely more
                // than one or two, so the row carries the figures a biller checks — amount,
                // net and where it got to — rather than making them open the panel for it.
                // Scheme and service type are the claim's, stated in the header above, and
                // would be the same word repeated down every row.
                columns={[
                  { header: 'Invoice', source: 'title' },
                  { header: 'Date', field: 'Date' },
                  { header: 'Amount', field: 'Amount' },
                  { header: 'Net', field: 'Net' },
                  { header: 'Dispatch', field: 'Dispatch status' },
                  { header: 'State', source: 'badge' },
                ]}
                emptyMessage="No invoices on this claim."
                ariaLabel="claim invoices"
              />
            </section>

            <section className={styles.section}>
              {/* Blocking in the same way as the diagnoses, and flagged the same way:
                  Submit refuses a claim that names nobody as having provided the care.
                  Note this gate is ours, not the endpoint's — see `hasDoctor`. */}
              <SectionTitle label="Doctors" count={doctors.length} blocking={canDispatch} />
              <ClaimDoctors claimDoctors={doctors} blocking={canDispatch} />
            </section>
          </div>

          {/* Sticky, so the state and the total stay on screen while the tables are
              scrolled past them — which is the whole point of giving them a column. It
              wraps below the tables rather than squeezing them when the page is too
              narrow to hold both; `.cvBody` measures the space it actually has, so this
              holds in the modal and the embedded view as much as on the page. */}
          <aside className={styles.cvRail}>
            <div className={styles.cvRailInner}>
              {/* Close / Submit while the claim can still be dispatched; content-editable
                  states are a subset of those, so this covers the whole block. They lead
                  the rail: they are what the page is open to do, and in a sticky column
                  they stay within reach however far down the tables you have scrolled. */}
              {canDispatch ? (
                <div className={styles.railActions}>
                  {claimRefreshing ? (
                    /* The claim is being fetched or revalidated, so which actions apply is
                       not yet settled. Placeholders of the same size and count keep the
                       rail from reflowing while it resolves. */
                    <span className={styles.railActionsLoading} aria-busy="true" aria-label="Loading claim actions">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <ButtonSkeleton size="sm" key={i} />
                      ))}
                    </span>
                  ) : (
                    <>
                      {/* A disabled button emits no pointer events, so the tooltip hangs
                          off the wrapping span instead — `.submitClaimWrap` drops pointer
                          events on the button so hover lands on the span. tabIndex keeps
                          the reason reachable by keyboard, since a disabled button can't
                          be focused. */}
                      {submitBlockedReason ? (
                        <Tooltip align="left" label={submitBlockedReason}>
                          <span className={styles.submitClaimWrap} tabIndex={0}>
                            {submitClaimButton}
                          </span>
                        </Tooltip>
                      ) : (
                        submitClaimButton
                      )}
                      <Button
                        kind="danger--tertiary"
                        size="sm"
                        onClick={displayCloseClaimModal}
                        disabled={!canActOnClaim}
                      >
                        Close claim
                      </Button>
                    </>
                  )}
                </div>
              ) : null}

              <div className={styles.asideBlock}>
                <h5 className={styles.asideTitle}>Claim history</h5>
                <ClaimHistory claimsVisit={claimsVisit} claimStateUnconfirmed={claimStateUnconfirmed} />
              </div>
            </div>
          </aside>
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
