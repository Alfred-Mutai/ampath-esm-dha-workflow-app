/**
 * This is the entrypoint file of the application. It communicates the
 * important features of this microfrontend to the app shell. It
 * connects the app shell to the React application(s) that make up this
 * microfrontend.
 */
import { getAsyncLifecycle, defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { registryDashboardMeta } from './dashboard-meta/registry-dashboard.meta';
import { createDashboardLink } from './createDashboardLink';
import { createDashboardLink as openMrsCreateDashboardLink } from '@openmrs/esm-patient-common-lib';
import { queueDashboardMeta } from './dashboard-meta/queue-dashboard.meta';
import { pharmacyDashboardMeta } from './dashboard-meta/pharmacy-dashboard.meta';
import { triageDashboardMeta } from './dashboard-meta/triage-dashboard.meta';
import { consultationDashboardMeta } from './dashboard-meta/consultation-dashboard.meta';
import { dhaWorkflowDashboardMeta } from './dashboard-meta/dha-workflow-dashboard.meta';
import { accountingDashboardMeta } from './dashboard-meta/accounting-dashboard.meta';
import { registersDashboardMeta } from './dashboard-meta/registers-dashboard.meta';
import { reportsDashboardMeta } from './dashboard-meta/reports-dashboard.meta';
import { bookingsDashboardMeta } from './dashboard-meta/bookings-dashboard.meta';
import { mchQueueDashboardMeta } from './dashboard-meta/mch-dashboard.meta';
import { serviceQueueAdminDashboardMeta } from './dashboard-meta/service-queue-admin.meta';
import { admissionsDashboardMeta } from './dashboard-meta/admissions-dashboard.meta';
import { patientChartAdmissionsMetaData } from './dashboard-meta/inpatient-admissions.meta';
import { billingDashboardMeta } from './dashboard-meta/billing-dashboard.meta';

export const moduleName = '@ampath/esm-dha-workflow-app';

const options = {
  featureName: 'Consulation Workflow',
  moduleName,
};

/**
 * This tells the app shell how to obtain translation files: that they
 * are JSON files in the directory `../translations` (which you should
 * see in the directory structure).
 */
export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

/**
 * This function performs any setup that should happen at microfrontend
 * load-time (such as defining the config schema) and then returns an
 * object which describes how the React application(s) should be
 * rendered.
 */
export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const navLinks = getAsyncLifecycle(() => import('./side-nav-menu/nav-links'), {
  featureName: 'side-nav-workflow-link',
  moduleName,
});

/**
 * This named export tells the app shell that the default export of `root.component.tsx`
 * should be rendered when the route matches `root`. The full route
 * will be `openmrsSpaBase() + 'root'`, which is usually
 * `/openmrs/spa/root`.
 */
export const root = getAsyncLifecycle(() => import('./root.component'), options);
export const registry = getAsyncLifecycle(() => import('./registry/registry.component'), options);
export const waitingPatientsExtension = getAsyncLifecycle(
  () => import('./service-queues/metrics/metrics-cards/waiting-patients.extension'),
  options,
);
export const attendedToPatientsExtension = getAsyncLifecycle(
  () => import('./service-queues/metrics/metrics-cards/attended-patients.extension'),
  options,
);
export const triageWaitingPatientsExtension = getAsyncLifecycle(
  () => import('./triage/metrics/waiting-patients.extension'),
  options,
);
export const triageAttendedToPatientsExtension = getAsyncLifecycle(
  () => import('./triage/metrics/attended-patients.extension'),
  options,
);

export const workflowRegistryLink = getAsyncLifecycle(() => import('./widgets/workflow-registry-link.extension'), {
  featureName: 'workflow-registry-link',
  moduleName,
});

export const registryDashboardLink = getSyncLifecycle(createDashboardLink(registryDashboardMeta), options);

export const registryExtension = getAsyncLifecycle(() => import('./registry/registry.component'), options);

export const queueDashboardLink = getSyncLifecycle(createDashboardLink(queueDashboardMeta), options);

export const queueDashboardExtension = getAsyncLifecycle(() => import('./dashboard/dashboard.component'), options);

export const pharmacyDashboardLink = getSyncLifecycle(createDashboardLink(pharmacyDashboardMeta), options);

export const triageDashboardLink = getSyncLifecycle(createDashboardLink(triageDashboardMeta), options);

export const triageQueueExtension = getAsyncLifecycle(() => import('./triage/triage.component'), options);

export const consultationDashboardLink = getSyncLifecycle(createDashboardLink(consultationDashboardMeta), options);

export const consultationQueue = getAsyncLifecycle(
  () => import('./service-queues/consultation/consultation.component'),
  options,
);

export const dhaWorkflowDashboardLink = getSyncLifecycle(createDashboardLink(dhaWorkflowDashboardMeta), options);

export const dhaWorkflowDashboard = getAsyncLifecycle(() => import('./dashboard/dashboard.component'), options);

export const accountingDashboardLink = getSyncLifecycle(createDashboardLink(accountingDashboardMeta), options);

export const accountingDashboard = getAsyncLifecycle(() => import('./accounting/accounting.component'), options);

export const registersDashboardLink = getSyncLifecycle(createDashboardLink(registersDashboardMeta), options);

export const registersDashboard = getAsyncLifecycle(() => import('./registers/registers.component'), options);

export const reportsDashboardLink = getSyncLifecycle(createDashboardLink(reportsDashboardMeta), options);

export const reportsDashboard = getAsyncLifecycle(() => import('./reports/reports.component'), options);

export const bookingsDashboardLink = getSyncLifecycle(createDashboardLink(bookingsDashboardMeta), options);

export const bookings = getAsyncLifecycle(() => import('./bookings/bookings.component'), options);

export const mnchQueueDashboardLink = getSyncLifecycle(createDashboardLink(mchQueueDashboardMeta), options);

export const mnchQueueDashboard = getAsyncLifecycle(() => import('./mch/mch-queues.component'), options);

export const serviceQueueAdmin = getAsyncLifecycle(
  () => import('./service-queues/admin/service-queue-admin-dashboard.component'),
  options,
);

export const serviceQueuesAdminLink = getSyncLifecycle(createDashboardLink(serviceQueueAdminDashboardMeta), options);
export const admissionsDashboardLink = getSyncLifecycle(createDashboardLink(admissionsDashboardMeta), options);

export const admissionsDashboard = getAsyncLifecycle(
  () => import('./admissions/admissions-dashboard.component'),
  options,
);

export const serviceQueueBannerComponent = getAsyncLifecycle(
  () => import('./service-queues/extensions/service-queue-patient-banner/service-queue-patient-banner'),
  options,
);
export const patientChartAdmissionsLink = getSyncLifecycle(
  openMrsCreateDashboardLink(patientChartAdmissionsMetaData as any),
  options,
);
export const patientAdmissionSummary = getAsyncLifecycle(
  () => import('./admissions/inpatient/inpatient-admissions.component'),
  options,
);
export const billingDashboardLink = getSyncLifecycle(createDashboardLink(billingDashboardMeta), options);

export const billingDashboard = getAsyncLifecycle(
  () => import('./billing/dashboard/billingDashboard.component'),
  options,
);

export const billingRoot = getAsyncLifecycle(() => import('./billing/billing-root'), options);

export const createOrderBillFormWorkspace = getAsyncLifecycle(
  () => import('./billing/workspaces/create-order-bill-form-workspace/create-order-bill-form.workspace'),
  options,
);

export const visitBillingForm = getAsyncLifecycle(
  () => import('./billing/extensions/visit-billing/visit-billing.extension'),
  options,
);
