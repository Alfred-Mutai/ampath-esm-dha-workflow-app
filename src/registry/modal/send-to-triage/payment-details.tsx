import {
  Checkbox,
  ComboBox,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { type Patient } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import styles from './send-to-triage.modal.scss';
import { PatientTypes } from '../../../shared/constants/patient-type';
import { PaymentDetail } from '../../types';

interface PaymentDetailsSectionProps {
  patients: Patient[];
  onPatientSelect: (patient: Patient) => void;
  patientTypeHandler: (selectedPatientType: {
    selectedItem: {
      id: string;
      text: string;
    } | null;
  }) => void;
  paymentDetailsHandler: (value: string) => void;
}

const PaymentDetailsSection: React.FC<PaymentDetailsSectionProps> = ({
  patients,
  onPatientSelect,
  patientTypeHandler,
  paymentDetailsHandler,
}) => {
  const patientTypeOptions = useMemo(
    () => [
      {
        text: 'Walk-In',
        id: PatientTypes.WALK_IN_UUID,
      },
      {
        text: 'Self-Referral',
        id: PatientTypes.SELF_RERERRAL_UUID,
      },
      {
        text: 'Referral from another Facility',
        id: PatientTypes.REFERRAL_FROM_ANOTHER_FACILITY_UUID,
      },
      {
        text: 'Referral from Community',
        id: PatientTypes.REFERRED_BY_COMMUNITY_HEALTH_WORKER_UUID,
      },
    ],
    [],
  );

  const paymentDetails = Object.values(PaymentDetail).map((value) => {
    return {
      id: value,
      label: value,
    };
  });
  return (
    <>
      <div className={styles.patientSelect}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>No</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Gender</TableHeader>
              <TableHeader>Select Patient</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((p, index) => (
              <TableRow key={p.uuid}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{p.person.preferredName.display}</TableCell>
                <TableCell>{p.person.gender}</TableCell>
                <TableCell>
                  <Checkbox id={p.uuid} labelText="" onChange={() => onPatientSelect(p)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className={styles.formSection}>
        <div className={styles.formRow}>
          <div className={styles.formControl}>
            <ComboBox
              onChange={patientTypeHandler}
              id="patient-type-combobox"
              items={patientTypeOptions}
              itemToString={(item) => (item ? item.text : '')}
              titleText="Patient Type"
            />
          </div>
          <div className={styles.formControl}>
            <Select
              id="payment-details"
              labelText="Payment Details"
              onChange={($event) => paymentDetailsHandler($event.target.value)}
            >
              <SelectItem value="" text="Select" />;
              {paymentDetails.map((pd) => {
                return <SelectItem value={pd.id} text={pd.label} />;
              })}
            </Select>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentDetailsSection;
