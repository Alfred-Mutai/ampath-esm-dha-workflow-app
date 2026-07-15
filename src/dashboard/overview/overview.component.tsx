import { FluidDropdown, Tab, TabList, TabPanel, TabPanels, Tabs, Tile } from '@carbon/react';
import React, { useState } from 'react';
import { UserMultiple, CheckmarkFilled, Time, Hospital, Chemistry, Medication } from '@carbon/react/icons';

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
          <span className={styles.cardIcon}>
            <UserMultiple size={20} />
          </span>
          <div className={styles.cardBody}>
            <p className={styles.cardLabel}>Total OPD Visits</p>
            <p className={styles.cardValue}>{dashboardSummary?.total_opd_visits ?? 0}</p>
          </div>
        </Tile>
        <Tile className={`${styles.card} ${styles.completed}`}>
          <span className={styles.cardIcon}>
            <CheckmarkFilled size={20} />
          </span>
          <div className={styles.cardBody}>
            <p className={styles.cardLabel}>Completed Visits</p>
            <p className={styles.cardValue}>{dashboardSummary?.completed_visits ?? 0}</p>
          </div>
        </Tile>
        <Tile className={`${styles.card} ${styles.uncompleted}`}>
          <span className={styles.cardIcon}>
            <Time size={20} />
          </span>
          <div className={styles.cardBody}>
            <p className={styles.cardLabel}>Uncompleted Visits</p>
            <p className={styles.cardValue}>{dashboardSummary?.uncompleted_visits ?? 0}</p>
          </div>
        </Tile>
        <Tile className={`${styles.card} ${styles.labs}`}>
          <span className={styles.cardIcon}>
            <Chemistry size={20} />
          </span>
          <div className={styles.cardBody}>
            <p className={styles.cardLabel}>Labs</p>
            <p className={styles.cardValue}>{dashboardSummary?.labs ?? 0}</p>
          </div>
        </Tile>
        <Tile className={`${styles.card} ${styles.pharmacy}`}>
          <span className={styles.cardIcon}>
            <Medication size={20} />
          </span>
          <div className={styles.cardBody}>
            <p className={styles.cardLabel}>Pharmacy</p>
            <p className={styles.cardValue}>{dashboardSummary?.pharmacy ?? 0}</p>
          </div>
        </Tile>
        <Tile className={`${styles.card} ${styles.emergencies}`}>
          <span className={styles.cardIcon}>
            <Hospital size={20} />
          </span>
          <div className={styles.cardBody}>
            <p className={styles.cardLabel}>Emergencies</p>
            <p className={styles.cardValue}>{dashboardSummary?.emergencies ?? 0}</p>
          </div>
        </Tile>
        <Tile className={`${styles.card} ${styles.waitingTime}`}>
          <span className={styles.cardIcon}>
            <Time size={20} />
          </span>
          <div className={styles.cardBody}>
            <p className={styles.cardLabel}>Avg. Waiting Time</p>
            <p className={styles.cardValue}>{dashboardSummary?.average_waiting_minutes ?? 0} mins</p>
          </div>
        </Tile>
      </div>
      <div className={styles.tabsContainer}>
        <Tabs>
          <TabList>
            <Tab>Daily</Tab>
            <Tab>Weekly</Tab>
            <Tab>Monthly</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Chart dashboardId="1bdad7e2-e9a7-4cb5-886c-185f63b2eae0" />
            </TabPanel>
            <TabPanel>
              <Chart dashboardId="0c59e7cd-2eba-4426-9d52-1db0866e0377" />
            </TabPanel>
            <TabPanel>
              <Chart dashboardId="fe8606e8-2160-4914-860a-f5abc386d9c1" />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </>
  );
};

export default Overview;
