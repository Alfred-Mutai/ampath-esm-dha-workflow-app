import { IdentifierTypesUuids } from '../../resources/identifier-types';
import { CivilStatusUids } from '../../shared/constants/civil-status';
import { PersonAttributeTypeUuids } from '../../shared/constants/person-attributes';
import {
  type AlternateContact,
  type CreatePersonDto,
  type HieClient,
  type HieIdentifications,
  HieIdentificationType,
} from '../types';

const clientDatailsFields = [
  'id',
  'other_identifications',
  'first_name',
  'middle_name',
  'last_name',
  'gender',
  'date_of_birth',
  'is_alive',
  'deceased_datetime',
  'phone',
  'email',
  'civil_status',
  'place_of_birth',
  'citizenship',
  'country',
  'county',
  'sub_county',
  'ward',
  'village_estate',
  'longitude',
  'latitude',
  'identification_type',
];

const nameFields = ['first_name', 'middle_name', 'last_name'];
const otherPersonFields = ['gender', 'date_of_birth', 'is_alive', 'deceased_datetime'];
const attributeFields = ['phone', 'email', 'civil_status', 'place_of_birth', 'citizenship'];
const addressFields = ['country', 'county', 'sub_county', 'ward', 'village_estate', 'longitude', 'latitude'];
const otherFields = ['gender', 'date_of_birth'];
const identifierFields = [
  HieIdentificationType.Cr,
  HieIdentificationType.SHANumber,
  HieIdentificationType.HouseholdNumber,
  HieIdentificationType.RefugeeID,
  HieIdentificationType.MandateNumber,
  HieIdentificationType.AlienID,
  HieIdentificationType.NationalID,
  HieIdentificationType.TemporaryDependantID,
];
const hieAmrsSyncFields = [
  ...identifierFields,
  ...nameFields,
  ...otherPersonFields,
  ...attributeFields,
  ...addressFields,
];

export function generateHieClientDetails(hieClient: HieClient) {
  let data = {};
  Object.keys(hieClient)
    .filter((key) => {
      return clientDatailsFields.includes(key);
    })
    .forEach((key) => {
      if (key === 'other_identifications') {
        const otherIds = generateOtherIdentifications(hieClient[key]);
        data = {
          ...data,
          ...otherIds,
        };
      } else if (key === 'identification_type') {
        data[hieClient['identification_type']] = hieClient.identification_number;
      } else {
        const value = hieClient[key];
        data[key] = value;
      }
    });
  return data;
}
function generateOtherIdentifications(hieIdentifications: HieIdentifications[]) {
  const other = {};
  hieIdentifications.forEach((id) => {
    other[id.identification_type] = id.identification_number;
  });
  return other;
}

