import {
  type PatientContactResponse,
  type OTPWhitelistRequest,
  type BiometricsStatus,
  type Authorization,
  type HieAccessTokenResponse,
} from './hie.types';
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
    workStationId: workstationId || '54cf356c-c4f9-4fd2-a9df-9ca1723b98a6-B0A460977E12',
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

export async function sendClaimAttachment(
  consentToken: string,
  documentType: string,
  interventionCode: string,
  fileBlob: string[],
  locationUuid: string,
): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    consentToken: consentToken,
    documentType: documentType,
    interventionCode: interventionCode,
    fileBlob: fileBlob,
    locationUuid: locationUuid,
  };
  const url = `${hieBaseUrl}/claim-attachment`;
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

export async function sendDischargeOTP(consentToken: string, patientId: string, locationUuid: string): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    consentToken: consentToken,
    patientId: patientId,
    locationUuid: locationUuid,
  };
  const url = `${hieBaseUrl}/claims-otp/discharge`;
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

export async function getAuthorizations(locationUuid: string, crId?: string, token?: string): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claim-authorizations?beneficiaryCode=${crId}&consentToken=${token}&locationUuid=${locationUuid}`;

  const response = await openmrsFetch(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch OTP';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function cancelPendingAuthorizations(consentToken: string, locationUuid: string): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claim-authorizations/cancel?consentToken=${consentToken}&locationUuid=${locationUuid}`;

  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to cancel pending authorization';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function cancelAllPendingAuthorizations(locationUuid: string, crId: string): Promise<void> {
  const authorizations: Authorization[] = await getAuthorizations(locationUuid, crId, undefined);

  const pending = authorizations.filter((auth) => auth.status === 'PENDING');

  // for (const authorization of pending) {
  //   await cancelPendingAuthorizations(authorization.token);
  // }
  await Promise.all(pending.map((auth) => cancelPendingAuthorizations(auth.token, locationUuid)));
}
