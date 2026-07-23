import React, { useCallback, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Invoice from './invoice/invoice';
import BillingClaimsDashboard from './dashboard/v2/billing-claims-dashboard.component';
import ClaimWorkspace from './dashboard/v2/claim-workspace/claim-workspace.component';
import { useBillingDashboardReset } from './billing-dashboard-reset';

const BillingRoot: React.FC = () => {
  // Re-clicking "Accounting" in the side nav remounts the dashboard, which drops the
  // selected tab, drill-down and date filter back to their defaults.
  const [resetKey, setResetKey] = useState(0);
  useBillingDashboardReset(useCallback(() => setResetKey((k) => k + 1), []));

  return (
    <BrowserRouter basename={`${window.spaBase}/home/billing`}>
      <Routes>
        <Route path="" element={<BillingClaimsDashboard key={resetKey} />} />
        <Route path="/claim/new" element={<ClaimWorkspace />} />
        <Route path="/patient/:patientUuid/:billUuid" element={<Invoice />} />
      </Routes>
    </BrowserRouter>
  );
};

export default BillingRoot;
