import { openmrsFetch } from '@openmrs/esm-framework';
import { getEtlBaseUrl } from '../shared/utils/get-base-url';
import {
  type FacilityBillsResponse,
  type FacilityBillsDto,
  type FacilityBill,
  type PatientFacilityBillsDto,
  type PatientFacilityBillDetailsResponse,
  type PatientFacilityBillDetails,
  type ClaimVisitsDto,
  type ClaimVisitReponse,
  type ProviderClaimPreviewDto,
  type ClaimsVisit,
} from './dashboard/v2/types';
import { getHieBaseUrl } from '../claims/utils';


export async function fetchFacilityBills(facilityBillsDto: FacilityBillsDto): Promise<FacilityBill[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const facilityBillsUrl = `${etlBaseUrl}/facility/bills?locationUuid=${facilityBillsDto.locationUuid}&billingDate=${facilityBillsDto.billingDate}`;
  const response = await openmrsFetch(facilityBillsUrl);
  const data = (await response.json()) as FacilityBillsResponse;
  return data.results ?? [];
}

export async function fetchPatientFacilityBillDetails(
  patientFacilityBillsDto: PatientFacilityBillsDto,
): Promise<PatientFacilityBillDetails[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const patientfacilityBillDetailsUrl = `${etlBaseUrl}/facility/patient/bill?locationUuid=${patientFacilityBillsDto.locationUuid}&billingDate=${patientFacilityBillsDto.billingDate}&patientUuid=${patientFacilityBillsDto.patientUuid}`;
  const response = await openmrsFetch(patientfacilityBillDetailsUrl);
  const data = (await response.json()) as PatientFacilityBillDetailsResponse;
  return data.results ?? [];
}

export async function fetchFacilityClaimVisits(claimVisitsDto: ClaimVisitsDto): Promise<ClaimVisitReponse[]> {
 const claimVisitsFilter:ClaimVisitsDto = {};
 if(claimVisitsDto.consentToken){
    claimVisitsFilter['consentToken'] = claimVisitsDto.consentToken;
 }
 if(claimVisitsDto.locationUuid){
    claimVisitsFilter['locationUuid'] = claimVisitsDto.locationUuid;
 }
 if(claimVisitsDto.visitDate){
   claimVisitsFilter['visitDate'] = claimVisitsDto.visitDate;
 }
  const { hieBaseUrl } = await getHieBaseUrl();
  const queryString = new URLSearchParams(claimVisitsFilter).toString();
  const response = await openmrsFetch(`${hieBaseUrl}/claims-visit?${queryString}`);
  const data = (await response.json()) as ClaimVisitReponse[];
  return data ?? [];
}

export async function fetchProviderClaimPreview(
  providerClaimPreviewDto: ProviderClaimPreviewDto,
): Promise<ClaimsVisit> {
  const { hieBaseUrl } = await getHieBaseUrl();
  const providerClaimPreviewUrl = `${hieBaseUrl}/claim-preview/provider`;
  const response = await openmrsFetch(providerClaimPreviewUrl,{
    method: 'POST',
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify(providerClaimPreviewDto)
  });
  const data = (await response.json()) as ClaimsVisit;
  return data ?? null;
}
