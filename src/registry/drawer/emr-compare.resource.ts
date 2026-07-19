import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { PersonAttributeTypeUuids } from '../../shared/constants/person-attributes';

// Normalised view of the EMR person we compare against the Client Registry,
// including the sub-resource uuids we need to update in place (so we update
// the existing name/address/attributes rather than creating duplicates).
export interface EmrPersonDetails {
  personUuid: string;
  nameUuid: string;
  givenName: string;
  middleName: string;
  familyName: string;
  gender: string; // 'M' | 'F'
  birthdate: string; // ISO
  addressUuid: string;
  county: string;
  subCounty: string;
  ward: string;
  village: string;
  phone: { uuid: string; value: string };
  email: { uuid: string; value: string };
}

const PERSON_REP =
  'custom:(uuid,person:(uuid,gender,birthdate,' +
  'preferredName:(uuid,givenName,middleName,familyName),' +
  'preferredAddress:(uuid,countyDistrict,stateProvince,address2,address4,address7,cityVillage),' +
  'attributes:(uuid,value,voided,attributeType:(uuid))))';

function attrValue(attributes: any[], typeUuid: string): { uuid: string; value: string } {
  const match = (attributes ?? []).find((a) => !a.voided && a.attributeType?.uuid === typeUuid);
  // Person attribute `value` can be a plain string or a resolved object with a display.
  const raw = match?.value;
  const value = raw == null ? '' : typeof raw === 'object' ? (raw.display ?? '') : String(raw);
  return { uuid: match?.uuid ?? '', value };
}

/** Fetch a full-enough representation of the EMR patient's person to compare and update. */
export async function fetchEmrPersonDetails(patientUuid: string): Promise<EmrPersonDetails> {
  const { data } = await openmrsFetch<any>(`${restBaseUrl}/patient/${patientUuid}?v=${PERSON_REP}`);
  const person = data?.person ?? {};
  const name = person.preferredName ?? {};
  const addr = person.preferredAddress ?? {};
  const attributes = person.attributes ?? [];
  return {
    personUuid: person.uuid,
    nameUuid: name.uuid ?? '',
    givenName: name.givenName ?? '',
    middleName: name.middleName ?? '',
    familyName: name.familyName ?? '',
    gender: person.gender ?? '',
    birthdate: person.birthdate ?? '',
    addressUuid: addr.uuid ?? '',
    county: addr.countyDistrict ?? '',
    subCounty: addr.stateProvince ?? addr.address2 ?? '',
    ward: addr.address4 ?? addr.address7 ?? '',
    village: addr.cityVillage ?? '',
    phone: attrValue(attributes, PersonAttributeTypeUuids.CONTACT_PHONE_NUMBER_UUID),
    email: attrValue(attributes, PersonAttributeTypeUuids.CONTACT_EMAIL_ADDRESS_UUID),
  };
}

async function post(url: string, body: unknown) {
  const res = await openmrsFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

// The set of selectable fields shared with the comparison component.
export type EmrFieldKey =
  | 'givenName'
  | 'middleName'
  | 'familyName'
  | 'gender'
  | 'birthdate'
  | 'phone'
  | 'email'
  | 'county'
  | 'subCounty'
  | 'ward'
  | 'village';

// CR values already mapped to the EMR shape (gender M/F, etc.).
export interface EmrUpdateValues {
  givenName: string;
  middleName: string;
  familyName: string;
  gender: string; // 'M' | 'F'
  birthdate: string;
  phone: string;
  email: string;
  county: string;
  subCounty: string;
  ward: string;
  village: string;
}

const NAME_KEYS: EmrFieldKey[] = ['givenName', 'middleName', 'familyName'];
const ADDRESS_KEYS: EmrFieldKey[] = ['county', 'subCounty', 'ward', 'village'];

/**
 * Write only the selected fields from the Client Registry into the EMR person,
 * updating the existing name/address/attributes in place.
 */
export async function updateEmrPersonFields(
  emr: EmrPersonDetails,
  selected: EmrFieldKey[],
  values: EmrUpdateValues,
): Promise<void> {
  const has = (k: EmrFieldKey) => selected.includes(k);
  const personUuid = emr.personUuid;

  // 1) Name — update the preferred name, merging selected CR parts over the EMR ones.
  if (NAME_KEYS.some(has)) {
    const namePayload = {
      givenName: has('givenName') ? values.givenName : emr.givenName,
      middleName: has('middleName') ? values.middleName : emr.middleName,
      familyName: has('familyName') ? values.familyName : emr.familyName,
    };
    const url = emr.nameUuid
      ? `${restBaseUrl}/person/${personUuid}/name/${emr.nameUuid}`
      : `${restBaseUrl}/person/${personUuid}/name`;
    await post(url, namePayload);
  }

  // 2) Core person fields (gender, birthdate).
  const personPatch: Record<string, unknown> = {};
  if (has('gender')) {
    personPatch.gender = values.gender;
  }
  if (has('birthdate')) {
    personPatch.birthdate = values.birthdate;
    personPatch.birthdateEstimated = false;
  }
  if (Object.keys(personPatch).length > 0) {
    await post(`${restBaseUrl}/person/${personUuid}`, personPatch);
  }

  // 3) Address — update the preferred address, merging selected CR parts.
  if (ADDRESS_KEYS.some(has)) {
    const county = has('county') ? values.county : emr.county;
    const subCounty = has('subCounty') ? values.subCounty : emr.subCounty;
    const ward = has('ward') ? values.ward : emr.ward;
    const village = has('village') ? values.village : emr.village;
    const addressPayload: Record<string, unknown> = {
      countyDistrict: county,
      address1: county,
      stateProvince: subCounty,
      address2: subCounty,
      address4: ward,
      address7: ward,
      cityVillage: village,
    };
    const url = emr.addressUuid
      ? `${restBaseUrl}/person/${personUuid}/address/${emr.addressUuid}`
      : `${restBaseUrl}/person/${personUuid}/address`;
    await post(url, addressPayload);
  }

  // 4) Contact attributes (phone, email) — update in place or create.
  const updateAttr = async (
    existing: { uuid: string; value: string },
    typeUuid: string,
    value: string,
  ) => {
    if (existing.uuid) {
      await post(`${restBaseUrl}/person/${personUuid}/attribute/${existing.uuid}`, { value });
    } else {
      await post(`${restBaseUrl}/person/${personUuid}/attribute`, { attributeType: typeUuid, value });
    }
  };
  if (has('phone')) {
    await updateAttr(emr.phone, PersonAttributeTypeUuids.CONTACT_PHONE_NUMBER_UUID, values.phone);
  }
  if (has('email')) {
    await updateAttr(emr.email, PersonAttributeTypeUuids.CONTACT_EMAIL_ADDRESS_UUID, values.email);
  }
}