export function generateAmrsPersonPayload(hieClient: HieClient): CreatePersonDto {
  const createPersonPayload: CreatePersonDto = {};
  const namesAttribute = {};
  const addresses = {};
  let attributes = [];
  hieAmrsSyncFields.forEach((d) => {
    if (d === 'first_name') {
      namesAttribute['givenName'] = hieClient.first_name;
    }
    if (d === 'middle_name') {
      namesAttribute['middleName'] = hieClient.middle_name;
    }
    if (d === 'last_name') {
      namesAttribute['familyName'] = hieClient.last_name;
    }
    if (d === 'gender') {
      createPersonPayload['gender'] = hieClient.gender === 'Male' ? 'M' : 'F';
    }
    if (d === 'date_of_birth') {
      createPersonPayload['birthdate'] = hieClient.date_of_birth;
      createPersonPayload['birthdateEstimated'] = false;
    }
    if (d === 'is_alive') {
      createPersonPayload['dead'] = hieClient.is_alive === 0 ? true : false;
    }
    if (d === 'deceased_datetime') {
      if (hieClient.deceased_datetime.length > 0) {
        createPersonPayload['deathDate'] = hieClient.deceased_datetime;
      }
    }
    if (d === 'country' && hieClient.country.length > 0) {
      addresses['country'] = hieClient.country;
      addresses['address1'] = hieClient.country;
    }
    if (d === 'place_of_birth' && hieClient.place_of_birth.length > 0) {
      addresses['address10'] = hieClient.place_of_birth;
    }
    if (d === 'county' && hieClient.county.length > 0) {
      addresses['countyDistrict'] = hieClient.county;
    }
    if (d === 'sub_county' && hieClient.sub_county.length > 0) {
      addresses['address2'] = hieClient.sub_county;
      addresses['stateProvince'] = hieClient.sub_county;
    }
    if (d === 'ward' && hieClient.ward.length > 0) {
      addresses['address7'] = hieClient.ward;
      addresses['address4'] = hieClient.ward;
    }
    if (d === 'village_estate' && hieClient.village_estate.length > 0) {
      addresses['cityVillage'] = hieClient.village_estate;
    }
    if (d === 'longitude' && hieClient.longitude.length > 0) {
      addresses['longitude'] = hieClient.longitude;
    }
    if (d === 'latitude' && hieClient.latitude.length > 0) {
      addresses['latitude'] = hieClient.latitude;
    }
    if (d === 'place_of_birth' && hieClient.place_of_birth.length > 0) {
      attributes.push({
        value: hieClient.place_of_birth,
        attributeType: PersonAttributeTypeUuids.PLACE_OF_BIRTH_UUID,
      });
    }
    if (d === 'phone' && hieClient.phone.length > 0) {
      attributes.push({
        value: hieClient.phone,
        attributeType: PersonAttributeTypeUuids.CONTACT_PHONE_NUMBER_UUID,
      });
    }
    if (d === 'email' && hieClient.email.length > 0) {
      attributes.push({
        value: hieClient.email,
        attributeType: PersonAttributeTypeUuids.CONTACT_EMAIL_ADDRESS_UUID,
      });
    }
    if (d === 'civil_status' && hieClient.civil_status.length > 0) {
      attributes.push({
        value: getAmrsConceptUuidFromField(hieClient.civil_status),
        attributeType: PersonAttributeTypeUuids.CIVIL_STATUS_UUID,
      });
    }
    if (d === 'id' && hieClient.id) {
      attributes.push({
        value: hieClient.id,
        attributeType: PersonAttributeTypeUuids.CLIENT_REGISTRY_ID_UUID,
      });
    }
    if (d === 'citizenship' && hieClient.citizenship) {
      attributes.push({
        value: hieClient.citizenship,
        attributeType: PersonAttributeTypeUuids.CITIZENSHIP_UUID,
      });
    }
  });
  // Add next of kin details
  const nextOfKinAndAlternativeAttributes = generateNextOfKinAndAlternateContactDetails(hieClient.alternative_contacts);
  attributes = [...attributes, ...nextOfKinAndAlternativeAttributes];
  if (Object.keys(namesAttribute).length > 0) {
    createPersonPayload['names'] = [namesAttribute];
  }
  if (Object.keys(addresses).length > 0) {
    createPersonPayload['addresses'] = [addresses];
  }
  if (attributes.length > 0) {
    createPersonPayload['attributes'] = attributes;
  }
  return createPersonPayload;
}
function generateNextOfKinAndAlternateContactDetails(alternativeContacts: AlternateContact[]) {
  const attributes = [];
  const alterNativeClientContact = alternativeContacts.find((a) => {
    return a.relationship === 'Alternative Phone Number';
  });
  const nextOfKinContact = alternativeContacts.find((a) => {
    return a.remarks === 'Next Of Kin';
  });
  if (alterNativeClientContact) {
    if (alterNativeClientContact.contact_type === 'Phone') {
      attributes.push({
        value: alterNativeClientContact.contact_id,
        attributeType: PersonAttributeTypeUuids.ALTERNATIVE_CONTACT_PHONE_NUMBER_UUID,
      });
    }
  }
  if (nextOfKinContact) {
    if (nextOfKinContact.contact_type === 'Phone') {
      attributes.push({
        value: nextOfKinContact.contact_id,
        attributeType: PersonAttributeTypeUuids.NEXT_OF_KIN_CONTACT_PHONE_NUMBER_UUID,
      });
    }
    attributes.push({
      value: nextOfKinContact.relationship,
      attributeType: PersonAttributeTypeUuids.NEXT_OF_KIN_RELATIONSHIP_UUID,
    });
    attributes.push({
      value: nextOfKinContact.contact_name,
      attributeType: PersonAttributeTypeUuids.NEXT_OF_KIN_NAME_UUID,
    });
  }
  return attributes;
}
function getAmrsConceptUuidFromField(fieldName: string): string {
  let conceptUuid = '';
  switch (fieldName) {
    case 'Divorced':
      conceptUuid = CivilStatusUids.DIVORCED_UUID;
      break;
    case 'Married':
      conceptUuid = CivilStatusUids.MARRIED_UUID;
      break;
    case 'Single':
      conceptUuid = CivilStatusUids.SINGLE_UUID;
      break;
    default:
      conceptUuid = CivilStatusUids.NOT_APPLICABLE_UUID;
  }
  return conceptUuid;
}
export function generateAmrsCreatePatientIdentifiersPayload(hieClient: HieClient, identifierLocation: string) {
  const identifiers = [];
  // add CR number
  identifiers.push({
    identifierType: getAmrsIdentifierTypeUuid(HieIdentificationType.Cr),
    identifier: hieClient.id,
    location: identifierLocation,
  });

  // add main identifier
  identifiers.push({
    identifierType: getAmrsIdentifierTypeUuid(hieClient.identification_type),
    identifier: hieClient.identification_number,
    location: identifierLocation,
  });

  // add other idenfications
  hieClient.other_identifications.forEach((id) => {
    identifiers.push({
      identifierType: getAmrsIdentifierTypeUuid(id.identification_type),
      identifier: id.identification_number,
      location: identifierLocation,
    });
  });

  return identifiers;
}

