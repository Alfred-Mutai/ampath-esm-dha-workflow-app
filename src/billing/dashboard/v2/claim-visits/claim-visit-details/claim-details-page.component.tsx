import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, Button } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import ClaimDetailsByToken from './claim-details-by-token.component';
import ClaimDetailsSkeleton from '../../patient-bill-details/claim-details/claim-details-skeleton.component';
import EmptyState from '../../shared/empty-state.component';
import { findClaimVisitByGuid, useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import { rememberedBillingDate } from '../../billing-claims-dashboard.component';
import styles from '../../facility-bills/facility-bills.component.scss';
import pageStyles from './claim-details-page.component.scss';

/**
 * Resolve the claim id in the URL to the consent token its details are fetched with.
 *
 * Coming from the list, the token travels in router state and nothing is fetched. On a
 * cold open — a pasted link, a reload — the id is looked up against the claims of this
 * location. An id that resolves to nothing is treated as a token itself, which is what
 * makes the handful of rows carrying no guid still openable.
 */
function useClaimConsentToken(claimId: string, locationUuid: string, seedToken?: string) {
  const [token, setToken] = useState<string>(seedToken ?? '');
  const [resolving, setResolving] = useState<boolean>(!seedToken);

  useEffect(() => {
    if (seedToken) {
      setToken(seedToken);
      setResolving(false);
      return;
    }
    if (!claimId || !locationUuid) {
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    findClaimVisitByGuid(claimId, locationUuid, rememberedBillingDate() ?? undefined)
      .then((claimVisit) => {
        if (cancelled) {
          return;
        }
        setToken((claimVisit?.authorizationCode || claimVisit?.visitResponse?.authorization_code || claimId).trim());
        setResolving(false);
      })
      .catch(() => {
        if (!cancelled) {
          setToken(claimId);
          setResolving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [claimId, locationUuid, seedToken]);

  return { token, resolving };
}

/**
 * A claim on its own page, addressed by its authorization guid. Opening a claim used to
 * swap the dashboard's contents in place, which left the claim unreachable by URL and
 * made the browser's Back button leave billing altogether. Here the id is in the path,
 * so a claim can be linked to and reloaded, and Back returns to the list.
 */
const ClaimDetailsPage: React.FC = () => {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();

  // Ids are path-encoded on the way in; a raw one would break on any character the path
  // reserves.
  const id = decodeURIComponent(claimId ?? '').trim();
  const seedToken = (routerLocation.state as { consentToken?: string } | null)?.consentToken;
  const { token, resolving } = useClaimConsentToken(id, locationUuid, seedToken);

  return (
    <div className={`${pageStyles.page} ${styles.detailsView}`}>
      <div className={styles.detailsHeader}>
        <Breadcrumb noTrailingSlash className={styles.breadcrumb}>
          <BreadcrumbItem>
            {/* Back to the dashboard, which reopens on the tab and status bucket the
                claim was picked from. */}
            <button type="button" className={styles.breadcrumbLink} onClick={() => navigate('/')}>
              Facility bills
            </button>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>Claim details</BreadcrumbItem>
        </Breadcrumb>
        {token ? (
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Renew}
            iconDescription="Reload"
            onClick={invalidateProviderClaimPreview}
          >
            Reload Claim
          </Button>
        ) : null}
      </div>
      {resolving ? (
        <ClaimDetailsSkeleton />
      ) : token ? (
        <ClaimDetailsByToken consentToken={token} locationUuid={locationUuid} />
      ) : (
        <EmptyState message="No claim was named in this address." />
      )}
    </div>
  );
};

export default ClaimDetailsPage;
