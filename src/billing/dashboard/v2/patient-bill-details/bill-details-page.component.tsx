import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, Button, Tag } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import PatientBillDetails from './patient-bill-details';
import EmptyState from '../shared/empty-state.component';
import { rememberedBillingDate } from '../billing-claims-dashboard.component';
import { type PaymentModeDescriptor } from './payment-mode';
import styles from '../facility-bills/facility-bills.component.scss';
import pageStyles from '../claim-visits/claim-visit-details/claim-details-page.component.scss';
import ownStyles from './bill-details-page.component.scss';

/**
 * A patient's bill on its own page, addressed by their uuid.
 *
 * Opening a bill used to swap the Facility bills tab's contents in place, which left the
 * bill unreachable by URL and made Back leave billing altogether. This is the same move
 * the claim details page made, and deliberately the same shape — breadcrumb, reload,
 * then the details — so a bill and a claim are read the same way.
 *
 * What differs between one bill and the next is who is paying for it. That is resolved by
 * `paymentModeOf` rather than being decided here, so the cash, SHA, co-pay and other
 * insurance cases are one page reading a descriptor rather than four pages.
 */
const BillDetailsPage: React.FC = () => {
  const { patientUuid } = useParams<{ patientUuid: string }>();
  const navigate = useNavigate();
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const [refresh, setRefresh] = useState(0);
  // What the bill turns out to be paid by, reported up from the details once its lines
  // have loaded — the page can't know before then, since the payer is a property of the
  // lines rather than of the patient.
  const [mode, setMode] = useState<PaymentModeDescriptor | null>(null);

  // Uuids are path-encoded on the way in; a raw one would break on any reserved character.
  const uuid = decodeURIComponent(patientUuid ?? '').trim();
  // The day the list was filtered to, so the bill opens on the same day it was picked
  // from. A cold open — a pasted link — falls back to today inside the details.
  const billingDate = rememberedBillingDate() ?? new Date().toLocaleDateString('en-CA');

  return (
    <div className={`${pageStyles.page} ${styles.detailsView}`}>
      <div className={styles.detailsHeader}>
        <Breadcrumb noTrailingSlash className={styles.breadcrumb}>
          <BreadcrumbItem>
            {/* Back to the dashboard, which reopens on the tab the bill was picked from. */}
            <button type="button" className={styles.breadcrumbLink} onClick={() => navigate('/')}>
              Facility bills
            </button>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>Bill details</BreadcrumbItem>
        </Breadcrumb>
        <div className={ownStyles.headerActions}>
          {/* Who is paying, stated on the page itself rather than left to be inferred from
              which figures happen to be filled in. */}
          {mode ? (
            <span className={ownStyles.payer}>
              <Tag size="sm" type={mode.tagType}>
                {mode.label}
              </Tag>
              {mode.schemeName && mode.schemeName.toUpperCase() !== mode.label.toUpperCase() ? (
                <span className={ownStyles.payerScheme}>{mode.schemeName}</span>
              ) : null}
            </span>
          ) : null}
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Renew}
            iconDescription="Reload"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Reload Bills
          </Button>
        </div>
      </div>
      {uuid ? (
        <PatientBillDetails
          locationUuid={locationUuid}
          billingDate={billingDate}
          patientUuid={uuid}
          refreshToken={refresh}
          onPaymentModeResolved={setMode}
        />
      ) : (
        <EmptyState message="No patient was named in this address." />
      )}
    </div>
  );
};

export default BillDetailsPage;
