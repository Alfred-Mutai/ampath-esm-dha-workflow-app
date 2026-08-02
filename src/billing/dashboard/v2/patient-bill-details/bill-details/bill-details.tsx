import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type PatientPayment, type PatientFacilityBillDetails } from '../../types';
import styles from './bill-details.scss';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { Add, Money } from '@carbon/react/icons';
import { formatDate, launchWorkspace, parseDate } from '@openmrs/esm-framework';
import { type AmrsVisitDiagnosis } from '../../../../types';
import AddClaimDiagnosisModal from '../modals/add-claim-diagnosis/add-claim-diagnosis.modal';
import { addClaimDiagnosis, useInvalidateProviderClaimPreview, useProviderClaimPreview } from '../../../../billing-claims.resource';
import RecordCards, { RecordCardsSkeleton, type RecordCardModel } from '../../claim-visits/shared/record-cards.component';
import { canEditClaimContent } from '../../claim-statuses';
// Stable key for a patient diagnosis, used to track its claim-add attempt/state.
const diagnosisKey = (d: AmrsVisitDiagnosis): string => d.uuid ?? `${d.encounter_id}-${d.icd11_code}`;

// Whether a patient diagnosis has already been added to the claim: the claim carries
// each diagnosis by its ICD code, which is the AMRS diagnosis' icd11_code.
type DiagnosisState = 'added' | 'adding' | 'error' | 'checking' | 'locked';

// Sentence-case a value for uniform display, e.g. "AWAITING CLAIM" -> "Awaiting claim".
const toSentence = (s: string): string => {
  const v = (s ?? '').trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : '';
};

// Muted em dash for values the backend left blank, so a sparse row still reads as a row.
const dash = (value?: string | null): React.ReactNode => {
  const v = (value ?? '').trim();
  return v ? v : <span className={styles.missingValue}>—</span>;
};

// Some line items come back with no billable_service; fall back to the intervention
// code so the row is still identifiable rather than an empty cell.
const billItemName = (b: PatientFacilityBillDetails): React.ReactNode =>
  dash(b.billable_service ?? b.intervention_code);

// Uniform status colours across Paid / Pending / Awaiting claim.
const statusTagType = (status: string): 'green' | 'blue' | 'gray' | 'teal' => {
  const s = (status ?? '').trim().toUpperCase();
  if (s === 'PAID') return 'green';
  if (s === 'AWAITING CLAIM') return 'blue';
  if (s === 'POSTED' || s.includes('PARTIAL')) return 'teal';
  return 'gray'; // PENDING and anything else
};

