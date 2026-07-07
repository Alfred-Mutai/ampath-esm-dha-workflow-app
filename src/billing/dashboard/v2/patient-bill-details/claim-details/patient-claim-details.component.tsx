import React, { useEffect } from "react";
import { useState } from "react";
import { type ProviderClaimPreviewDto, type ClaimsVisit, type PatientFacilityBillDetails } from "../../types";
import { showSnackbar } from "@openmrs/esm-framework";
import { fetchProviderClaimPreview, useProviderClaimPreview } from "../../../../billing-claims.resource";
import styles from './patient-claim-details.component.scss';
import ClaimVisitDetails from "../../claim-visits/claim-visit-details/claim-visit-details.component";
import { InlineLoading } from "@carbon/react";

interface patientClaimDetailsProps {
  consentToken: string;
  locationUuid: string;
  patientBillDetails: PatientFacilityBillDetails[];
}
const PatientClaimDetails: React.FC<patientClaimDetailsProps> = ({ consentToken, locationUuid, patientBillDetails }) => {
  const [patientBill, setPatientBill] = useState<PatientFacilityBillDetails>();
  const { claimVisit, isLoading, isValidating } = useProviderClaimPreview(consentToken, locationUuid);

  useEffect(() => {
    if (consentToken && locationUuid) {
      getPatientBill();
    }
  }, [consentToken, locationUuid]);

  if (isLoading && !claimVisit) {
    return <InlineLoading description='Loading data...please wait' />
  }

  function getPatientBill() {
    const bill = patientBillDetails.find(details => details.consent_token === consentToken);
    setPatientBill(bill);
  }

  return <>
    {
      isValidating &&
      <InlineLoading description='Refreshing data...' />
    }
    <div className={styles.pcLayout}>
      {
        claimVisit && <ClaimVisitDetails patientBillDetails={patientBill} claimsVisit={claimVisit} locationUuid={locationUuid} />
      }

    </div>
  </>
};
export default PatientClaimDetails;