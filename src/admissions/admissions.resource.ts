import { Encounter, fhirBaseUrl, FHIRResource, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { AdmitPatientDto, AssignBedToPatientDto, BedLayout, BedSwapDto, CancelAdmissionDto, DischargePatientDto, Disposition, DispositionResponse, FacilityBillsEncounterResponse, FacilityEncounterBill, FhirEncounterBundle, TransferPatientDto, UnAssignBedDto, type AdmissionLocationData } from './types';
import { getEtlBaseUrl } from '../shared/utils/get-base-url';

const customRep =
  'custom:(ward,totalBeds,occupiedBeds,bedLayouts:(rowNumber,columnNumber,bedNumber,bedId,bedUuid,status,location,patients:(person:full,identifiers,uuid)))';

export async function getPatientByUuid(patientUuid: string) {
  if (!patientUuid) {
    throw new Error('PatientUuid is required');
  }
  const params = {
    v: "full"
  };
  const queryString = new URLSearchParams(params).toString();
  const patientUrl = `${restBaseUrl}/patient/${patientUuid}?${queryString}`;
  const response = await openmrsFetch(patientUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch patient with ${patientUuid}`);
  }
  const result = await response.json();
  return result ?? null;
}

export async function getAdmissionLoactionData(locationUuid: string): Promise<AdmissionLocationData> {
  const admissionLocationUrl = `${restBaseUrl}/admissionLocation/${locationUuid}?v=${customRep}`;
  const response = await openmrsFetch(admissionLocationUrl);
  const result = await response.json();
  return result ?? null;
}

export async function getAdmissionRequests(locationUuid: string): Promise<Disposition[]> {
  const admissionRep = 'custom:(dispositionLocation,dispositionType,disposition,dispositionEncounter:full,patient:(uuid,identifiers,voided,person:(uuid,display,gender,age,birthdate,birthtime,preferredName,preferredAddress,dead,deathDate)),dispositionObsGroup,visit)';
  const params = {
    v: admissionRep,
    dispositionLocation: locationUuid,
    dispositionType: 'ADMIT,TRANSFER'
  };
  const queryString = new URLSearchParams(params).toString();
  const admissionRequestUrl = `${restBaseUrl}/emrapi/inpatient/request?${queryString}`;
  const response = await openmrsFetch(admissionRequestUrl);
  const result = await response.json();
  return result.results ?? null;
}

export async function fetchFacilityAdmissionRequests(locationUuid: string): Promise<[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const admissionRequestsUrl = `${etlBaseUrl}/admissions/requests?locationUuid=${locationUuid}`;
  const response = await openmrsFetch(admissionRequestsUrl);
  const result = await response.json();
  return result.results ?? [];
}

export async function getAdmittedPatientsData(locationUuid: string): Promise<BedLayout[]> {
  const admissionLocationData = await getAdmissionLoactionData(locationUuid);
  if (admissionLocationData.bedLayouts && admissionLocationData.bedLayouts.length > 0) {
    const bedLayouts = admissionLocationData.bedLayouts;
    return bedLayouts;
  } else {
    return [];
  }
}

export async function postRequest(url: string, dto: any) {
  const resp = await openmrsFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const result = await resp.json();
  return result;
}

export async function admitPatientToWard(admitPatientDto: AdmitPatientDto): Promise<Encounter> {
  const admitPatientUrl = `${restBaseUrl}/encounter`;
  return postRequest(admitPatientUrl, admitPatientDto);
}

export async function assignBedToPatient(bedId: number, assignBedToPatientDto: AssignBedToPatientDto) {
  const assignBedUrl = `${restBaseUrl}/beds/${bedId}`;
  return postRequest(assignBedUrl, assignBedToPatientDto);
}

export async function cancelAdmissionRequest(cancelAdmissionDto: CancelAdmissionDto) {
  const cancelAdmissionUrl = `${restBaseUrl}/encounter`;
  return postRequest(cancelAdmissionUrl, cancelAdmissionDto);
}

export async function bedSwapRequest(bedSwapDto: BedSwapDto) {
  const cancelAdmissionUrl = `${restBaseUrl}/encounter`;
  return postRequest(cancelAdmissionUrl, bedSwapDto);
}

export async function dischargePatientFromWard(dischargePatientDto: DischargePatientDto) {
  const cancelAdmissionUrl = `${restBaseUrl}/encounter`;
  return postRequest(cancelAdmissionUrl, dischargePatientDto);
}

export async function unassignBed(unAssignBedDto: UnAssignBedDto) {
  const params = {
    patientUuid: unAssignBedDto.patientUuid
  };
  const queryString = new URLSearchParams(params).toString();
  const unassignBedUrl = `${restBaseUrl}/beds/${unAssignBedDto.bedId}?${queryString}`;
  await openmrsFetch(unassignBedUrl, {
    method: 'DELETE'
  });
  return true;
}
export async function admitPatientElseWhere(transferPatientDto: TransferPatientDto) {
  const transferUrl = `${restBaseUrl}/encounter`;
  return postRequest(transferUrl, transferPatientDto);
}
export async function getDichargedEncounters(encounterTypeUuid: string, locationUuid: string): Promise<FhirEncounterBundle> {
  const params = {
    _summary: 'data',
    type: encounterTypeUuid,
    location: locationUuid,
    _count: '100',
    _getpagesoffset: '0'
  };
  const queryString = new URLSearchParams(params).toString();
  const encountersUrl = `${fhirBaseUrl}/Encounter?${queryString}`;
  const resp = await openmrsFetch(encountersUrl);
  const result = await resp.json();
  return result;
}

export async function fetchFacilityEncounterBills(locationUuid: string, encounterTypeUuid: string, billingFrom: string): Promise<FacilityEncounterBill[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const facilityBillsUrl = `${etlBaseUrl}/facility/encounter-bills?locationUuid=${locationUuid}&billingFrom=${billingFrom}&encounterTypeUuid=${encounterTypeUuid}`;
  const response = await openmrsFetch(facilityBillsUrl);
  const data = (await response.json()) as FacilityBillsEncounterResponse;
  return data.results ?? [];
}

export async function fetchLocationDetails(locationUuid: string){
  const v = 'custom:(uuid,display,attributes:(uuid,display,value,attributeType:(uuid,display)))';
  const locationDetailsUrl = `${restBaseUrl}/location/${locationUuid}?v=${v}`;
  const resp = await openmrsFetch(locationDetailsUrl);
  const data = await resp.json();
  return data ?? [];

}