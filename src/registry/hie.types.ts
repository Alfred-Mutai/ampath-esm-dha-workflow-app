export type HieAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type PatientContactResult = {
  id: number;
  contactValue: string;
  contactType: string;
  isConfirmed: boolean;
  active: boolean;
};

export type PatientContactResponse = {
  count: number;
  results: PatientContactResult[];
};

export interface OTPWhitelistRequest {
  reasonType: string;
  reason: string;
  crId: string;
  attachments_file_blob: File;
  locationUuid: string;
}

export interface OtpFormData {
  file: File | null;
  reasonType: string;
  reason: string;
  otp: string;
  whitelisted: boolean;
}
