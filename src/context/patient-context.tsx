import React, { createContext, useContext, useState } from 'react';
import { type HieClient } from '../registry/types';

interface PatientContextType {
  patient: HieClient | null;
  setPatient: React.Dispatch<React.SetStateAction<HieClient | null>>;
}
const PatientContext = createContext<PatientContextType | undefined>(undefined);

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patient, setPatient] = useState<HieClient | null>(null);

  return <PatientContext.Provider value={{ patient, setPatient }}>{children}</PatientContext.Provider>;
};

export const usePatient = () => {
  const context = useContext(PatientContext);

  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }

  return context;
};
