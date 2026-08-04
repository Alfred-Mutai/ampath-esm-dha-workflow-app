import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type PatientPayment, type PatientFacilityBillDetails } from '../../types';
import styles from './bill-details.scss';
import {
  Button,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add, Money } from '@carbon/react/icons';
import { formatDate, launchWorkspace, parseDate } from '@openmrs/esm-framework';
import { type AmrsVisitDiagnosis } from '../../../../types';
import AddClaimDiagnosisModal from '../modals/add-claim-diagnosis/add-claim-diagnosis.modal';
import { addClaimDiagnosis, useInvalidateProviderClaimPreview, useProviderClaimPreview } from '../../../../billing-claims.resource';
import EmptyState from '../../shared/empty-state.component';
import { canEditClaimContent } from '../../claim-statuses';

// One money format across the page, so a total and the line it came from line up.
const money = (n: number | string): string => `Ksh ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  // A single flag saying where a diagnosis stands with the claim.
  function diagnosisFlag(state: DiagnosisState): React.ReactNode {
    if (state === 'added') {
      return (
        <Tag size="sm" type="green">
          Added to claim
        </Tag>
      );
    }
    if (state === 'error') {
      return (
        <Tag size="sm" type="red">
          Not added
        </Tag>
      );
    }
    if (state === 'locked') {
      return (
        <Tag size="sm" type="gray">
          Not on claim
        </Tag>
      );
    }
    return (
      <Tag size="sm" type="blue">
        {state === 'checking' ? 'Checking…' : 'Adding…'}
      </Tag>
    );
  }

  // What the visit came to, and how much of it has been settled. The figures were only
  // ever readable by adding the lines up by eye, which is what the summary does here.
  const totalBilled = (patientBillDetails ?? []).reduce((sum, b) => sum + Number(b.item_total_price ?? 0), 0);
  const totalPaid = (patientPayments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const balance = totalBilled - totalPaid;
  // Every line item settled through the claim rather than at the cash point, so a
  // balance here would be read as money the patient still owes.
  const anyCashLine = (patientBillDetails ?? []).some(
    (b) => (b.payment_scheme ?? '').trim().toUpperCase() !== 'SHA',
  );
  const showActionsColumn = (patientBillDetails ?? []).some((b) => canPay(b) || canAddClaimLine(b));

  return (
    <>
      <div className={styles.billDetailsLayout}>
        {/* The visit's money, up front: what was charged, what came in, what is left. */}
        {billLoading ? null : (
          <dl className={styles.summary}>
            <div className={styles.summaryItem}>
              <dt>Bill items</dt>
              <dd>{patientBillDetails?.length ?? 0}</dd>
            </div>
            <div className={styles.summaryItem}>
              <dt>Total billed</dt>
              <dd>{money(totalBilled)}</dd>
            </div>
            <div className={styles.summaryItem}>
              <dt>Paid</dt>
              <dd>{money(totalPaid)}</dd>
            </div>
            {anyCashLine ? (
              <div className={styles.summaryItem}>
                <dt>Balance</dt>
                <dd className={balance > 0 ? styles.summaryDue : styles.summaryClear}>{money(Math.max(0, balance))}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {/* Each category is its own section: one plain table, every field in a column,
            with the actions that apply to a row at the end of it. */}
        <section className={styles.billRow}>
          <h6 className={styles.sectionTitle}>Bill items</h6>
          {billLoading ? (
            <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} rowCount={3} columnCount={7} />
          ) : (patientBillDetails ?? []).length === 0 ? (
            <EmptyState message="No bill items for this patient." />
          ) : (
            <div className={styles.tableCard}>
              <Table aria-label="bill items" size="sm" useZebraStyles>
                <TableHead>
                  <TableRow>
                    <TableHeader className={styles.numCol}>#</TableHeader>
                    <TableHeader>Service</TableHeader>
                    <TableHeader>Service type</TableHeader>
                    <TableHeader>Payer</TableHeader>
                    <TableHeader className={styles.numeric}>Qty</TableHeader>
                    <TableHeader className={styles.numeric}>Unit price</TableHeader>
                    <TableHeader className={styles.numeric}>Total</TableHeader>
                    <TableHeader>Status</TableHeader>
                    {showActionsColumn ? <TableHeader>Actions</TableHeader> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientBillDetails.map((b, index) => (
                    <TableRow key={b.cashier_bill_line_item_uuid ?? b.bill_line_item_id ?? index}>
                      <TableCell className={styles.numCol}>{index + 1}</TableCell>
                      <TableCell>{billItemName(b)}</TableCell>
                      <TableCell>{dash(b.service_type)}</TableCell>
                      <TableCell>{dash(b.payment_scheme)}</TableCell>
                      <TableCell className={styles.numeric}>{b.item_quantity}</TableCell>
                      <TableCell className={styles.numeric}>{money(b.item_price)}</TableCell>
                      <TableCell className={styles.numeric}>{money(b.item_total_price)}</TableCell>
                      <TableCell>
                        {billItemStatus(b) ? (
                          <Tag size="sm" type={statusTagType(billItemStatus(b))}>
                            {toSentence(billItemStatus(b))}
                          </Tag>
                        ) : (
                          dash('')
                        )}
                      </TableCell>
                      {showActionsColumn ? (
                        <TableCell>
                          <div className={styles.rowActions}>
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
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  <TableRow className={styles.totalRow}>
                    <TableCell colSpan={6}>Total billed</TableCell>
                    <TableCell className={styles.numeric}>{money(totalBilled)}</TableCell>
                    <TableCell colSpan={showActionsColumn ? 2 : 1} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className={styles.billRow}>
          <h6 className={styles.sectionTitle}>Patient diagnosis</h6>
          {diagnosisLoading ? (
            <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} rowCount={2} columnCount={6} />
          ) : (amrsVisitDiagnosis ?? []).length === 0 ? (
            <EmptyState message="No diagnosis recorded for this visit." />
          ) : (
            <div className={styles.tableCard}>
              <Table aria-label="patient diagnosis" size="sm" useZebraStyles>
                <TableHead>
                  <TableRow>
                    <TableHeader className={styles.numCol}>#</TableHeader>
                    <TableHeader>Encounter</TableHeader>
                    <TableHeader>Code</TableHeader>
                    <TableHeader>Coding system</TableHeader>
                    <TableHeader>Recorded</TableHeader>
                    <TableHeader>On claim</TableHeader>
                    <TableHeader>Action</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {amrsVisitDiagnosis.map((d, index) => {
                    const state = diagnosisState(d);
                    return (
                      <TableRow key={diagnosisKey(d)}>
                        <TableCell className={styles.numCol}>{index + 1}</TableCell>
                        <TableCell>{dash(d.encounter_type)}</TableCell>
                        <TableCell>
                          {d.icd11_code ? (
                            <Tag size="sm" type="blue">
                              {d.icd11_code}
                            </Tag>
                          ) : (
                            dash(d.icd11_code)
                          )}
                        </TableCell>
                        <TableCell>{dash(d.concept_source_name)}</TableCell>
                        <TableCell>
                          {d.encounter_datetime ? formatDate(parseDate(d.encounter_datetime)) : dash('')}
                        </TableCell>
                        <TableCell>{diagnosisFlag(state)}</TableCell>
                        <TableCell>
                          {/* Every diagnosis is mirrored onto the claim automatically; the
                              button is the fallback for the ones that didn't make it. Only
                              'error' qualifies, and only a draft claim can reach it — past
                              draft a diagnosis resolves to 'locked', where there is nothing
                              the user could do but be refused by the backend. */}
                          {state === 'error' ? (
                            <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => handleAddClaimDiagnosis(d)}>
                              Add to claim
                            </Button>
                          ) : (
                            dash('')
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className={styles.billRow}>
          <h6 className={styles.sectionTitle}>Bill payments</h6>
          {patientPayments.length === 0 ? (
            <EmptyState message="No payments received for this visit." />
          ) : (
            <div className={styles.tableCard}>
              <Table aria-label="bill payments" size="sm" useZebraStyles>
                <TableHead>
                  <TableRow>
                    <TableHeader className={styles.numCol}>#</TableHeader>
                    <TableHeader>Payment type</TableHeader>
                    <TableHeader>Receipt</TableHeader>
                    <TableHeader className={styles.numeric}>Amount</TableHeader>
                    <TableHeader className={styles.numeric}>Amount tendered</TableHeader>
                    <TableHeader>Date / time</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientPayments.map((p, index) => (
                    <TableRow key={p.cashier_bill_payment_uuid}>
                      <TableCell className={styles.numCol}>{index + 1}</TableCell>
                      <TableCell>{dash(p.payment_mode)}</TableCell>
                      <TableCell>{dash(p.receipt_number)}</TableCell>
                      <TableCell className={styles.numeric}>{money(p.amount)}</TableCell>
                      <TableCell className={styles.numeric}>{money(p.amount_tendered)}</TableCell>
                      <TableCell>{p.payment_time ? formatDate(parseDate(p.payment_time)) : dash('')}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className={styles.totalRow}>
                    <TableCell colSpan={3}>Total paid</TableCell>
                    <TableCell className={styles.numeric}>{money(totalPaid)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </section>
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
