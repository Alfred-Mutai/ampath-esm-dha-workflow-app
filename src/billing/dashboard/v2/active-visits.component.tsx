import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import React, { useEffect, useState } from 'react';
import { getActiveVisits } from '../../billing-claims.resource';
import { usePatient, useSession } from '@openmrs/esm-framework';
import { type ActiveVisit } from './types';
import SendToQueueModal from '../../../registry/modal/send-to-triage/send-to-queue.modal';

interface ActiveVisitsProps {
  billingDate: string;
}

const ActiveVisitsComponent: React.FC<ActiveVisitsProps> = ({ billingDate }) => {
  const [activeVisits, setactiveVisits] = useState<ActiveVisit[]>([]);
  const [patientUuid, setPatientUuid] = useState<string | null>('');
  const [visitUuid, setVisitUuid] = useState<string | null>('');
  const [visitTypeUuid, setVisitTypeUuid] = useState('');
  const session = useSession();

  const locationUuid = session.sessionLocation?.uuid;
  const getActivevisits = async (locationUuid: string, billingDate: string) => {
    try {
      const res = await getActiveVisits(locationUuid!, billingDate);
      setactiveVisits(res);
    } catch (er) {
      console.error(er);
    }
  };

  useEffect(() => {
    getActivevisits(locationUuid!, billingDate);
  }, [billingDate, locationUuid]);

  const handleInitiateClaim = (patientUuid: string, visitTypeUuid: string, visitUuid: string) => {
    setPatientUuid(patientUuid);
    setVisitTypeUuid(visitTypeUuid);
    setVisitUuid(visitUuid);
  };

  function onModalClose({ success }: { success: boolean }): void {
    setPatientUuid(null);
    setVisitUuid(null);
  }
  return (
    <>
      <Table aria-label="sample table" size="sm">
        <TableHead>
          <TableRow>
            <TableHeader>Name</TableHeader>
            <TableHeader>Identifiers</TableHeader>
            <TableHeader>Visit Type</TableHeader>
            <TableHeader>Payment Method</TableHeader>
            <TableHeader>Payment Status</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {activeVisits?.length > 0 ? (
            activeVisits?.map((visit, index) => (
              <TableRow key={index}>
                <TableCell>{visit.patient_name}</TableCell>
                <TableCell>{visit.identifiers}</TableCell>
                <TableCell>{visit.visit_type}</TableCell>
                <TableCell>{visit.payment_method}</TableCell>
                <TableCell>{visit.payment_status}</TableCell>
                <TableCell>
                  {visit.payment_method?.toUpperCase() === 'CASH' && (
                    <Button
                      size="sm"
                      kind="primary"
                      onClick={() => handleInitiateClaim(visit.person_uuid, visit.visit_type_uuid, visit.visit_uuid)}
                    >
                      Initiate SHA Claim
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6}>No active visits found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {patientUuid && visitUuid && (
        <SendToQueueModal
          patientUuid={patientUuid}
          visitUuid={visitUuid}
          visitTypeUuid={visitTypeUuid}
          onModalClose={onModalClose}
          addSHAClaimVisit={true}
        />
      )}
    </>
  );
};

export default ActiveVisitsComponent;
