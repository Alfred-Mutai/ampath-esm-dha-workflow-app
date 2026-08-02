import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import DialysisQueues from './dialysis/dialysis-queues.component';
import OncologyQueues from './oncology/oncology-queues.component';

const SpecializedClinicsRoot: React.FC = () => {
  return (
    <BrowserRouter basename={`${window.spaBase}/home/specialized-clinics`}>
      <Routes>
        <Route path="/dialysis" element={<DialysisQueues/>} />
        <Route path="/oncology" element={<OncologyQueues />} />
      </Routes>
    </BrowserRouter>
  );
};

export default SpecializedClinicsRoot;
