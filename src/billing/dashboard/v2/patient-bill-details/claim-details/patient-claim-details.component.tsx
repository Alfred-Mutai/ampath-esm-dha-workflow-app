import React, { useEffect, useState } from "react";
import { type ClaimsVisit, type PatientFacilityBillDetails } from "../../types";
import {
  fetchFacilityClaimVisits,
  useInvalidateProviderClaimPreview,
  useProviderClaimPreview,
} from "../../../../billing-claims.resource";
import styles from './patient-claim-details.component.scss';
import ClaimVisitDetails from "../../claim-visits/claim-visit-details/claim-visit-details.component";
import { Button, InlineLoading } from "@carbon/react";
import { Renew, WarningAltFilled } from "@carbon/react/icons";
import ClaimDetailsSkeleton from "./claim-details-skeleton.component";
import EmptyState from "../../shared/empty-state.component";

interface patientClaimDetailsProps {
  consentToken: string;
  locationUuid: string;
  patientBillDetails: PatientFacilityBillDetails[];
}
const PatientClaimDetails: React.FC<patientClaimDetailsProps> = ({ consentToken, locationUuid, patientBillDetails }) => {
  const [patientBill, setPatientBill] = useState<PatientFacilityBillDetails>();
  // The claims-visit endpoint carries the fully-built claim (scheme, provider,
  // interventions, invoices…), matched by consent token == authorization code. The
  // provider claim-preview can come back sparse, so this is the primary source.
  const [claimFromVisit, setClaimFromVisit] = useState<ClaimsVisit>();
  const [visitLoading, setVisitLoading] = useState<boolean>(true);
  const [visitError, setVisitError] = useState<boolean>(false);
  const { claimVisit, isValidating } = useProviderClaimPreview(consentToken, locationUuid);
  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();

  useEffect(() => {
    if (consentToken && locationUuid) {
      getPatientBill();
    }
  }, [consentToken, locationUuid]);

  const loadClaimVisit = () => {
    if (!consentToken || !locationUuid) {
      return;
    }
    setVisitLoading(true);
    setVisitError(false);
    fetchFacilityClaimVisits({ consentToken, locationUuid })
      .then((data) => setClaimFromVisit(data?.[0]?.visitResponse))
      .catch(() => setVisitError(true))
      .finally(() => setVisitLoading(false));
  };

  useEffect(() => {
    loadClaimVisit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentToken, locationUuid]);

  function getPatientBill() {
    const bill = patientBillDetails.find(details => details.consent_token === consentToken);
    setPatientBill(bill);
  }

  // Prefer the claims-visit data; fall back to the provider preview if it's absent.
  const claim = claimFromVisit ?? claimVisit;

  if (visitLoading && !claim) {
    return <ClaimDetailsSkeleton />
  }

  if (visitError && !claim) {
    return (
      <div className={styles.errorState}>
        <WarningAltFilled size={32} className={styles.errorIcon} />
        <div>
          <p className={styles.errorTitle}>Claim details couldn’t be loaded</p>
          <p className={styles.errorSubtitle}>
            The claims service is unreachable right now. Check your connection and try again.
          </p>
        </div>
        <Button
          kind="tertiary"
          size="sm"
          renderIcon={Renew}
          onClick={() => {
            loadClaimVisit();
            invalidateProviderClaimPreview();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return <>
    {
      isValidating &&
      <InlineLoading description='Refreshing data...' />
    }
    <div className={styles.pcLayout}>
      {
        claim ? (
          <ClaimVisitDetails patientBillDetails={patientBill} claimsVisit={claim} locationUuid={locationUuid} hidePatientIdentity />
        ) : (
          <EmptyState message="No claim details available for this visit." />
        )
      }
    </div>
  </>
};
export default PatientClaimDetails;
