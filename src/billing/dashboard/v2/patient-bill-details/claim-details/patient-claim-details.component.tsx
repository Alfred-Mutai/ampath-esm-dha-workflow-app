import React, { useEffect } from "react";
import { useState } from "react";
import { type ProviderClaimPreviewDto, type ClaimsVisit, type PatientFacilityBillDetails } from "../../types";
import { showSnackbar } from "@openmrs/esm-framework";
import { fetchProviderClaimPreview } from "../../../../billing-claims.resource";
import styles from './patient-claim-details.component.scss';
import ClaimVisitDetails from "../../claim-visits/claim-visit-details/claim-visit-details.component";
import { InlineLoading } from "@carbon/react";

interface patientClaimDetailsProps {
  consentToken: string;
  locationUuid: string;
  patientBillDetails: PatientFacilityBillDetails[];
}
const PatientClaimDetails: React.FC<patientClaimDetailsProps> = ({ consentToken, locationUuid, patientBillDetails }) => {
  const [claimVisit, setClaimVisit] = useState<ClaimsVisit | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [patientBill, setPatientBill] = useState<PatientFacilityBillDetails>();

  useEffect(() => {
    if (consentToken && locationUuid) {
      getPatientBill();
      getPatientClaimsVisit();
    }
  }, [consentToken, locationUuid]);

  if (loading) {
    return <InlineLoading description='Loading data...please wait' />
  }

  function getPatientBill() {
    const bill = patientBillDetails.find(details => details.consent_token === consentToken);
    setPatientBill(bill);
  }

  async function getPatientClaimsVisit() {
    setLoading(true);
    const previewPayload = getProviderPreviewPayload();
    try {
      const resp = await fetchProviderClaimPreview(previewPayload);
      if (resp) {
        setClaimVisit(resp);
      } else {
        setClaimVisit(null);
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching provider preview',
        subtitle: 'An error was encountered while fetching the claim preview, retry or contact support',
      });
    } finally {
      setLoading(false);
    }
  }
  function getProviderPreviewPayload(): ProviderClaimPreviewDto {
    return {
      locationUuid: locationUuid,
      consentToken: consentToken,
    };
  }
  return <>
    <div className={styles.pcLayout}>
      {
        claimVisit && <ClaimVisitDetails patientBillDetails={patientBill} claimsVisit={claimVisit} locationUuid={locationUuid} />
      }

    </div>
  </>
};
export default PatientClaimDetails;