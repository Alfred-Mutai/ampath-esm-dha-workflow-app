export interface UploadedFile {
  id: string;
  file: File;
  uploaded?: boolean;
}

export interface GeneratedDocument {
  id: string;
  name: string;
  generated: boolean;
  uploaded?: boolean;
  file?: File;
  url?: string;
}

export type DocumentType = 'DISCHARGE SUMMARY' | 'INVOICE';

export interface DischargeSummary {
  patientName: string;
  age: string;
  ipNumber: string;
  parity: string;
  admissionDate: string;
  deliveryDate: string;
  modeOfDelivery: string;
  babySex: string;
  birthWeight: string;
  fate: string;
  hygieneAdvice: string;
  nutrition: string;
  breastFeeding: string;
  immunization: string;
  familyPlanning: string;
  remarks: string;
  dischargeDate: string;
  clinician: string;
}

export type Attachment = {
  id: string;
  documentType: string;
  title: string;
  files: UploadedFile[];
};
