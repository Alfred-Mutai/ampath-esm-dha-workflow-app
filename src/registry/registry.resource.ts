import { getHieBaseUrl } from '../shared/utils/get-base-url';
import {
  type ClientRegistrySearchRequest,
  type RequestCustomOtpDto,
  type RequestCustomOtpResponse,
  type ValidateCustomOtpResponse,
  type ValidateHieCustomOtpDto,
} from './types';

export type ClientRegistrySearchResponse = any[];

export async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export async function requestCustomOtp(payload: RequestCustomOtpDto): Promise<RequestCustomOtpResponse> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/client/send-custom-otp`;
  const formattedPayload = {
    identificationNumber: payload.identificationNumber,
    identificationType: payload.identificationType,
    locationUuid: payload.locationUuid,
  };
  return postJson<RequestCustomOtpResponse>(url, formattedPayload);
}

export async function validateCustomOtp(payload: ValidateHieCustomOtpDto): Promise<ValidateCustomOtpResponse> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/client/validate-custom-otp`;
  const formattedPayload = {
    sessionId: payload.sessionId,
    otp: payload.otp,
    locationUuid: payload.locationUuid,
  };
  return postJson<ValidateCustomOtpResponse>(url, formattedPayload);
}

export async function fetchClientRegistryData(
  payload: ClientRegistrySearchRequest,
): Promise<ClientRegistrySearchResponse> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/client/search`;
  const formattedPayload = {
    identificationNumber: payload.identificationNumber,
    identificationType: payload.identificationType,
    locationUuid: payload.locationUuid,
  };
  return postJson<ClientRegistrySearchResponse>(url, formattedPayload);
}
