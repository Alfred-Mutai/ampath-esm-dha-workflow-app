import React, { useEffect } from "react";
import { useState } from "react";
import { type ProviderClaimPreviewDto, type ClaimsVisit } from "../../types";
import { showSnackbar } from "@openmrs/esm-framework";
import { fetchProviderClaimPreview } from "../../../../billing-claims.resource";
import styles from './patient-claim-details.component.scss';
import ClaimVisitDetails from "../../claim-visits/claim-visit-details/claim-visit-details.component";

interface patientClaimDetailsProps {
    consentToken: string;
    locationUuid: string;
}
const PatientClaimDetails: React.FC<patientClaimDetailsProps> = ({consentToken,locationUuid})=>{
  const [claimVisit, setClaimVisit] = useState<ClaimsVisit | null>(null);
  const [loading,setLoading] = useState<boolean>(false);

  useEffect(()=>{
     if(consentToken && locationUuid){
          getPatientClaimsVisit();
     }
  },[consentToken,locationUuid]);

  if(!claimVisit){
     return <>No Claim Visit</>
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
            claimVisit && <ClaimVisitDetails claimsVisit={claimVisit}/>
        }
        
    </div>
  </>
};
export default PatientClaimDetails;