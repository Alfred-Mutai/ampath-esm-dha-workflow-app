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
  const url = `${hieBaseUrl}/eligibility/claims-eligibility?identificationNumber=${identifier}&identificationType=${identifierType}&locationUuid=${locationUuid}`;
  const response = await openmrsFetch(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch OTP whitelisting status';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export interface OtpWhitelistRecord {
  guid?: string;
  created?: string;
  beneficiaryCrId?: string;
  beneficiaryName?: string;
  facilityName?: string;
  facilityFrCode?: string;
  reasonType?: string;
  reason?: string;
  reviewedByUser?: string;
  status?: string;
  biometricsAttempt?: number;
}

/** List a beneficiary's OTP whitelist requests (pending/approved/rejected). */
export async function getOtpWhitelistRequests(
  beneficiaryCrId: string,
  locationUuid: string,
): Promise<{ results: OtpWhitelistRecord[] }> {
  const hieBaseUrl = await getHieBaseUrl();
  const params = new URLSearchParams({ beneficiaryCrId, locationUuid });
  const url = `${hieBaseUrl}/client/otp-whitelists?${params.toString()}`;
  const response = await openmrsFetch(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch OTP whitelist requests';
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

/** Pre-visit OTP authorize (elective). Returns HIE authorization with `token` / `guid`. */
export async function authorizeClaimsWithOtp(params: {
  patientId: string;
  otp: string;
  interventions: string[];
  serviceType: string;
  locationUuid: string;
  beneficiaryContactId?: string;
}): Promise<{ token?: string; guid?: string; status?: string; [key: string]: unknown }> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claims-authorize`;
  const body: Record<string, unknown> = {
    patient_id: params.patientId,
    otp: params.otp,
    interventions: params.interventions,
    service_type: params.serviceType,
    locationUuid: params.locationUuid,
  };
  if (params.beneficiaryContactId) {
    body.beneficiary_contact_id = params.beneficiaryContactId;
  }
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const errorText = data?.message || 'Failed to authorize';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }
  return data ?? {};
}

export async function getBiometrictsRequestUrl(
  patient: HieClient,
  locationUuid: string,
  interventionCode: string,
  serviceType?: string,
  workstationId?: string,
  { isDischarge }: { isDischarge?: boolean } = { isDischarge: false }
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
    isBiometricsDischargeAuthorization: isDischarge,
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

// The fingerprint agent (SecuGen/SladeID) runs ON the clinic workstation and
// exposes a local HTTP endpoint. Because this fetch runs in the browser,
// `localhost` resolves to the machine the user is on — so a successful response
// means the agent is installed and running on THAT workstation. A short timeout
// keeps a filtered/blocked port from hanging the check.
const BIOMETRIC_AGENT_URL = 'http://localhost:18065/status/';

export async function getWorkstationId(): Promise<BiometricsStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(BIOMETRIC_AGENT_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error('Unable to connect to biometric service');
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Probe whether the biometric workstation agent is set up on this machine.
 * Returns true only if the local agent (localhost:18065) responds in time.
 * Never throws — safe to call to decide whether to offer biometric capture.
 */
export async function isBiometricWorkstationAvailable(): Promise<boolean> {
  try {
    const workstation = await getWorkstationId();
    return Boolean(workstation?.workstationID);
  } catch {
    return false;
  }
}

export async function sendClaimAttachment(
  consentToken: string,
  documentType: string,
  interventionCode: string,
  fileBlob: File,
  locationUuid: string,
): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const formData = new FormData();

  formData.append('consentToken', consentToken);
  formData.append('documentType', documentType);
  formData.append('interventionCode', interventionCode);
  formData.append('locationUuid', locationUuid);

  formData.append('fileBlob', fileBlob);

  const url = `${hieBaseUrl}/claim-attachment`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
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

  const params = new URLSearchParams({
    locationUuid,
  });

  if (crId) {
    params.append('beneficiaryCode', crId);
  }

  if (token) {
    params.append('consentToken', token);
  }

  const url = `${hieBaseUrl}/claim-authorizations?${params.toString()}`;

  const response = await openmrsFetch(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch authorizations';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function cancelPendingAuthorizations(consentToken: string, locationUuid: string): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    locationUuid: locationUuid,
    consentToken: consentToken,
  };
  const url = `${hieBaseUrl}/claim-authorizations/cancel`;

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
