import React, { useState } from 'react';
import { Button, OverflowMenu, OverflowMenuItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { type FacilityAdmissionRequest, type BedLayout, type Disposition } from '../types';
import AdmitPatientModal from '../modal/admit-patient/admit-patient.modal';
import { formatDate, type Patient } from '@openmrs/esm-framework';
import CancelAdmissionRequestModal from '../modal/cancel-admission-request/cancel-admission-request';
import AdmitElsewhereModal from '../modal/admit-elsewhere/admit-elsewhere.modal';

interface AdmissionListProps {
  admissionRequests: FacilityAdmissionRequest[];
  bedLayouts: BedLayout[];
  refresh: () => void;
}

const AdmissionsRequestList: React.FC<AdmissionListProps> = ({ admissionRequests, bedLayouts, refresh }) => {
  const [selectedAdmissionRequest,setSelectedAdmissionRequest] = useState<FacilityAdmissionRequest>();
  const [showAdmitModal, setShowAdmitModal] = useState<boolean>(false);
  const [showCancelAdmissionModal, setShowCancelAdmissionModal] = useState<boolean>(false);
  if (!admissionRequests || admissionRequests.length === 0) {
    return <>No Data</>;
  }
  const handleCancelRequest = (disposition: FacilityAdmissionRequest) => {
    setSelectedAdmissionRequest(disposition);
    setShowCancelAdmissionModal(true);
  };
  const handleAdmitPatient = (admissionRequest: FacilityAdmissionRequest) => {
    setShowAdmitModal(true);
    setSelectedAdmissionRequest(admissionRequest);
  };
  const handleAdmitModalClose = () => {
    setShowAdmitModal(false);
  };
  const handeSuccessfullAdmission = () => {
    handleAdmitModalClose();
    refresh();
  };
  const handleCancelAdmissionClose = () => {
    setShowCancelAdmissionModal(false);
    refresh();
  };
  const handleCancelAdmissionSuccess = () => {
    handleCancelAdmissionClose();
  };
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Date</TableHeader>
            <TableHeader>Name</TableHeader>
            <TableHeader>Gender</TableHeader>
            <TableHeader>Age</TableHeader>
            <TableHeader>Action</TableHeader>
          </TableRow>
        </TableHead>

        <TableBody>
          {admissionRequests &&
            admissionRequests.map((val, index) => (
              <TableRow key={val.patient_uuid ?? index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{formatDate(new Date(val.admission_request_date))}</TableCell>
                <TableCell>{val.patient_name}</TableCell>
                <TableCell>{val.gender}</TableCell>
                <TableCell>{val.age}</TableCell>
                <TableCell>
                  <>
                    <OverflowMenu aria-label="overflow-menu">
                      <OverflowMenuItem itemText="Cancel" onClick={() => handleCancelRequest(val)} />
                      <OverflowMenuItem itemText="Admit" onClick={() => handleAdmitPatient(val)} />
                    </OverflowMenu>
                  </>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      {
        showAdmitModal && selectedAdmissionRequest ? (<>
          <AdmitPatientModal
            onModalClose={handleAdmitModalClose}
            open={showAdmitModal}
            onSuccessfullAdmission={handeSuccessfullAdmission}
            facilityAdmissionRequest={selectedAdmissionRequest}
            bedLayouts={bedLayouts}
          />
        </>) : (<></>)
      }
      {
        showCancelAdmissionModal && selectedAdmissionRequest ? (<>
          <CancelAdmissionRequestModal
            open={showCancelAdmissionModal}
            onModalClose={handleCancelAdmissionClose}
            onCancelAdmission={handleCancelAdmissionSuccess}
            facilityAdmissionRequest={selectedAdmissionRequest}

          />
        </>) : (<></>)
      }

    </>

  );
};

export default AdmissionsRequestList;