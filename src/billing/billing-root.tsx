import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Invoice from './invoice/invoice';
import BillingClaimsDashboard from './dashboard/v2/billing-claims-dashboard.component';
import ClaimWorkspace from './dashboard/v2/claim-workspace/claim-workspace.component';

const BillingRoot: React.FC = () => {
  return (
    <BrowserRouter basename={`${window.spaBase}/home/billing`}>
      <Routes>
        <Route path="" element={<BillingClaimsDashboard />} />
        <Route path="/claim/new" element={<ClaimWorkspace />} />
        <Route path="/patient/:patientUuid/:billUuid" element={<Invoice />} />
      </Routes>
    </BrowserRouter>
  );
};

export default BillingRoot;
