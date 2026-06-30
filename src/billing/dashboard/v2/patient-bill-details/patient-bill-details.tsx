import React, { useEffect, useMemo, useState } from 'react';
import styles from './patient-bill-details.scss';
import { type PatientFacilityBillsDto, type PatientFacilityBillDetails } from '../types';
import { fetchPatientFacilityBillDetails } from '../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-styleguide';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import BillDetails from './bill-details/bill-details';
interface patientBillDetailsProps {
  patientUuid: string;
  locationUuid: string;
  billingDate: string;
}
const PatientBillDetails: React.FC<patientBillDetailsProps> = ({ patientUuid, locationUuid, billingDate }) => {
  const [patientBillDetails, setPatientBillDetails] = useState<PatientFacilityBillDetails[]>([]);
  const facilityPatientDetail = useMemo(()=>{
      return patientBillDetails[0] ?? null;
  },[patientBillDetails]);

  useEffect(() => {
    if(locationUuid && patientUuid && billingDate){
         getPatientBillDetails();
    }
  }, [locationUuid, patientUuid, billingDate]);
  async function getPatientBillDetails() {
    const patientBillPayload = generatePatientBillPayload();
    try {
      const data = await fetchPatientFacilityBillDetails(patientBillPayload);
      if (data) {
        setPatientBillDetails(data);
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
  return (
    <>
      <div className={styles.bdLayout}>
        <div className={styles.bdHeader}>
           {
             facilityPatientDetail ? (<>
               <div className={styles.pdCol}>
                  <strong>Name:</strong> { facilityPatientDetail.patient_name}
               </div>
               <div className={styles.pdCol}>
                  <strong>CashPoint:</strong> { facilityPatientDetail.cash_point}
               </div>
               <div className={styles.pdCol}>
                   <strong>Bill Date:</strong> { facilityPatientDetail.bill_date}
               </div>
               <div className={styles.pdCol}>
                   <strong>CR:</strong> { facilityPatientDetail.cr_no}
               </div>
                <div className={styles.pdCol}>
                   <strong>AMRS Universl ID:</strong> { facilityPatientDetail.amrs_universal_id}
               </div>
             </>): (<></>)
           }
        </div>
        <div>
        <Tabs>
          <TabList scrollDebounceWait={200}>
            <Tab>Bill Details</Tab>
            <Tab>Claim</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
                {patientBillDetails && <BillDetails patientBillDetails={patientBillDetails} />}
            </TabPanel>
            <TabPanel>Claim</TabPanel>
          </TabPanels>
        </Tabs>
        </div>
      </div>
    </>
  );
};

export default PatientBillDetails;
