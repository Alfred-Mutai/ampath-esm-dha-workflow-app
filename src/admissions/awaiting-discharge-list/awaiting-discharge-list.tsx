import React, { useMemo, useState } from 'react';
import {
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { BillStatus, FacilityEncounterBill, type BedLayout } from '../types';
import DischargeModal from '../modal/discharge/discharge-patient.modal';

interface AwaitingDischargeListProps {
  admittedPatientsData: BedLayout[];
  facilityBills: FacilityEncounterBill[];
  refresh: () => void;
}

const AwaitingDischargeList: React.FC<AwaitingDischargeListProps> = ({ admittedPatientsData, facilityBills, refresh }) => {
  const [showDischargeModal, setShowDischargeModal] = useState<boolean>(false);
  const [selectedLayout, setSelectedLayout] = useState<any>();
  if (!admittedPatientsData) {
    return <>No data to display</>;
  }
  const handleDischargeRequest = (layout: BedLayout) => {
    setSelectedLayout(layout);
    setShowDischargeModal(true);
  };
  const handleDischargeModalClose = () => {
    setShowDischargeModal(false);
  };
  const handleSuccessfullDischarge = () => {
    refresh();
  };
  const getBillStatus = (billStatus: string): BillStatus => {
    if (!billStatus) {
      return "NOT_BILLED";
    }
    if (billStatus.toUpperCase().trim() === "PAID") {
      return "PAID";
    }
    if (billStatus.toUpperCase().trim() === "PENDING") {
      return "PENDING";
    }
  }
  const rows = useMemo(() =>
    admittedPatientsData?.flatMap((layout) =>
      (layout.patients ?? []).map((patient) => ({
        key: `${layout.bedUuid}-${patient.uuid}`,
        bedNumber: layout.bedNumber,
        bedId: layout.bedId,
        status: layout.status,
        location: layout.location,
        name: patient.person.display,
        gender: patient.person.gender,
        age: patient.person.age,
        identifier: patient.identifiers?.[0]?.identifier ?? 'N/A',
        person: patient.person,
        billStatus: getBillStatus(facilityBills.find(fB => fB.patient_uuid === patient.uuid)?.bill_status)
      })),
    ) ?? []
    , [admittedPatientsData, facilityBills]);

  if (!rows.length) {
    return <>No Data</>;
  }

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
            <TableHeader>Bill Status</TableHeader>
            <TableHeader>Location</TableHeader>
            <TableHeader>Action</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.key}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{row.bedNumber}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.gender}</TableCell>
              <TableCell>{row.age}</TableCell>
              <TableCell>{row.identifier}</TableCell>
              <TableCell><BillStatusTag status={row.billStatus} /></TableCell>
              <TableCell>{row.location}</TableCell>
              <TableCell>
                <>
                  {
                    row.billStatus === "PAID" &&
                    (
                      <OverflowMenu aria-label="overflow-menu">
                        <OverflowMenuItem itemText="Discharge" onClick={() => handleDischargeRequest(row as any)} />
                      </OverflowMenu>
                    )
                  }
                </>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showDischargeModal && selectedLayout ? (
        <>
          <DischargeModal
            open={showDischargeModal}
            onModalClose={handleDischargeModalClose}
            onDischarge={handleSuccessfullDischarge}
            admissionRequest={selectedLayout}
          />
        </>
      ) : (
        <></>
      )}
    </>
  );
};

type CarbonTagColor = 'red' | 'green' | 'gray' | 'blue' | 'cyan' | 'purple' | 'magenta' | 'teal';

const BILL_STATUS_CONFIG: Record<BillStatus, { color: CarbonTagColor; label: string }> = {
  PAID: { color: 'green', label: 'Paid' },
  PENDING: { color: 'red', label: 'Pending' },
  NOT_BILLED: { color: 'blue', label: 'Not billed' },
};

function BillStatusTag({ status }: { status: BillStatus }) {
  const config = BILL_STATUS_CONFIG[status] ?? BILL_STATUS_CONFIG.NOT_BILLED;
  return <Tag type={config.color}>{config.label}</Tag>;
}

export default AwaitingDischargeList;
