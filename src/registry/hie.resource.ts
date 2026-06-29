import { type PatientContactResponse, type HieAccessTokenResponse, type OTPWhitelistRequest } from './hie.types';
import { type HieClient } from './types';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import { openmrsFetch } from '@openmrs/esm-framework';

export async function fetchAccessToken(): Promise<HieAccessTokenResponse> {
  const url = `https://ilm-dev.dha.go.ke/uat-middleware/api/v1/tenants/token`;
  const payload = new URLSearchParams({
    client_id: '',
    client_secret: '',
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch access token';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function getOtpWhitelistingStatus(
  identifier: string,
  identifierType: string,
  locationUuid: string,
): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}eligibility/claims-eligibility?identificationNumber=${identifier}&identificationType=${identifierType}&locationUuid=${locationUuid}`;
  const response = await openmrsFetch(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch OTP whitelisting status';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function getPatientContacts(crId: string, locationUuid: string): Promise<PatientContactResponse> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    crId: crId,
    locationUuid: locationUuid,
  };
  const url = `${hieBaseUrl}/client/contacts`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch patient contacts';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function createOTPWhitelisting(payload: OTPWhitelistRequest): Promise<PatientContactResponse> {
  const hieBaseUrl = await getHieBaseUrl();

  const formData = new FormData();
  formData.append('reasonType', payload.reasonType);
  formData.append('reason', payload.reason);
  formData.append('beneficiaryCrId', payload.crId);
  formData.append(
    'attachments',
    JSON.stringify([
      {
        document_title: payload.attachments_file_blob.name,
        document_type: 'SUPPORT_DOCUMENT',
        file_field_name: 'attachments_file_blob',
      },
    ]),
  );
  formData.append('attachmentsFileBlob', payload.attachments_file_blob);
  formData.append('biometricAttempts', '10');
  formData.append('locationUuid', payload.locationUuid);
  const url = `${hieBaseUrl}/client/otp-whitelist`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to send OTP whitelisting request';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function sendClaimsOTP(patientId: string, locationUuid: string, intervention?: string): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    intervention_codes: ['SHA-09-047'],
    patient_id: patientId,
    locationUuid: locationUuid,
  };
  const url = `${hieBaseUrl}/claims-otp`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch OTP';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function getBiometrictsRequestUrl(patient: HieClient): Promise<any> {
  const data = await fetchAccessToken();
  const url = 'https://ilm-dev.dha.go.ke/uat-middleware/api/v1/claims/authorize';
  const accessToken = data.access_token;
  const payload = {
    // National ID of the biometrics agent registered on the hardware server
    agent_id: patient.identification_number,

    // OS of the workstation performing the authorization
    authorizing_device_os: 'windows',

    // Facility name
    ekyc_provider_id: 'Nairobi West',

    // Biometric/auth factors
    // Enum: "SHA" (eKYC via SHA portal) | "fingerprint" (Under-18 patient flow)
    factors: ['SHA'],

    // SHA intervention code for the procedure you are seeking consent for
    interventions: ['SHA-18-004'],

    // Set true only when authorizing discharge for an inpatient claim; false for all other flows
    is_biometrics_discharge_authorization: false,

    // Set true for emergency claims
    is_emergency: false,

    // Set true when the request originates from an integrated HMS (vs. direct portal submission)
    is_integration: true,

    // CR number of the patient/beneficiary, obtained from Patient Search or Eligibility Check
    patient_id: patient.id,

    // Facility code as registered in the Facility Registry (FR)
    provider: 'FID-27-114387-5',

    // Type of visit — Enum: "OUTPATIENT" | "INPATIENT" | "EMERGENCY" | "CAPITATION"
    service_type: 'OUTPATIENT',

    // Unique workstation identifier from the hardware/biometrics server
    work_station_id: '790bf760-08e6-4fbe-b892-7b877dd52f2b-F406692C85F3',
  };
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Facility-Id': 'FID-27-114387-5',
      'X-Facility-Id-Type': 'fr-code',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}
