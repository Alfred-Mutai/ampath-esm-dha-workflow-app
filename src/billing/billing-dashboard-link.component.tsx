import React from 'react';
import { createDashboardLink } from '../createDashboardLink';
import { billingDashboardMeta } from '../dashboard-meta/billing-dashboard.meta';
import { emitBillingDashboardReset } from './billing-dashboard-reset';

const DashboardLink = createDashboardLink(billingDashboardMeta);
const dashboardPath = `${billingDashboardMeta.basePath}/${billingDashboardMeta.path}`;

const stripTrailingSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/**
 * The Accounting side-nav link. Behaves like any other dashboard link, except that
 * clicking it while already on the dashboard resets it to its default view instead
 * of doing nothing — see billing-dashboard-reset.ts.
 */
const BillingDashboardLink: React.FC = () => {
  const handleClick = () => {
    if (stripTrailingSlash(window.location.pathname) === dashboardPath) {
      emitBillingDashboardReset();
    }
  };

  // The anchor is rendered by DashboardExtension, so catch its click as it bubbles.
  return (
    <div onClick={handleClick}>
      <DashboardLink />
    </div>
  );
};

export default BillingDashboardLink;