interface billDetailsProps {
  patientBillDetails: PatientFacilityBillDetails[];
  patientPayments: PatientPayment[];
  amrsVisitDiagnosis: AmrsVisitDiagnosis[];
  consentToken: string;
  locationUuid: string;
  billLoading?: boolean;
  diagnosisLoading?: boolean;
  /** Bumped by "Reload Bills"; clears the record of past auto-add attempts so a
      reload retries any diagnosis that previously failed to reach the claim. */
  refreshToken?: number;
}
const BillDetails: React.FC<billDetailsProps> = ({ patientBillDetails, patientPayments, amrsVisitDiagnosis, consentToken, locationUuid, billLoading, diagnosisLoading, refreshToken }) => {
  const setDiagnosisInterventionCode = useMemo(()=>getConsultationBillIntervantionCode(),[patientBillDetails]);
  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<AmrsVisitDiagnosis | null>(null);
  const [showAddClaimDiagnosisModal, setShowAddClaimDiagnosisModal] = useState<boolean>(false);
  // Per-diagnosis add progress. A diagnosis already in the claim isn't tracked here —
  // that's read live from the claim preview below.
  const [diagnosisAddState, setDiagnosisAddState] = useState<Record<string, 'adding' | 'error'>>({});
  const autoAddAttempted = useRef<Set<string>>(new Set());

  // The live claim, so we can tell which patient diagnoses are already on it. SWR
  // shares this request with the Claim Details section, so it's not a second fetch.
  const { claimVisit, isLoading: claimLoading } = useProviderClaimPreview(consentToken, locationUuid);
  const claimDiagnosisCodes = useMemo(
    () => new Set((claimVisit?.claim_diagnoses ?? []).map((cd) => cd.diagnosis_code).filter(Boolean)),
    [claimVisit],
  );
  // Diagnoses and billing lines are the claim's content, so they follow the content
  // window grouped in ../../claim-statuses: DRAFT, plus DRAFT_RESUBMIT once a claim has
  // been pulled back to answer a payer clarification. Anything else — submitted,
  // dispatched, closed — is read-only and the backend would refuse the write.
  const isClaimDraft = canEditClaimContent(claimVisit?.workflow_state);

  // Until the claim has actually arrived its state is unknown, and the permissive
  // default above would offer actions that vanish the moment it resolves to SUBMITTED.
  // Withhold them until we know. A bill carrying no consent token has no claim to wait
  // on, so it isn't held back by this.
  const claimPending = Boolean(consentToken) && (claimLoading || !claimVisit);
  const canActOnClaim = !claimPending && isClaimDraft;

  // Each diagnosis is auto-added at most once, so a failed attempt would otherwise stay
  // failed for as long as this stays mounted. "Reload Bills" is an explicit ask for a
  // fresh attempt: forget which ones were tried and drop the recorded errors, and the
  // effect below picks them up again once the reloaded diagnoses arrive.
  useEffect(() => {
    if (refreshToken) {
      autoAddAttempted.current.clear();
      setDiagnosisAddState({});
    }
  }, [refreshToken]);

  // On load, push any patient diagnosis that isn't on the claim yet — each attempted
  // once. Failures surface a manual "Add to claim" button; successes refresh the claim
  // so the card flips to "Added".
  useEffect(() => {
    if (!claimVisit || !isClaimDraft || !consentToken || !setDiagnosisInterventionCode) {
      return;
    }
    (amrsVisitDiagnosis ?? []).forEach((d) => {
      const key = diagnosisKey(d);
      if (!d.icd11_code || claimDiagnosisCodes.has(d.icd11_code) || autoAddAttempted.current.has(key)) {
        return;
      }
      autoAddAttempted.current.add(key);
      setDiagnosisAddState((prev) => ({ ...prev, [key]: 'adding' }));
      addClaimDiagnosis({
        consentToken,
        interventionCode: setDiagnosisInterventionCode,
        locationUuid,
        icdCode: d.icd11_code,
        practitionerIdentificationNumber: d.practioner_nat_id,
        practitionerIdentificationType: d.practitioner_identifier_type,
        practitionerRegulationBody: d.practitioner_body,
      })
        .then((resp) => {
          if (resp && resp['error']) {
            setDiagnosisAddState((prev) => ({ ...prev, [key]: 'error' }));
          } else {
            setDiagnosisAddState((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            invalidateProviderClaimPreview();
          }
        })
        .catch(() => setDiagnosisAddState((prev) => ({ ...prev, [key]: 'error' })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimVisit, isClaimDraft, amrsVisitDiagnosis, consentToken, locationUuid, setDiagnosisInterventionCode]);

  function diagnosisState(d: AmrsVisitDiagnosis): DiagnosisState {
    if (d.icd11_code && claimDiagnosisCodes.has(d.icd11_code)) {
      return 'added';
    }
    if (!claimVisit) {
      return 'checking';
    }
    // Only a draft claim can take a diagnosis — so neither the auto-add nor the manual
    // "Add to claim" button is offered once the claim is submitted/authorised, even if
    // an earlier draft-time attempt left an error recorded.
    if (!isClaimDraft) {
      return 'locked';
    }
    const tracked = diagnosisAddState[diagnosisKey(d)];
    if (tracked === 'error') {
      return 'error';
    }
    if (tracked === 'adding') {
      return 'adding';
    }
    // Nothing to add with, or no intervention to file it under — offer the manual path.
    if (!d.icd11_code || !setDiagnosisInterventionCode) {
      return 'error';
    }
    return 'adding';
  }

  if (!patientBillDetails && !patientPayments) {
    return <>No Data</>;
  }
  function handleAddClaimDiagnosis(diagnosis: AmrsVisitDiagnosis) {
    // Only a draft claim accepts a diagnosis; the backend rejects the rest outright.
    if (!isClaimDraft) {
      return;
    }
    setSelectedDiagnosis(diagnosis);
    setShowAddClaimDiagnosisModal(true);
  }
  function handleCloseClaimDiagnosisModal() {
    setShowAddClaimDiagnosisModal(false);
  }
  function onClaimDiagnosisSuccess() {
    handleCloseClaimDiagnosisModal();
    invalidateProviderClaimPreview();
  }
  function handleBillItemPayment(patientBillDetail: PatientFacilityBillDetails){
      if (!isClaimDraft) {
        return;
      }
      launchWorkspace('bill-item-payment-workspace', {
        billItem: patientBillDetail,
        onPay: invalidateProviderClaimPreview,
      });
  }
  function handleClaimLineAddition(patientBillDetail: PatientFacilityBillDetails){
    if (!isClaimDraft) {
      return;
    }
    launchWorkspace('add-claim-line-workspace', {
      billItem: patientBillDetail,
      locationUuid,
      consentToken: consentToken || patientBillDetail.consent_token || '',
      onSuccess: invalidateProviderClaimPreview,
    });
  }
  function getConsultationBillIntervantionCode(){
    if(!patientBillDetails || patientBillDetails.length === 0){
        return '';
    }
     const consultationBill = patientBillDetails.find((b)=>{
        return (b.billable_service ?? '').toLocaleLowerCase().trim().includes('consultation');
     });
    if(consultationBill){
       return consultationBill.intervention_code;
    }else{
      return patientBillDetails[0].intervention_code ?? '';
    }
  }
  // Every action on this page settles against a claim that is still being assembled, so
  // all of them follow the one rule: offered while the claim is a draft, withdrawn once
  // it has been submitted or closed and the backend will only refuse them.
  function canPay(b: PatientFacilityBillDetails): boolean {
    return canActOnClaim && b.payment_status !== 'PAID';
  }
  function canAddClaimLine(b: PatientFacilityBillDetails): boolean {
    return canActOnClaim && Boolean(b.intervention_code) && b.has_claim_line === 0;
  }
  // SHA items aren't paid in cash — they're settled via the SHA claim. Default a
  // sensible status when the backend leaves it blank.
  function billItemStatus(b: PatientFacilityBillDetails): string {
    if (b.payment_status && b.payment_status.trim()) {
      return b.payment_status;
    }
    const payer = (b.payment_scheme ?? '').trim().toUpperCase();
    if (payer === 'SHA') {
      return 'AWAITING CLAIM';
    }
    return b.payment_status ?? '';
  }
  // Bill items and diagnoses share one grid so every card — however few — lines up in
  // the same three-across row across the full width. Tone keeps the two kinds apart:
  // teal for bill items, amber for diagnoses.
  const billItemCards: RecordCardModel[] = patientBillDetails.map((b) => ({
    tone: 'teal',
    kind: 'Bill item',
    title: billItemName(b),
    badge: billItemStatus(b) ? (
      <Tag size="sm" type={statusTagType(billItemStatus(b))}>
        {toSentence(billItemStatus(b))}
      </Tag>
    ) : undefined,
    fields: [
      { label: 'Service type', value: dash(b.service_type) },
      { label: 'Payer', value: dash(b.payment_scheme) },
      { label: 'Quantity', value: b.item_quantity },
      { label: 'Total', value: `Ksh ${b.item_total_price}` },
    ],
    actions:
      canPay(b) || canAddClaimLine(b) ? (
        <>
          {canPay(b) && (
            <Button kind="primary" size="sm" renderIcon={Money} onClick={() => handleBillItemPayment(b)}>
              Pay
            </Button>
          )}
          {canAddClaimLine(b) && (
            <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => handleClaimLineAddition(b)}>
              Add claim line
            </Button>
          )}
        </>
      ) : undefined,
  }));

  const diagnosisCards: RecordCardModel[] = (amrsVisitDiagnosis ?? []).map((d) => {
    const state = diagnosisState(d);
    // A single flag communicates where the diagnosis stands with the claim.
    const flag =
      state === 'added' ? (
        <Tag size="sm" type="green">
          Added to claim
        </Tag>
      ) : state === 'error' ? (
        <Tag size="sm" type="red">
          Not added
        </Tag>
      ) : state === 'locked' ? (
        <Tag size="sm" type="gray">
          Not on claim
        </Tag>
      ) : (
        <Tag size="sm" type="blue">
          {state === 'checking' ? 'Checking…' : 'Adding…'}
        </Tag>
      );
    return {
      tone: 'amber',
      kind: 'Diagnosis',
      title: d.encounter_type,
      badge: flag,
      fields: [
        {
          label: d.concept_source_name || 'ICD code',
          value: d.icd11_code ? (
            <Tag size="sm" type="blue">
              {d.icd11_code}
            </Tag>
          ) : (
            dash(d.icd11_code)
          ),
        },
        { label: 'Encounter date', value: d.encounter_datetime ? formatDate(parseDate(d.encounter_datetime)) : '' },
      ],
      // Every diagnosis is mirrored onto the claim automatically; the button is the
      // fallback for the ones that didn't make it. Only 'error' qualifies, and only a
      // draft claim can reach it — a claim past draft resolves to 'locked' above, where
      // there is nothing the user could do but be refused by the backend.
      actions:
        state === 'error' ? (
          <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => handleAddClaimDiagnosis(d)}>
            Add to claim diagnosis
          </Button>
        ) : undefined,
    };
  });

  return (
    <>
      <div className={styles.billDetailsLayout}>
        {/* Each category is its own section on its own row, all using the same grid. */}
        <section className={styles.billRow}>
          <h6 className={styles.sectionTitle}>Bill items</h6>
          {billLoading ? (
            <RecordCardsSkeleton count={3} fields={4} layout="grid" columns={3} tone="teal" />
          ) : (
            <RecordCards records={billItemCards} emptyMessage="No bill items for this patient." layout="grid" columns={3} />
          )}
        </section>

        <section className={styles.billRow}>
          <h6 className={styles.sectionTitle}>Patient diagnosis</h6>
          {diagnosisLoading ? (
            // Two fields per diagnosis card (ICD code, encounter date), unlike the
            // four on a bill item.
            <RecordCardsSkeleton count={2} fields={2} layout="grid" columns={3} tone="amber" />
          ) : (
            <RecordCards records={diagnosisCards} emptyMessage="No diagnosis recorded for this visit." layout="grid" columns={3} />
          )}
        </section>

        {patientPayments.length > 0 ? (
          <section className={styles.billRow}>
            <h6 className={styles.sectionTitle}>Bill payments</h6>
            <div className={styles.tableCard}>
              <Table aria-label="bill payments" size="sm" useZebraStyles>
                <TableHead>
                  <TableRow>
                    <TableHeader>No</TableHeader>
                    <TableHeader>Payment type</TableHeader>
                    <TableHeader>Amount</TableHeader>
                    <TableHeader>Amount tendered</TableHeader>
                    <TableHeader>Date / time</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientPayments.map((p, index) => (
                    <TableRow key={p.cashier_bill_payment_uuid}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{p.payment_mode}</TableCell>
                      <TableCell>Ksh {p.amount}</TableCell>
                      <TableCell>Ksh {p.amount_tendered}</TableCell>
                      <TableCell>{formatDate(parseDate(p.payment_time))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : (
          <></>
        )}
      </div>
      {showAddClaimDiagnosisModal && selectedDiagnosis && (
        <AddClaimDiagnosisModal
          consentToken={consentToken}
          amrsVisitDiagnosis={selectedDiagnosis}
          locationUuid={locationUuid}
          interventionCode={setDiagnosisInterventionCode}
          open={showAddClaimDiagnosisModal}
          onClose={handleCloseClaimDiagnosisModal}
          onSuccess={onClaimDiagnosisSuccess}
        />
      )}
    </>
  );
};
export default BillDetails;
