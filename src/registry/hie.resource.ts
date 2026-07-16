import { type PatientContactResponse, type OTPWhitelistRequest, type BiometricsStatus } from './hie.types';
import { type HieClient } from './types';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import { openmrsFetch } from '@openmrs/esm-framework';

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

export async function sendClaimsOTP(patientId: string, locationUuid: string, interventionCode: string): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    intervention_codes: [interventionCode],
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

export async function getBiometrictsRequestUrl(
  patient: HieClient,
  locationUuid: string,
  interventionCode: string,
  serviceType?: string,
  workstationId?: string,
): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  // eslint-disable-next-line no-console
  console.log('WORKSTATION ID:', workstationId);

  const payload = {
    interventions: [interventionCode],
    patientId: patient.id,
    locationUuid: locationUuid,
    serviceType: serviceType,
    agentId: patient.identification_number,
    authorizingDeviceOs: 'windows',
    factors: ['SHA'],
    isBiometricsDischargeAuthorization: false,
    isEmergency: false,
    isIntegration: true,
    workStationId: workstationId,
  };
  const url = `${hieBaseUrl}/client/biometrics-authorize`;
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

export async function getWorkstationId(): Promise<BiometricsStatus> {
  const response = await fetch('http://localhost:18065/status/');

  if (!response.ok) {
    throw new Error('Unable to connect to biometric service');
  }

  return response.json();
}
