import React from 'react';
import styles from './root.scss';
import { useLeftNav, WorkspaceContainer } from '@openmrs/esm-framework';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RegistryComponent from './registry/registry.component';
import LeftPanel from './left-panel/left-panel.component';
import Triage from './triage/triage.component';
import LaboratoryComponent from './laboratory/laboratory.component';
import AppointmentsComponent from './appointments/appointments.component';
import PharmacyComponent from './pharmacy/pharmacy.component';
import Consultation from './service-queues/consultation/consultation.component';
import Dashboard from './dashboard/dashboard.component';
import DailyBookings from './bookings/daily/daily-bookings.component';
import Mortuary from './mortuary/mortuary.component';
import ServiceQueueAdminDashboard from './service-queues/admin/service-queue-admin-dashboard.component';
import AdmissionsDashboard from './admissions/admissions-dashboard.component';

const Root: React.FC = () => {
  const spaBasePath = window.spaBase;
  useLeftNav({
    name: 'dha-workflow-slot',
    basePath: spaBasePath,
    mode: 'normal',
  });
  return (
    <BrowserRouter basename={`${window.spaBase}/dha-workflow`}>
      <LeftPanel />
      <main className={styles.container}>
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="registration" element={<RegistryComponent />} />
          <Route path="consultation" element={<Consultation />} />
          <Route path="triage" element={<Triage />} />
          <Route path="laboratory" element={<LaboratoryComponent />} />
          <Route path="pharmacy" element={<PharmacyComponent />} />
          <Route path="appointments" element={<AppointmentsComponent />} />
          <Route path="bookings/daily" element={<DailyBookings />} />
          <Route path="mortuary" element={<Mortuary />} />
          <Route path="service-queue-admin" element={<ServiceQueueAdminDashboard />} />
          <Route path="admissions-dashboard" element={<AdmissionsDashboard />} />
        </Routes>
      </main>
      <WorkspaceContainer contextKey="home" />
    </BrowserRouter>
  );
};

export default Root;
