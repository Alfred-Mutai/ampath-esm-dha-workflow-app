import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ClaimsVisit, type PatientFacilityBillDetails } from "../../types";
import {
  fetchFacilityClaimVisits,
  useClaimChanged,
  useInvalidateProviderClaimPreview,
  useProviderClaimPreview,
} from "../../../../billing-claims.resource";
import styles from './patient-claim-details.component.scss';
import ClaimVisitDetails from "../../claim-visits/claim-visit-details/claim-visit-details.component";
import { Button } from "@carbon/react";
import { Renew, WarningAltFilled } from "@carbon/react/icons";
import ClaimDetailsSkeleton from "./claim-details-skeleton.component";
import EmptyState from "../../shared/empty-state.component";

interface patientClaimDetailsProps {
  consentToken: string;
  locationUuid: string;
  patientBillDetails: PatientFacilityBillDetails[];
  /** Bumped by "Reload Bills" to pull the claim again alongside the bill. */
  refreshToken?: number;
  onBillDetailsChange?: () => void;
}
const PatientClaimDetails: React.FC<patientClaimDetailsProps> = ({
  consentToken,
  locationUuid,
  patientBillDetails,
  refreshToken,
  onBillDetailsChange,
}) => {
  const [patientBill, setPatientBill] = useState<PatientFacilityBillDetails>();
  // The claims-visit endpoint carries the fully-built claim (scheme, provider,
  // interventions, invoices…), matched by consent token == authorization code. The
  // provider claim-preview can come back sparse, so this is the primary source.
  const [claimFromVisit, setClaimFromVisit] = useState<ClaimsVisit>();
  const [visitLoading, setVisitLoading] = useState<boolean>(true);
  const [visitError, setVisitError] = useState<boolean>(false);
  const {
    claimVisit,
    isLoading: claimLoading,
    isValidating: claimValidating,
  } = useProviderClaimPreview(consentToken, locationUuid);
  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();

  useEffect(() => {
    if (consentToken && locationUuid) {
      getPatientBill();
    }
  }, [consentToken, locationUuid]);

  // Claim mutations can land in quick succession — the diagnosis auto-add fires once
  // per diagnosis — so several loads may be in flight at once. Only the newest is
  // allowed to write, otherwise a slow earlier response could clobber fresher data.
  const loadSeq = useRef(0);

  const loadClaimVisit = useCallback(() => {
    if (!consentToken || !locationUuid) {
      return;
    }
    const seq = ++loadSeq.current;
    setVisitLoading(true);
    setVisitError(false);
    fetchFacilityClaimVisits({ consentToken, locationUuid })
      .then((data) => {
        if (seq === loadSeq.current) {
          setClaimFromVisit(data?.[0]?.visitResponse);
        }
      })
      .catch(() => {
        if (seq === loadSeq.current) {
          setVisitError(true);
        }
      })
      .finally(() => {
        if (seq === loadSeq.current) {
          setVisitLoading(false);
        }
      });
  }, [consentToken, locationUuid]);

  useEffect(() => {
    loadClaimVisit();
  }, [loadClaimVisit]);

  // This response isn't SWR-backed, so it has no cache to invalidate and would
  // otherwise stay as first fetched — stale the moment a diagnosis is added to the
  // claim. Refetch on any claim mutation to keep it level with the claim preview.
  useClaimChanged(loadClaimVisit);

  // An explicit reload — "Reload Bills", or the Refresh control on the Claim Details
  // header. Invalidating the preview refreshes both halves: it revalidates the
  // SWR-backed preview and announces the change, which the subscription above picks up
  // to reload the claims-visit response. Skipped on the initial 0, where the mount
  // effect has already loaded everything.
  //
  // `reloading` drives a skeleton for the duration. A deliberate reload gets one because
  // the point of asking is to see current data, and leaving the old claim on screen
  // makes it look current when it isn't. Mutations deliberately don't set this — they
  // refresh in place, so attaching a document doesn't tear down the section and discard
  // work staged against another intervention.
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (refreshToken) {
      setReloading(true);
      invalidateProviderClaimPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // Both sources settle independently; the skeleton clears once neither is in flight.
  useEffect(() => {
    if (reloading && !visitLoading && !claimLoading && !claimValidating) {
      setReloading(false);
    }
  }, [reloading, visitLoading, claimLoading, claimValidating]);

  function getPatientBill() {
    const bill = patientBillDetails.find(details => details.consent_token === consentToken);
    setPatientBill(bill);
  }

  // claim-preview/provider is the reference for this page. It is the live view of the
  // claim — revalidated on every mutation — and carries the whole record: workflow
  // state, invoices, interventions, diagnoses, attachments and doctors. The claims-visit
  // response is fetched once on mount, so anything read from it is stale as soon as the
  // claim changes; that is what left Diagnosis empty and the attachment count short
  // while the preview already listed them.
  //
  // It stays a merge rather than a straight swap because the preview has been seen to
  // come back sparse. The preview wins on every field it actually has a value for, and
  // the claims-visit response fills in the rest instead of a gap blanking the page.
  const claim = useMemo<ClaimsVisit | undefined>(() => {
    if (!claimVisit && !claimFromVisit) {
      return undefined;
    }
    const merged = { ...(claimFromVisit ?? ({} as ClaimsVisit)) };
    for (const [key, value] of Object.entries(claimVisit ?? {})) {
      const isMissing =
        value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (!isMissing) {
        merged[key] = value;
      }
    }
    return merged;
  }, [claimFromVisit, claimVisit]);

  // The state on the claims-visit response is the copy stored when the visit was
  // recorded, so it is frozen at DRAFT for anything submitted since; only the preview
  // carries the live one. Until the preview has produced a state the card treats it as
  // unknown, rather than showing DRAFT and correcting itself seconds later.
  //
  // The wait ends when the preview settles, however it settles: a preview that comes
  // back sparse or errors leaves the stored state as the best available, and it is shown
  // rather than spinning forever on a state that is never going to arrive.
  //
  // The preview is only accepted as this claim's when its authorization code matches the
  // consent token asked for: SWR keeps serving the previous response while a new one is
  // in flight, and the state of the claim opened before this one is no better than a
  // stale one.
  const previewIsForThisClaim =
    (claimVisit?.authorization_code ?? '').trim().toUpperCase() === (consentToken ?? '').trim().toUpperCase();
  const liveWorkflowState = previewIsForThisClaim ? (claimVisit?.workflow_state ?? '').trim() : '';
  const claimStateUnconfirmed = !liveWorkflowState && (claimLoading || claimValidating);

  // Skeleton on the first load, and again for the length of an explicit reload.
  if (reloading || (visitLoading && !claim)) {
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

  return (
    <div className={styles.pcLayout}>
      {claim ? (
        <ClaimVisitDetails
          patientBillDetails={patientBill}
          claimsVisit={claim}
          locationUuid={locationUuid}
          hidePatientIdentity
          // While either source is in flight the claim on screen may already be out of
          // date — SWR keeps serving the previous response — so the actions stand down
          // rather than act on a state that is mid-change.
          claimRefreshing={claimLoading || claimValidating || visitLoading}
          claimStateUnconfirmed={claimStateUnconfirmed}
        />
      ) : (
        <EmptyState message="No claim details available for this visit." />
      )}
    </div>
  );
};
export default PatientClaimDetails;
