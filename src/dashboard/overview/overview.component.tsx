import { FluidDropdown, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import React, { useState } from 'react';

import styles from './overview.component.scss';
import { type QueueEntryResult } from '../../registry/types';
import PatientList from '../patient-list/patient-list.component';
import Chart from '../charts/chart.component';
import {
  MetricsCard,
  MetricsCardHeader,
  MetricsCardBody,
  MetricsCardItem,
} from '../../service-queues/metrics/metrics-cards/metrics-card.component';

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

  const cards = [
    { key: 'opd', title: 'Total OPD Visits', unit: 'Visits', value: dashboardSummary?.total_opd_visits ?? 0 },
    { key: 'completed', title: 'Completed Visits', unit: 'Visits', value: dashboardSummary?.completed_visits ?? 0 },
    { key: 'uncompleted', title: 'Uncompleted Visits', unit: 'Visits', value: dashboardSummary?.uncompleted_visits ?? 0 },
    { key: 'labs', title: 'Labs', unit: 'Orders', value: dashboardSummary?.labs ?? 0 },
    { key: 'pharmacy', title: 'Pharmacy', unit: 'Orders', value: dashboardSummary?.pharmacy ?? 0 },
    { key: 'emergencies', title: 'Emergencies', unit: 'Patients', value: dashboardSummary?.emergencies ?? 0 },
    {
      key: 'waiting',
      title: 'Avg. Waiting Time',
      unit: 'Minutes',
      value: `${dashboardSummary?.average_waiting_minutes ?? 0} mins`,
    },
  ];

  return (
    <>
      <div className={styles.container}>
        {cards.map(({ key, title, unit, value }) => (
          <MetricsCard key={key}>
            <MetricsCardHeader title={title} />
            <MetricsCardBody>
              <MetricsCardItem label={unit} value={value} />
            </MetricsCardBody>
          </MetricsCard>
        ))}
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
