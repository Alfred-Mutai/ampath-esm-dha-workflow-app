import React from 'react';
import RegistryComponent from './registry.component';
import { PatientProvider } from '../context/patient-context';

export default function RegistryEntry() {
  return (
    <PatientProvider>
      <RegistryComponent />
    </PatientProvider>
  );
}
