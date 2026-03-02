import { FluidDropdown, Tile } from '@carbon/react';
import React, { useState } from 'react';
import { UserMultiple, CheckmarkFilled, Time, Hospital } from '@carbon/react/icons';

import styles from './overview.component.scss';
import { type QueueEntryResult } from '../../registry/types';
import PatientList from '../patient-list/patient-list.component';
import Chart from '../charts/chart.component';

interface OverviewProps {
  triageCount?: QueueEntryResult[];
  consultationCount?: QueueEntryResult[];
  dashboardSummary?: any;
}

const Overview: React.FC<OverviewProps> = ({ triageCount, consultationCount, dashboardSummary }) => {
  const totalPatients: QueueEntryResult[] = [...triageCount, ...consultationCount];
  const patientsInQueue = totalPatients.filter(
    (patient) => patient.status === 'WAITING' || patient.status === 'IN SERVICE',
  ).length;
  const [selected, setSelected] = useState<string | null>(null);
  const triagePatients = triageCount?.length ?? 0;
  const consultationPatients = consultationCount?.length ?? 0;
  const dropDownItems = [
    'Total Patients',
    'Triage Patients',
    'Consultation Patients',
    'Walk-In Patients',
    'Emergency Patients',
  ];

  const handleDropdownChange = (data: { selectedItem: string }) => {
    const value = data.selectedItem;
    setSelected(value);
  };

  let selectedPatients: QueueEntryResult[] = [];

  switch (selected) {
    case 'Triage Patients':
      selectedPatients = triageCount ?? [];
      break;

    case 'Consultation Patients':
      selectedPatients = consultationCount ?? [];
      break;
    case 'Walk-In Patients':
      selectedPatients = [];
      break;
    case 'Emergency Patients':
      selectedPatients = [];
      break;

    case 'Total Patients':
      selectedPatients = [...(triageCount ?? []), ...(consultationCount ?? [])];
      break;

    default:
      selectedPatients = [...(triageCount ?? []), ...(consultationCount ?? [])];
      break;
  }

  return (
    <>
      <div className={styles.container}>
        <Tile className={`${styles.card} ${styles.opd}`}>
          <h4 className={styles.text}>
            <UserMultiple size={24} />
            Total OPD Visits
          </h4>
          <h4 className={styles.text}>{dashboardSummary?.total_opd_visits ?? 0}</h4>
        </Tile>
        <Tile className={`${styles.card} ${styles.completed}`}>
          <h4 className={styles.text}>
            <CheckmarkFilled size={20} /> Completed Visits
          </h4>
          <h4 className={styles.text}>{dashboardSummary?.completed_visits ?? 0}</h4>
        </Tile>
        <Tile className={`${styles.card} ${styles.uncompleted}`}>
          <h4 className={styles.text}>
            <Time size={20} /> Uncompleted visits
          </h4>
          <h4 className={styles.text}>{dashboardSummary?.uncompleted_visits ?? 0}</h4>
        </Tile>
        <Tile className={`${styles.card} ${styles.emergencies}`}>
          <h4 className={styles.text}>
            <Hospital size={20} /> Emergencies
          </h4>
          <h4 className={styles.text}>{dashboardSummary?.emergencies ?? 0}</h4>
        </Tile>
        <Tile className={`${styles.card} ${styles.waitingTime}`}>
          <h4 className={styles.text}>
            <Time size={20} /> Avg. Waiting Time
          </h4>
          <h4 className={styles.text}>{dashboardSummary?.average_waiting_minutes ?? 0} mins</h4>
        </Tile>
      </div>
      <Chart />
    </>
  );
};

export default Overview;
