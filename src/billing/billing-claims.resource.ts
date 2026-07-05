import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
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
  type PatientPaymentsDto,
  type PatientPaymentReponse,
  type PatientPayment,
  type BillPaymentDto,
  type BillPaymentResponse,
  type AddClaimLineDto,
  type CloseClaimDto,
  type SubmitClaimDto,
  type AddClaimDiagnosisDto,
  type RemoveClaimLineDto,
} from './dashboard/v2/types';
import { getHieBaseUrl } from '../claims/utils';
import { type AmrsVisitDiagnosis, type AmrsVisitDiagnosisDto, type AmrsVisitDiagnosisResponse } from './types';

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

export async function fetchPatientClaimVisit(
  claimVisitsDto: ClaimVisitsDto,
): Promise<ClaimVisitReponse[]> {
  const claimVisitsFilter:ClaimVisitsDto = {};
 if(claimVisitsDto.consentToken){
    claimVisitsFilter['consentToken'] = claimVisitsDto.consentToken;
 }
 if(claimVisitsDto.patientId){
    claimVisitsFilter['patientId'] = claimVisitsDto.patientId;
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

export async function fetchPatientBillPayments(
  patientPaymentsDto: PatientPaymentsDto,
): Promise<PatientPayment[]>{
  const etlBaseUrl = await getEtlBaseUrl();
  const patientPaymentsUrl = `${etlBaseUrl}/bill/patient/payment?billingDate=${patientPaymentsDto.billingDate}&patientUuid=${patientPaymentsDto.patientUuid}`;
  const response = await openmrsFetch(patientPaymentsUrl);
  const data = (await response.json()) as PatientPaymentReponse;
  return data.results ?? [];
}

export async function payBillItem(billUuid: string,billPaymentDto: BillPaymentDto){
  const billPaymentUrl = `${restBaseUrl}/billing/bill/${billUuid}/payment`;
  const response = await openmrsFetch(billPaymentUrl,{
    method: 'POST',
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify(billPaymentDto)
  });
  const data = (await response.json()) as BillPaymentResponse;
  return data ?? null;
}

export async function addClaimItem(addClaimLineDto: AddClaimLineDto){
  const { hieBaseUrl } = await getHieBaseUrl();
  const addClaimLineUrl = `${hieBaseUrl}/claim-line`;
  const response = await openmrsFetch(addClaimLineUrl,{
    method: 'POST',
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify(addClaimLineDto)
  });
  const data = (await response.json());
  return data ?? null;
}

export async function removeClaimItem(removeClaimLineDto: RemoveClaimLineDto){
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claim-line`;
  const result = await openmrsFetch(url,{
    method: 'DELETE',
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify(removeClaimLineDto)
  }).catch((error) => {
      const message = error?.responseBody?.message ?? "";
      if (typeof message === "object") {
          throw `${message?.join(",")}`;
      }
      throw message;
  });

  if (result?.data && "error" in result.data && "message" in result.data) {
      const message = result.data.message ?? "";
      throw message;
  }
  return result?.data;
}

export async function closeClaim(closeClaimDto: CloseClaimDto){
  const { hieBaseUrl } = await getHieBaseUrl();
  const addClaimLineUrl = `${hieBaseUrl}/claim-closure`;
  const response = await openmrsFetch(addClaimLineUrl,{
    method: 'POST',
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify(closeClaimDto)
  });
  const data = (await response.json()) as ClaimVisitReponse;
  return data ?? null;
}

export async function submitClaim(submitClaimDto: SubmitClaimDto){
  const { hieBaseUrl } = await getHieBaseUrl();
  const addClaimLineUrl = `${hieBaseUrl}/claim-submission`;
  const response = await openmrsFetch(addClaimLineUrl,{
    method: 'POST',
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify(submitClaimDto)
  });
  const data = (await response.json()) as ClaimVisitReponse;
  return data ?? null;
}

export async function fetchPatientDiagnosis(
  amrsVisitDiagnosisDto: AmrsVisitDiagnosisDto,
): Promise<AmrsVisitDiagnosis[]>{
  const etlBaseUrl = await getEtlBaseUrl();
  const patientDiagnosisUrl = `${etlBaseUrl}/patient/diagnosis?visitDate=${amrsVisitDiagnosisDto.visitDate}&patientUuid=${amrsVisitDiagnosisDto.patientUuid}&locationUuid=${amrsVisitDiagnosisDto.locationUuid}`;
  const response = await openmrsFetch(patientDiagnosisUrl);
  const data = (await response.json()) as AmrsVisitDiagnosisResponse;
  return data.results ?? [];
}

export async function addClaimDiagnosis(addClaimDiagnosisDto: AddClaimDiagnosisDto){
  const { hieBaseUrl } = await getHieBaseUrl();
  const addClaimDiagnosisUrl = `${hieBaseUrl}/claim-diagnosis`;
  const response = await openmrsFetch(addClaimDiagnosisUrl,{
    method: 'POST',
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify(addClaimDiagnosisDto)
  });
  const data = (await response.json());
  return data ?? null;
}