export function getAmrsIdentifierTypeUuid(hieIdentifierName: string) {
  let idTypeUuid;
  switch (hieIdentifierName) {
    case HieIdentificationType.NationalID:
      idTypeUuid = IdentifierTypesUuids.NATIONAL_ID_UUID;
      break;
    case HieIdentificationType.HouseholdNumber:
      idTypeUuid = IdentifierTypesUuids.HOUSE_HOLD_NUMBER_UUID;
      break;
    case HieIdentificationType.AlienID:
      idTypeUuid = IdentifierTypesUuids.ALIEN_ID_UUID;
      break;
    case HieIdentificationType.SHANumber:
      idTypeUuid = IdentifierTypesUuids.SHA_UUID;
      break;
    case HieIdentificationType.MandateNumber:
      idTypeUuid = IdentifierTypesUuids.MANDATE_NUMBER_UUID;
      break;
    case HieIdentificationType.RefugeeID:
      idTypeUuid = IdentifierTypesUuids.REFUGEE_ID_UUID;
      break;
    case HieIdentificationType.Cr:
      idTypeUuid = IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID;
      break;
    case HieIdentificationType.BirthCertificate:
      idTypeUuid = IdentifierTypesUuids.BIRTH_CERTIFICATE_NUMBER_UUID;
      break;
    case HieIdentificationType.TemporaryDependantID:
      idTypeUuid = IdentifierTypesUuids.TEMPORARY_DEPENDANT_ID_UUID;
      break;
    case HieIdentificationType.BirthNotification:
      idTypeUuid = IdentifierTypesUuids.BIRTH_NOTIFICATION_UUID;
      break;
  }
  return idTypeUuid;
}
