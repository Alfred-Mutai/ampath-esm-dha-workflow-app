import React, { useEffect, useState } from 'react';
import {
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { FacilityAdmissionRequest, type AdmittedListData, type BedLayout } from '../types';
import BedSwapModal from '../modal/bed-swap/bed-swap.modal';
import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { type ConfigObject } from '../../config-schema';
import { fetchAdmittedPatients, getPatientByUuid } from '../admissions.resource';

interface AdmittedListProps {
  locationUuid: string;
  refresh: () => void;
}

const BedAssignmentRequestList: React.FC<AdmittedListProps> = ({ locationUuid, refresh }) => {
  const [showBedSwapModal, setShowBedSwapModal] = useState<boolean>(false);
  const [selectedLayout, setSelectedLayout] = useState<any>();
  const { maternityDischargeFormUuid } = useConfig<ConfigObject>();
  const [admittedPatients, setAdmittedPatients] = useState<AdmittedListData[]>([]);

  useEffect(() => {
    if (locationUuid) {
      getAdmittedPatientList();
    }
  }, [locationUuid]);
  async function getAdmittedPatientList() {
    const resp = await fetchAdmittedPatients(locationUuid);
    if (resp) {
      const unAssignedBeds = resp.filter((l) => {
        return !l.bed_id;
      });
      setAdmittedPatients(unAssignedBeds);
    } else {
      setAdmittedPatients([]);
    }
  }
  const handleTransferRequest = (layout: BedLayout) => {
    setSelectedLayout(layout);
  };
  const handleBedSwapRequest = (layout: BedLayout) => {
    setSelectedLayout(layout);
    setShowBedSwapModal(true);
  };
  const handleDischargeRequest = async (layout: any) => {
    setSelectedLayout(layout);

    if (!layout) {
      console.error('Layout is null');
      return;
    }

    const patientUuid = layout.patientUuid || layout.uuid;
    if (!patientUuid) {
      console.error('No patientUuid', layout);
      return;
    }

    try {
      const patientData = await getPatientByUuid(patientUuid);

      await launchWorkspace2(
        'admissions-form-entry',
        {
          workspaceTitle: 'Maternity Discharge Form',
          formUuid: maternityDischargeFormUuid,
          patientUuid,
        },
        {
          patient: patientData,
          patientUuid,
        },
      );
    } catch (error) {
      console.error('Failed to fetch patient data:', error);
    }
  };
  const handleBedSwapModalClose = () => {
    setShowBedSwapModal(false);
    refresh();
  };

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Bed No</TableHeader>
            <TableHeader>Patient Name</TableHeader>
            <TableHeader>Gender</TableHeader>
            <TableHeader>Age</TableHeader>
            <TableHeader>Identifier</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Location</TableHeader>
            <TableHeader>Action</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {admittedPatients.map((row, index) => (
            <TableRow key={index}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{row.bed_number}</TableCell>
              <TableCell>{row.patient_name}</TableCell>
              <TableCell>{row.gender}</TableCell>
              <TableCell>{row.age}</TableCell>
              <TableCell>
                {row.cr_id},{row.national_id}
              </TableCell>
              <TableCell>{row.bed_status}</TableCell>
              <TableCell>{row.location}</TableCell>
              <TableCell>
                <>
                  <OverflowMenu aria-label="overflow-menu">
                    <OverflowMenuItem itemText="Bed Swap" onClick={() => handleBedSwapRequest(row as any)} />
                  </OverflowMenu>
                </>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
};

export default BedAssignmentRequestList;
