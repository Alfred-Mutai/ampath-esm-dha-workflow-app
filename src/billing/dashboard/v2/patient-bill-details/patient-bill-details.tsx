import React, { useEffect, useMemo, useState } from 'react';
import styles from './patient-bill-details.scss';
import {
  type PatientFacilityBillsDto,
  type PatientFacilityBillDetails,
  type ClaimVisitsDto,
  type PatientPaymentsDto,
  type PatientPayment,
} from '../types';
import {
  fetchPatientBillPayments,
  fetchPatientClaimVisit,
  fetchPatientFacilityBillDetails,
} from '../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-styleguide';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import BillDetails from './bill-details/bill-details';
import PatientClaimDetails from './claim-details/patient-claim-details.component';
interface patientBillDetailsProps {
  patientUuid: string;
  locationUuid: string;
  billingDate: string;
}
const PatientBillDetails: React.FC<patientBillDetailsProps> = ({ patientUuid, locationUuid, billingDate }) => {
  const [patientBillDetails, setPatientBillDetails] = useState<PatientFacilityBillDetails[]>([]);
  const [consentToken, setConsentToken] = useState<string>('');
  const [patientBillPayments, setPatientBillPayments] = useState<PatientPayment[]>([]);
  const facilityPatientDetail = useMemo(() => {
    return patientBillDetails[0] ?? null;
  }, [patientBillDetails]);
  const billStatus = useMemo(()=>getBillStatus(patientBillDetails),[patientBillDetails]);

  useEffect(() => {
    if (locationUuid && patientUuid && billingDate) {
      getPatientBillDetails();
      getPatientPayments();
    }
  }, [locationUuid, patientUuid, billingDate]);
  async function getPatientBillDetails() {
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
      if(hasPostedBill){
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
  return (
    <>
      <div className={styles.bdLayout}>
        <div className={styles.bdHeader}>
          {facilityPatientDetail ? (
            <>
              <div className={styles.pdCol}>
                <strong>Name:</strong> {facilityPatientDetail.patient_name}
              </div>
              <div className={styles.pdCol}>
                <strong>CashPoint:</strong> {facilityPatientDetail.cash_point}
              </div>
              <div className={styles.pdCol}>
                <strong>Bill Date:</strong> {facilityPatientDetail.bill_date}
              </div>
              <div className={styles.pdCol}>
                <strong>CR:</strong> {facilityPatientDetail.cr_no}
              </div>
              <div className={styles.pdCol}>
                <strong>AMRS Universl ID:</strong> {facilityPatientDetail.amrs_universal_id}
              </div>
               <div className={styles.pdCol}>
                <strong>Bill Status:</strong> { billStatus ?? ''}
              </div>
            </>
          ) : (
            <></>
          )}
        </div>
        <div>
          <Tabs>
            <TabList scrollDebounceWait={200}>
              <Tab>Bill Details</Tab>
              <Tab>Claim</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                {patientBillDetails && (
                  <BillDetails 
                  patientBillDetails={patientBillDetails} 
                  patientPayments={patientBillPayments} 
                  locationUuid = {locationUuid}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {locationUuid && consentToken ? (
                  <>
                    <PatientClaimDetails locationUuid={locationUuid} patientBillDetails={patientBillDetails} consentToken={consentToken} />
                  </>
                ) : (
                  <></>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default PatientBillDetails;
