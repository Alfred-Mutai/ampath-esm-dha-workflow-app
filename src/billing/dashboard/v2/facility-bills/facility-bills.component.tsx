import React, { useEffect } from 'react';
import { useState } from 'react';
import { type FacilityBillsDto, type FacilityBill, BillingView } from '../types';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { fetchFacilityBills } from '../../../billing-claims.resource';
import styles from './facility-bills.component.scss';
import PatientBillDetails from '../patient-bill-details/patient-bill-details';

interface facilityBillsProps {}
const FacilityBills: React.FC<facilityBillsProps> = () => {
  const [facilityBills, setFacilityBills] = useState<FacilityBill[]>([]);
  const [currentView, setCurrentView] = useState<BillingView>(BillingView.Bills);
  const [selectedPatientUuid,setSelectedPatientUuid] = useState<string>('');
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const billingDate = new Date().toISOString().split('T')[0] ?? '';
  useEffect(() => {
    if (locationUuid) {
      getFacilityBills();
    }
  }, []);
  async function getFacilityBills() {
    const facilityBillsPayload = generateFacilityBillsPayload();
    try {
      const data = await fetchFacilityBills(facilityBillsPayload);
      if (data) {
        setFacilityBills(data);
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching facility bills',
        subtitle: 'An error occurred while fetehcing facility bills, please reload or contact support',
      });
    }
  }
  function generateFacilityBillsPayload(): FacilityBillsDto {
    return {
      locationUuid: locationUuid ?? '',
      billingDate: billingDate,
    };
  }
  function toggleView(newView: BillingView,patientUuid: string) {
    setCurrentView(newView);
    setSelectedPatientUuid(patientUuid);
  }
  function formatStatusColumn(status: string){
    const statusArr = status.split(',');
    
    if(statusArr.length > 0){
        const hasPendingBill = statusArr.some((s)=>{
        return s === 'PENDING';
        });
        if(hasPendingBill){
             return 'PENDING'
        }else{
            return 'PAID';
        }
         
    }else{
        return status;
    }
  }
  return (
    <>
      {currentView === BillingView.Bills ? (
        <>
          <Table aria-label="sample table" size="lg">
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Patient</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Cashpoint</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {facilityBills &&
                facilityBills.map((fb, index) => {
                  return (
                    <>
                      <TableRow key={fb.patient_uuid}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{fb.bill_date}</TableCell>
                        <TableCell>
                          <div className={styles.clickableData} onClick={() => toggleView(BillingView.BillDetails,fb.patient_uuid)}>
                            {fb.patient_name}
                          </div>
                        </TableCell>
                        <TableCell>{formatStatusColumn(fb.paid_status)}</TableCell>
                        <TableCell>{fb.cash_point}</TableCell>
                      </TableRow>
                    </>
                  );
                })}
            </TableBody>
          </Table>
        </>
      ) : (
        <></>
      )}
      {
        currentView === BillingView.BillDetails ? (<>
        <div>
           <Button kind='primary' onClick={()=>toggleView(BillingView.Bills,'')}>Back</Button>
        </div>
        <div>
         <PatientBillDetails 
           locationUuid={locationUuid}
           billingDate={billingDate}
           patientUuid={selectedPatientUuid}
         />
         </div>
        </>):(<></>)
      }
    </>
  );
};

export default FacilityBills;
