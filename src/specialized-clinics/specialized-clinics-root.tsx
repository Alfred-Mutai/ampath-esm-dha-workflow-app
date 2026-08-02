import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import DialysisQueues from './dialysis/dialysis-queues.component';
import OncologyQueues from './oncology/oncology-queues.component';
import DentalQueues from './dental/dental-queues.component';
import DiagnosticAndImagingQueues from './diagnostic-and-imaging/diagnostic-and-imaging.component';
import OphthalmologyQueues from './ophthalmology/ophthalmology-queues.component';

const SpecializedClinicsRoot: React.FC = () => {
  return (
    <BrowserRouter basename={`${window.spaBase}/home/specialized-clinics`}>
      <Routes>
        <Route path="/dialysis" element={<DialysisQueues/>} />
        <Route path="/oncology" element={<OncologyQueues />} />
        <Route path="/dental" element={<DentalQueues />} />
        <Route path="/diagnostic-and-imaging" element={<DiagnosticAndImagingQueues />} />
        <Route path="/ophthalmology" element={<OphthalmologyQueues />} />
      </Routes>
    </BrowserRouter>
  );
};

export default SpecializedClinicsRoot;
