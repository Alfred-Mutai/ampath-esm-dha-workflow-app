import React, { useEffect, useMemo, useState } from 'react';
import styles from './patient-bill-details.scss';
import {
  type PatientFacilityBillsDto,
  type PatientFacilityBillDetails,
  type PatientPaymentsDto,
  type PatientPayment,
} from '../types';
import {
  fetchMaternityDiagnosis,
  fetchPatientBillPayments,
  fetchPatientDiagnosis,
  fetchPatientFacilityBillDetails,
  useProviderClaimPreview,
} from '../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-styleguide';
import { InlineLoading, SkeletonText } from '@carbon/react';
import { Receipt, DocumentTasks } from '@carbon/react/icons';
import BillDetails from './bill-details/bill-details';
import PatientClaimDetails from './claim-details/patient-claim-details.component';
import EmptyState from '../shared/empty-state.component';
import ScrollToTop from '../shared/scroll-to-top.component';
import { type AmrsVisitDiagnosisDto, type AmrsVisitDiagnosis, AmrsMaternityDiagnosisDto } from '../../../types';
interface patientBillDetailsProps {
  patientUuid: string;
  locationUuid: string;
  billingDate: string;
  refreshToken?: number;
}
const PatientBillDetails: React.FC<patientBillDetailsProps> = ({ patientUuid, locationUuid, billingDate, refreshToken }) => {
  const [patientBillDetails, setPatientBillDetails] = useState<PatientFacilityBillDetails[]>([]);
  const [consentToken, setConsentToken] = useState<string>('');
  const [patientBillPayments, setPatientBillPayments] = useState<PatientPayment[]>([]);
  const [billLoading, setBillLoading] = useState<boolean>(true);
  const [diagnosisLoading, setDiagnosisLoading] = useState<boolean>(true);
  const facilityPatientDetail = useMemo(() => {
    return patientBillDetails[0] ?? null;
  }, [patientBillDetails]);
  const billStatus = useMemo(() => getBillStatus(patientBillDetails), [patientBillDetails]);
  const [patientAmrsVisitDiagnosis, setPatientAmrsVisitDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  // Claim load state, surfaced on the Claim Details header. Shares the SWR request the
  // claim section itself uses, so it's not a second fetch.
  const { claimVisit, isLoading: claimLoading, isValidating: claimValidating } = useProviderClaimPreview(
    consentToken,
    locationUuid,
  );
  // Stamp the time each load/refresh completes, to show "Last refreshed at …".
  const [claimLastRefreshed, setClaimLastRefreshed] = useState<Date | null>(null);
  useEffect(() => {
    if (claimVisit && !claimValidating) {
      setClaimLastRefreshed(new Date());
    }
  }, [claimVisit, claimValidating]);

  useEffect(() => {
    if (locationUuid && patientUuid && billingDate) {
      getPatientBillDetails();
      getPatientPayments();
      getPatientAmrsVisitDiagnosis();
      getPatientAmrsMaternityDiagnosis();
    }
  }, [locationUuid, patientUuid, billingDate, refreshToken]);
  async function getPatientBillDetails() {
    setBillLoading(true);
    const patientBillPayload = generatePatientBillPayload();
    try {
      const data = await fetchPatientFacilityBillDetails(patientBillPayload);
      if (data) {
        setPatientBillDetails(data);
        setConsentToken(data[0].consent_token);
      }
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient bill details',
        kind: 'error',
        subtitle: 'An error occurred while generat',
      });
    } finally {
      setBillLoading(false);
    }
  }
  function generatePatientBillPayload(): PatientFacilityBillsDto {
    return {
      locationUuid: locationUuid,
      billingDate: billingDate,
      patientUuid: patientUuid,
    };
  }
  async function getPatientPayments() {
    const patientPaymentPayload = getPatientPaymentsPayload();
    try {
      const resp = await fetchPatientBillPayments(patientPaymentPayload);
      if (resp && resp.length > 0) {
        setPatientBillPayments(resp);
      } else {
        setPatientBillPayments([]);
      }
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient bill payments',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient bill payments',
      });
    }
  }
  function getPatientPaymentsPayload(): PatientPaymentsDto {
    return {
      patientUuid: patientUuid,
      billingDate: billingDate,
    };
  }
  function getBillStatus(patientBillDetails: PatientFacilityBillDetails[]) {
    if (patientBillDetails.length > 0) {
      const hasPostedBill = patientBillDetails.some((s) => {
        return s.paid_status === 'POSTED';
      });
      if (hasPostedBill) {
        return 'PARTIALLY PAID'
      }
      const hasPendingBill = patientBillDetails.some((s) => {
        return s.paid_status === 'PENDING';
      });
      if (hasPendingBill) {
        return 'PENDING';
      }
      return 'PAID';
    } else {
      return status;
    }
  }
  async function getPatientAmrsVisitDiagnosis() {
    setDiagnosisLoading(true);
    const amrsVisitDiagnosisPayload = getPatientAmrsVisitDiagnosisPayload();
    try {
      const resp = await fetchPatientDiagnosis(amrsVisitDiagnosisPayload);
      if (resp && resp.length > 0) {
        setPatientAmrsVisitDiagnosis((prev) => ([...prev, ...resp]));
      }
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient diagnosis',
      });
    } finally {
      setDiagnosisLoading(false);
    }
  }
  async function getPatientAmrsMaternityDiagnosis() {
    const amrsMaternityDiagnosisPayload = getPatientAmrsMaternityDiagnosisPayload();
    try {
      const resp: any = await fetchMaternityDiagnosis(amrsMaternityDiagnosisPayload);
      if (resp && resp.length > 0) {
        const results = resp.filter((r) => r?.uuid != null).map(v => ({ ...v, practitioner_identifier_type: "National ID" }));
        setPatientAmrsVisitDiagnosis((prev) => ([...prev, ...results]));
      }
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient maternity diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient maternity diagnosis',
      });
    }
  }
  function getPatientAmrsVisitDiagnosisPayload(): AmrsVisitDiagnosisDto {
    return {
      patientUuid: patientUuid,
      visitDate: billingDate,
      locationUuid: locationUuid
    };
  }
  function getPatientAmrsMaternityDiagnosisPayload(): AmrsMaternityDiagnosisDto {
    return {
      patientUuid: patientUuid,
      billingDate: billingDate
    };
  }
  return (
    <>
      <div className={styles.bdLayout}>
        {billLoading ? (
          <dl className={styles.bdHeader}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div className={styles.pdCol} key={i}>
                <dt>
                  <SkeletonText width="45%" />
                </dt>
                <dd>
                  <SkeletonText width="75%" />
                </dd>
              </div>
            ))}
          </dl>
        ) : facilityPatientDetail ? (
          <dl className={styles.bdHeader}>
            <div className={styles.pdCol}>
              <dt>Name</dt>
              <dd>{facilityPatientDetail.patient_name}</dd>
            </div>
            <div className={styles.pdCol}>
              <dt>Bill date</dt>
              <dd>{facilityPatientDetail.bill_date}</dd>
            </div>
            <div className={styles.pdCol}>
              <dt>CR</dt>
              <dd>{facilityPatientDetail.cr_no}</dd>
            </div>
            <div className={styles.pdCol}>
              <dt>Bill status</dt>
              <dd>{billStatus ?? ''}</dd>
            </div>
          </dl>
        ) : (
          <></>
        )}
        <section className={`${styles.block} ${styles.blockBills}`}>
          <header className={styles.blockHeader}>
            <span className={styles.blockIcon}>
              <Receipt size={20} />
            </span>
            <div>
              <h5 className={styles.blockTitle}>Bill Details</h5>
              <p className={styles.blockSubtitle}>Itemised charges, payments received and diagnoses for this visit.</p>
            </div>
          </header>
          <div className={styles.blockBody}>
            {patientBillDetails && (
              <BillDetails
                patientBillDetails={patientBillDetails}
                patientPayments={patientBillPayments}
                amrsVisitDiagnosis={patientAmrsVisitDiagnosis}
                locationUuid={locationUuid}
                consentToken={consentToken}
                billLoading={billLoading}
                diagnosisLoading={diagnosisLoading}
              />
            )}
          </div>
        </section>

        <section className={`${styles.block} ${styles.blockClaims}`}>
          <header className={styles.blockHeader}>
            <span className={styles.blockIcon}>
              <DocumentTasks size={20} />
            </span>
            <div>
              <h5 className={styles.blockTitle}>Claim Details</h5>
              <p className={styles.blockSubtitle}>SHA claim built from this visit's billed interventions.</p>
            </div>
            {consentToken ? (
              <div className={styles.blockHeaderStatus}>
                {claimLoading || claimValidating ? (
                  <InlineLoading description={claimLoading ? 'Loading…' : 'Refreshing…'} status="active" />
                ) : claimLastRefreshed ? (
                  <span className={styles.lastRefreshed}>
                    Last refreshed at{' '}
                    {claimLastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>
            ) : null}
          </header>
          <div className={styles.blockBody}>
            {locationUuid && consentToken ? (
              <PatientClaimDetails
                locationUuid={locationUuid}
                patientBillDetails={patientBillDetails}
                consentToken={consentToken}
              />
            ) : (
              <EmptyState message="No claim associated with this visit yet." />
            )}
          </div>
        </section>
      </div>
      <ScrollToTop />
    </>
  );
};

export default PatientBillDetails;
