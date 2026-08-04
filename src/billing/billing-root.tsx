import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Invoice from './invoice/invoice';
import BillingClaimsDashboard, { resetBillingDateFilter } from './dashboard/v2/billing-claims-dashboard.component';
import ClaimWorkspace from './dashboard/v2/claim-workspace/claim-workspace.component';
import ClaimDetailsPage from './dashboard/v2/claim-visits/claim-visit-details/claim-details-page.component';
import BillDetailsPage from './dashboard/v2/patient-bill-details/bill-details-page.component';
import { useBillingDashboardReset } from './billing-dashboard-reset';

const BillingRoot: React.FC = () => {
  // Re-clicking "Accounting" in the side nav remounts the dashboard, which drops the
  // selected tab, drill-down and date filter back to their defaults.
  const [resetKey, setResetKey] = useState(0);
  useBillingDashboardReset(
    useCallback(() => {
      resetBillingDateFilter();
      setResetKey((k) => k + 1);
    }, []),
  );

  // This root only unmounts when the user navigates out of billing altogether — the
  // routes below swap under it without tearing it down — so its cleanup is the right
  // place to forget the date filter and have a return visit start on today.
  useEffect(() => () => resetBillingDateFilter(), []);

  return (
    <BrowserRouter basename={`${window.spaBase}/home/billing`}>
      <Routes>
        <Route path="" element={<BillingClaimsDashboard key={resetKey} />} />
        <Route path="/claim/new" element={<ClaimWorkspace />} />
        {/* Ranked below /claim/new — react-router prefers the static segment. */}
        <Route path="/claim/:claimId" element={<ClaimDetailsPage />} />
        {/* A bill on its own page, the same move the claim route made — reachable by URL,
            and Back returns to the list rather than out of billing. */}
        <Route path="/bill/:patientUuid" element={<BillDetailsPage />} />
        <Route path="/patient/:patientUuid/:billUuid" element={<Invoice />} />
      </Routes>
    </BrowserRouter>
  );
};

export default BillingRoot;
