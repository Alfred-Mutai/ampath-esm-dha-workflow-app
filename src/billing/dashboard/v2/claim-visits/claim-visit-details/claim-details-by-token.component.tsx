import React from 'react';
import ClaimVisitDetails from './claim-visit-details.component';
import ClaimDetailsSkeleton from '../../patient-bill-details/claim-details/claim-details-skeleton.component';
import EmptyState from '../../shared/empty-state.component';
import { useProviderClaimPreview } from '../../../../billing-claims.resource';

interface claimDetailsByTokenProps {
  /** The claim's consent token — its authorization code on the claims endpoints. */
  consentToken: string;
  locationUuid: string;
}

/**
 * A claim's details loaded from its consent token alone.
 *
 * For callers holding a claim *listing* rather than a claim: the SHA claims table and
 * the claims-accounting list both know the token and nothing else. Everything shown here
 * comes from the live claim preview, so unlike the stored copy in /claims-visit its state
 * is current the moment it renders.
 */
const ClaimDetailsByToken: React.FC<claimDetailsByTokenProps> = ({ consentToken, locationUuid }) => {
  const { claimVisit, isLoading, isValidating, error } = useProviderClaimPreview(consentToken, locationUuid);

  // SWR keeps serving the previously opened claim while the next one loads, so a preview
  // only counts as this claim's when its authorization code is the token asked for.
  // Without the check, opening a second claim shows the first one's details as though
  // they were this claim's.
  const wantedToken = (consentToken ?? '').trim().toUpperCase();
  const claim =
    wantedToken && (claimVisit?.authorization_code ?? '').trim().toUpperCase() === wantedToken
      ? claimVisit
      : undefined;

  if (claim) {
    return <ClaimVisitDetails claimsVisit={claim} locationUuid={locationUuid} claimRefreshing={isValidating} />;
  }
  if (isLoading || isValidating) {
    return <ClaimDetailsSkeleton />;
  }
  return (
    <EmptyState
      message={
        error
          ? 'This claim couldn’t be loaded. Check your connection and try again.'
          : 'No claim details were returned for this visit.'
      }
    />
  );
};

export default ClaimDetailsByToken;
