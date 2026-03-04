import { type Location, type Patient } from '@openmrs/esm-framework';

export type IdentifierType = 'National ID' | 'Alien ID' | 'Passport' | 'Mandate Number' | 'Refugee ID';

export const IDENTIFIER_TYPES: IdentifierType[] = [
  'National ID',
  'Alien ID',
  'Passport',
  'Mandate Number',
  'Refugee ID',
];

export enum OtpStatus {
  Draft = 'DRAFT',
  Sent = 'SENT',
  Verified = 'VERIFIED',
}

export enum OtpOptions {
  Skip = 'SKIP',
  NoOverride = 'NO OVERRIDE',
  Override = 'OVERRIDE',
}

export interface ValidateCustomOtpResponse {
  message: string;
  isValid?: boolean;
}

export type ClientRegistrySearchRequest = {
  identificationNumber: string | number;
  identificationType: string;
  locationUuid: string;
};

export interface RequestCustomOtpResponse {
  message: string;
  sessionId: string;
  maskedPhone: string;
}

export interface ValidateHieCustomOtpDto {
  sessionId: string;
  otp: number | string;
  locationUuid: string;
}

export interface ValidateCustomOtpResponse {
  message: string;
  isValid?: boolean;
}

export type RequestCustomOtpDto = {
  identificationNumber: string | number;
  identificationType: string;
  locationUuid: string;
};

export interface RequestCustomOtpResponse {
  message: string;
  sessionId: string;
  maskedPhone: string;
}

export interface ValidateHieCustomOtpDto {
  sessionId: string;
  otp: number | string;
  locationUuid: string;
}

export enum HieIdentificationType {
  NationalID = 'National ID',
  SHANumber = 'SHA Number',
  HouseholdNumber = 'Household Number',
  RefugeeID = 'Refugee ID',
  AlienID = 'Alien ID',
  MandateNumber = 'Mandate Number',
  Cr = 'id',
  TemporaryDependantID = 'Temporary Dependant ID',
  BirthCertificate = 'Birth Certificate',
}

export interface HieIdentifications {
  identification_number: string;
  identification_type: HieIdentificationType;
}

export interface HieDependant {
  date_added: string;
  relationship: string;
  total: number;
  result: HieClient[];
}

export interface AlternateContact {
  contact_type: string;
  contact_id: string;
  contact_name: string;
  relationship: string;
  remarks: string;
}

export interface HieClient {
  resourceType: string;
  id: string;
  meta: {
    versionId: string;
    creationTime: string;
    lastUpdated: string;
    source: string;
  };
  originSystem: {
    system: string;
    record_id: string;
  };
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  place_of_birth: string;
  person_with_disability: number;
  citizenship: string;
  kra_pin: string;
  preferred_primary_care_network: string;
  employment_type: string;
  domestic_worker_type: string;
  civil_status: string;
  identification_type: HieIdentificationType;
  identification_number: string;
  other_identifications: HieIdentifications[];
  dependants: HieDependant[];
  is_alive: number;
  deceased_datetime: string;
  phone: string;
  biometrics_verified: number;
  biometrics_score: number;
  email: string;
  country: string;
  county: string;
  sub_county: string;
  ward: string;
  village_estate: string;
  building_house_no: string;
  latitude: string;
  longitude: string;
  province_state_country: string;
  zip_code: string;
  identification_residence: string;
  employer_name: string;
  employer_pin: string;
  disability_category: string;
  disability_subcategory: string;
  disability_cause: string;
  in_lawful_custody: string;
  admission_remand_number: string;
  document_uploads: any[];
  alternative_contacts: AlternateContact[];
  gross_income: number;
  gross_income_currency: string;
  postal_address: string;
  estimated_contribution: number;
  estimated_annual_contribution: number;
  city: string;
  id_serial: string;
  learning_institution_code: string;
  learning_institution_name: string;
  grade_level: string;
  admission_number: string;
  expected_year_of_graduation: string;
  unconfirmed_dependants: HieDependant[];
  is_agent: number;
  agent_id: string;
}

export type PatientSearchResponse = {
  results: Patient[];
  totalCount: number;
};

