import { useEffect, useRef } from 'react';

/**
 * Clicking the "Accounting" side-nav link while the dashboard is already open is a
 * no-op as far as routing goes — single-spa's navigateToUrl short-circuits when the
 * destination pathname and search match the current ones, so nothing re-renders and
 * the user is left on whichever tab / drill-down they had open.
 *
 * The link therefore announces the click on this event and the dashboard listens for
 * it to send itself back to its default view.
 */
export const BILLING_DASHBOARD_RESET_EVENT = 'ampath:billing-dashboard-reset';

export function emitBillingDashboardReset() {
  window.dispatchEvent(new CustomEvent(BILLING_DASHBOARD_RESET_EVENT));
}

export function useBillingDashboardReset(onReset: () => void) {
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    const handler = () => onResetRef.current();
    window.addEventListener(BILLING_DASHBOARD_RESET_EVENT, handler);
    return () => window.removeEventListener(BILLING_DASHBOARD_RESET_EVENT, handler);
  }, []);
}
