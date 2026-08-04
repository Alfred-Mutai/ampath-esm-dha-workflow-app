import { Concept, Encounter, Obs, Patient, Visit, type Location } from '@openmrs/esm-framework';

export type DispositionType = 'ADMIT' | 'TRANSFER';
export type DispositionResponse = {
  results: Disposition[];
};

export type Disposition = {
  dispositionLocation: Location;
  dispositionType: DispositionType;
  disposition: Concept;
  dispositionEncounter: Encounter;
  patient: Patient;
  dispositionObsGroup: Obs;
  visit: Visit;
};

export interface BedTag {
  id: number;
  name: string;
  uuid: string;
  resourceVersion: string;
}

export interface BedTagMap {
  uuid: string;
  bedTag: BedTag;
  resourceVersion: string;
}

export interface BedType {
  uuid: string;
  name: string;
  displayName: string;
  description: string;
  resourceVersion: string;
}

export type BedStatus = 'OCCUPIED' | 'AVAILABLE';

export interface BedLayout {
  rowNumber: number;
  columnNumber: number;
  bedNumber: string;
  bedId: number;
  bedUuid: string;
  status: BedStatus;
  location: string;
  bedType: BedType | null;
  patients: Patient[];
  bedTagMaps: BedTagMap[];
  resourceVersion: string;
}

export interface AdmissionLocationData {
  ward: Location;
  totalBeds: number;
  occupiedBeds: number;
  bedLayouts: BedLayout[];
  resourceVersion: string;
}

export interface EncounterDto {
  patient: string;
  encounterType: {
    uuid: string;
  };
  location: string;
  obs: any[];
  visit?: string;
}

export interface AdmitPatientDto extends EncounterDto {}
export type AssignBedToPatientDto = {
  patientUuid: string;
  encounterUuid: string;
};

export interface CancelAdmissionDto extends EncounterDto {}

export interface BedSwapDto extends EncounterDto {}

export interface DischargePatientDto extends EncounterDto {}
export interface TransferPatientDto extends EncounterDto {}
export type UnAssignBedDto = {
  patientUuid: string;
  bedId: number;
};

export interface FhirEncounterBundle {
  resourceType: 'Bundle';
  id: string;
  meta: FhirBundleMeta;
  type: 'searchset';
  total: number;
  link: FhirBundleLink[];
  entry: FhirBundleEntry<FhirEncounter>[];
}

export interface FhirBundleMeta {
  lastUpdated: string;
  tag: FhirMetaTag[];
}

export interface FhirMetaTag {
  system: string;
  code: string;
  display: string;
}

export interface FhirBundleLink {
  relation: string;
  url: string;
}

export interface FhirBundleEntry<TResource> {
  fullUrl: string;
  resource: TResource;
}

export interface FhirEncounter {
  resourceType: 'Encounter';
  id: string;
  meta: FhirEncounterMeta;
  status: string;
  class: FhirEncounterClass;
  type: FhirEncounterType[];
  subject: FhirReferenceWithDisplay<'Patient'>;
  participant: FhirEncounterParticipant[];
  period: FhirPeriod;
  location: FhirEncounterLocationComponent[];
  partOf: FhirReference<'Encounter'>;
}

export interface FhirEncounterMeta {
  versionId: string;
  lastUpdated: string;
  tag: FhirMetaTag[];
}

export interface FhirEncounterClass {
  system: string;
  code: string;
}

export interface FhirEncounterType {
  coding: FhirCoding[];
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirEncounterParticipant {
  individual: FhirParticipantIndividual;
}

export interface FhirParticipantIndividual {
  reference: string;
  type: 'Practitioner';
  identifier?: {
    value: string;
  };
  display: string;
}

export interface FhirPeriod {
  start: string;
}

export interface FhirEncounterLocationComponent {
  location: FhirReferenceWithDisplay<'Location'>;
}

export interface FhirReference<TType extends string> {
  reference: string; // e.g. "Encounter/..."
  type: TType;
}

export interface FhirReferenceWithDisplay<TType extends string> extends FhirReference<TType> {
  display: string;
}

export type BillStatus = 'PAID' | 'PENDING' | 'NOT_BILLED';

export type FacilityEncounterBill = {
  encounter_datetime: string;
  date_created: string;
  bill_uuid: string;
  receipt_number: string;
  patient_name: string;
  bill_status: string;
  patient_uuid: string;
  date_started: string | null;
  date_stopped: string | null;
  bed_number: string | null;
};

export type FacilityBillsEncounterResponse = {
  results: FacilityEncounterBill[];
};

export type FacilityAdmissionRequest = {
  admission_request_date: string;
  admission_location: string;
  identifiers: string;
  patient_name: string;
  age: number;
  gender: string;
  location_uuid: string;
  patient_uuid: string;
  visit_uuid: string;
  visit_type: string;
};

export type FacilityAdmissionRequestsResp = {
  results: FacilityAdmissionRequest[];
};

export const SERVICE_POINT_NAME = 'ADMISSION';
export const CLAIM_VISIT_START_SERVICE_POINTS_UUID = '49df844d-79c0-40fc-8ca9-c27d6391f647';
export type LocationAttribute = {
  uuid: string;
  display: string;
  value: string;
  attributeType: {
    uuid: string;
    display: string;
    resourceVersion: string;
  };
  resourceVersion: string;
};

export type AdmittedListData = {
  patient_name: string;
  national_id: string;
  cr_id: string;
  admision_date: string;
  encounter_type: string;
  location: string;
  location_uuid: string;
  gender: string;
  age: number;
  bed_number: string | null;
  bed_status: string | null;
  bed_id: string | null;
};