export type QueuePriority = {
  uuid: string;
  display: string;
};
export type QueueStatus = {
  uuid: string;
  display: string;
};
export type ServiceQueue = {
  uuid: string;
  display: string;
  name: string;
  description: string;
  service: {
    uuid: string;
    display: string;
  };
  allowedPriorities: QueuePriority[];
  allowedStatuses: QueueStatus[];
  location: Location;
};

export type ServiceQueueApiResponse = {
  results: ServiceQueue[];
};

export type QueueEntryDto = {
  visit: {
    uuid: string;
  };
  queueEntry: {
    status: {
      uuid: string;
    };
    priority: {
      uuid: string;
    };
    queue: {
      uuid: string;
    };
    patient: {
      uuid: string;
    };
    startedAt: string;
    sortWeight: number;
  };
};

export type CreateVisitDto = {
  visitType: string;
  location: string;
  startDatetime: null | string;
  stopDatetime: null | string;
  patient: string;
  attributes?: VisitAttribute[];
};

export type VisitAttribute = {
  attributeType: string;
  value: string;
};

export type EndVisitDto = {
  stopDatetime: string;
};

export interface GlobalError {
  code: string;
  message: string;
}

export interface AmrsErrorResponse {
  message: string;
  error: {
    error: {
      message: string;
      code: string;
      globalErrors?: GlobalError[];
      fieldErrors?: any;
    };
  };
}

export interface CreatePersonDto {
  gender?: string;
  birthdate?: string;
  dead?: boolean;
  deathDate?: string;
  names?: {
    givenName?: string;
    middleName?: string;
    familyName?: string;
  }[];
  addresses?: {
    country?: string;
    address1?: string;
    address2?: string;
    address4?: string;
    address7?: string;
    address10?: string;
    countyDistrict?: string;
    stateProvince?: string;
    cityVillage?: string;
    longitude?: string;
    latitude?: string;
  }[];
  attributes?: {
    value: string | number;
    attributeType: string;
  }[];
}

export type CreatePatientDto = {
  person: CreatePersonDto;
  identifiers?: any;
};

export type QueueEntryResult = {
  name: string;
  queue_entry_id: number;
  priority_comment: string;
  wait_time_in_min: number;
  queue_entry_uuid: string;
  service_uuid: string;
  location_id: number;
  location: string;
  service: number;
  queue_id: number;
  queue_room: string;
  priority: string;
  patient_id: number;
  visit_id: number;
  patient_uuid: string;
  family_name: string;
  given_name: string;
  middle_name: string;
  status: string;
  visit_uuid: string;
  queue_coming_from: string;
};

export enum PaymentDetail {
  Paying = 'Paying',
  NonPaying = 'Non-Paying',
}

export const CCC_UUID = 'a8a3899a-1350-11df-a1f1-0026b9348838';

export type EligibilityFilterDto = {
  requestIdType: string;
  requestIdNumber: string;
  locationUuid: string;
};

export type HieClientEligibility = {
  requestIdType: number;
  requestIdNumber: string;
  memberCrNumber: string;
  fullName: string;
  schemes: Scheme[];
  statusDesc: string;
};

export type Scheme = {
  schemeName: string;
  memberType: 'BENEFICIARY' | string;
  coverageType: 'SHIF' | string;
  policy: Policy;
  coverage: Coverage;
  principalContributor: PrincipalContributor;
};

export type Policy = {
  startDate: string;
  endDate: string;
  number: string;
};

export type Coverage = {
  startDate: string;
  endDate: string;
  message: string;
  reason: string;
  possibleSolution: string | null;
  status: string;
};

export type PrincipalContributor = {
  idNumber: string;
  name: string;
  crNumber: string;
  relationship: string;
  employmentType: string;
  employerDetails: EmployerDetails;
};

export type EmployerDetails = {
  name: string;
  jobGroup: string;
};

export enum RequestIdTypes {
  BirthCertificate = 2,
  CrId = 3,
  NationalId = 4,
  Refugee = 5,
  TemporaryId = 6,
  TempDependantId = 7,
  MandateNo = 8,
  Passport = 9,
  BirthCertificate2 = 10,
  HouseholdNumber = 11,
}
