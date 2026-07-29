import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import React, { useEffect, useState } from 'react';
import { getActiveVisits } from '../../billing-claims.resource';
import { useSession } from '@openmrs/esm-framework';
import { type ActiveVisit } from './types';

interface ActiveVisitsProps {
  billingDate: string;
}

const ActiveVisitsComponent: React.FC<ActiveVisitsProps> = ({ billingDate }) => {
  const [activeVisits, setactiveVisits] = useState<ActiveVisit[]>([]);
  const session = useSession();

  const locationUuid = session.sessionLocation?.uuid;
  const getActivevisits = async (locationUuid: string, billingDate: string) => {
    try {
      const res = await getActiveVisits(locationUuid!, billingDate);
      setactiveVisits(res.results);
    } catch (er) {
      console.error(er);
    }
  };

  useEffect(() => {
    getActivevisits(locationUuid!, billingDate);
  }, [billingDate, locationUuid]);

  const handleInitiateClaim = (visit: ActiveVisit) => {};
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
          {activeVisits.length > 0 ? (
            activeVisits.map((visit, index) => (
              <TableRow key={index}>
                <TableCell>{visit.patient_name}</TableCell>
                <TableCell>{visit.identifiers}</TableCell>
                <TableCell>{visit.visit_type}</TableCell>
                <TableCell>{visit.payment_method}</TableCell>
                <TableCell>{visit.payment_status}</TableCell>
                <TableCell>
                  {visit.payment_method?.toUpperCase() === 'CASH' && (
                    <Button size="sm" kind="primary" onClick={() => handleInitiateClaim(visit)}>
                      Initiate SHA Claim
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5}>No active visits found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
};

export default ActiveVisitsComponent;
