import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { closeWorkspace, launchWorkspace, useSession } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { type PendingBillLineItems, type ActiveCashVisit } from '../types';
import { getActiveCashVisits, getFacilityBillLineItems } from '../../../billing-claims.resource';
import SendToQueueModal from '../../../../registry/modal/send-to-triage/send-to-queue.modal';
import styles from './cash-patients.scss';

interface CashPatientsProps {
  billingDate: string;
}

const CashPatients: React.FC<CashPatientsProps> = ({ billingDate }) => {
  const [cashPatients, setCashPatients] = useState<ActiveCashVisit[]>([]);
  const [pendingBillItems, setPendingBillItems] = useState<PendingBillLineItems[]>([]);
  const [patientUuid, setPatientUuid] = useState<string | null>('');
  const [visitUuid, setVisitUuid] = useState<string | null>('');
  const [visitTypeUuid, setVisitTypeUuid] = useState('');

  const session = useSession();

  const locationUuid = session.sessionLocation?.uuid;

  useEffect(() => {
    if (!locationUuid) return;

    const fetchAll = async () => {
      try {
        const [visitsRes, pendingRes] = await Promise.all([
          getActiveCashVisits(locationUuid, billingDate),
          getFacilityBillLineItems(locationUuid, billingDate),
        ]);
        setCashPatients(visitsRes?.results ?? []);
        setPendingBillItems(pendingRes ?? []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchAll();
  }, [billingDate, locationUuid]);

  const mergedPatients: (ActiveCashVisit | PendingBillLineItems)[] = (() => {
    const pendingByVisitUuid = new Map(pendingBillItems.map((item) => [item.visit_uuid, item]));

    const result: (ActiveCashVisit | PendingBillLineItems)[] = [...pendingBillItems];

    cashPatients.forEach((visit) => {
      if (!pendingByVisitUuid.has(visit.visit_uuid)) {
        result.push(visit);
      }
    });

    return result;
  })();

  //finalize bill

  // https://o3.openmrs.org/openmrs/ws/rest/v1/billing/bill/9782ecd4-514a-4a92-be78-f7c7a2b2562c
  // payload status: "POSTED"

  // process payment

  // https://o3.openmrs.org/openmrs/ws/rest/v1/billing/bill/9782ecd4-514a-4a92-be78-f7c7a2b2562c/payment
  // payload amount: 500 amountTendered: 500 instanceType: "526bf278-ba81-4436-b867-c2f6641d060a"

  const handleGenerateBill = async (
    visit: ActiveCashVisit | PendingBillLineItems,
    patientUuid: string,
    visitTypeUuid: string,
    visitUuid: string,
  ) => {
    if ('line_item_date' in visit) {
      closeWorkspace('pay-cash-workspace', { ignoreChanges: true });

      setTimeout(() => {
        launchWorkspace('pay-cash-workspace', {
          lineItems: (visit as PendingBillLineItems).pending_line_items,
        });
      }, 50);
      return;
    }
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
      <div className={styles.tableContainer}>
        <Table aria-label="sample table" size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Identifiers</TableHeader>
              <TableHeader>Payment Method</TableHeader>
              <TableHeader>Visit Type</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {mergedPatients?.length > 0 ? (
              mergedPatients?.map((visit, index) => (
                <TableRow key={index}>
                  <TableCell>{visit.patient_name}</TableCell>
                  <TableCell>{visit.identifiers}</TableCell>
                  <TableCell>{visit.payment_method}</TableCell>
                  <TableCell>{visit.visit_type}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      kind="primary"
                      onClick={() =>
                        handleGenerateBill(visit, visit.patient_uuid, visit.visit_type_uuid, visit.visit_uuid)
                      }
                    >
                      Open Billing
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5}>No Patients found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {patientUuid && visitUuid && (
        <SendToQueueModal
          patientUuid={patientUuid}
          visitUuid={visitUuid}
          visitTypeUuid={visitTypeUuid}
          onModalClose={onModalClose}
          isCash={true}
        />
      )}
    </>
  );
};

export default CashPatients;
