/**
 * Claim-creation workspace — data layer (DEMO STUBS).
 *
 * Mirrors the DHA/HIE eClaims pipeline so the workspace can be clicked through:
 *   eligibility → sub-benefits → interventions → consent → visit/claim →
 *   preauth → claim lines → preview → submit.
 * Replace each stub with the real endpoint noted in the comments.
 */

export type Fund = 'SHIF' | 'UHC' | 'ECCIF';
export type AccessPoint = 'OP' | 'IP';
export type PaymentMechanism = 'FEE_FOR_SERVICE' | 'PER_DIEM' | 'CAPITATION';

export interface EligibilityScheme {
  schemeName: string;
  active: boolean;
}

export interface EligibilityResult {
  fullName: string;
  crNumber: string;
  schemes: EligibilityScheme[];
}

export interface Intervention {
  code: string;
  name: string;
  subBenefit: string;
  fund: Fund;
  accessPoint: AccessPoint;
  paymentMechanism: PaymentMechanism;
  needsPreauth: boolean;
  needsManualPreauthApproval: boolean; // true = elective
  tariff: number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** GET /api/v1/patients/eligibility */
export async function checkEligibility(crNumber: string): Promise<EligibilityResult> {
  await wait(500);
  return {
    fullName: 'Christian Mkuru Gray',
    crNumber: crNumber || 'CR4098636401452-9',
    schemes: [
      { schemeName: 'SHIF', active: true },
      { schemeName: 'UHC (PHC)', active: true },
    ],
  };
}

/** GET /api/v1/patients/sub-benefits + /benefits/interventions (flattened for the demo). */
export async function getEligibleInterventions(): Promise<Intervention[]> {
  await wait(400);
  return [
    {
      code: 'SHA-02-011',
      name: 'General consultation',
      subBenefit: 'Outpatient care',
      fund: 'SHIF',
      accessPoint: 'OP',
      paymentMechanism: 'FEE_FOR_SERVICE',
      needsPreauth: false,
      needsManualPreauthApproval: false,
      tariff: 1500,
    },
    {
      code: 'SHA-05-104',
      name: 'Chest X-ray',
      subBenefit: 'Diagnostic imaging',
      fund: 'SHIF',
      accessPoint: 'OP',
      paymentMechanism: 'FEE_FOR_SERVICE',
      needsPreauth: true,
      needsManualPreauthApproval: false, // normal preauth
      tariff: 4000,
    },
    {
      code: 'SHA-07-330',
      name: 'Cataract surgery',
      subBenefit: 'Surgical services',
      fund: 'SHIF',
      accessPoint: 'OP',
      paymentMechanism: 'FEE_FOR_SERVICE',
      needsPreauth: true,
      needsManualPreauthApproval: true, // elective preauth
      tariff: 45000,
    },
    {
      code: 'SHA-01-002',
      name: 'General ward admission',
      subBenefit: 'Inpatient care',
      fund: 'SHIF',
      accessPoint: 'IP',
      paymentMechanism: 'PER_DIEM',
      needsPreauth: false,
      needsManualPreauthApproval: false,
      tariff: 3000,
    },
    {
      code: 'UHC-OP-001',
      name: 'Primary care visit',
      subBenefit: 'Primary healthcare',
      fund: 'UHC',
      accessPoint: 'OP',
      paymentMechanism: 'CAPITATION',
      needsPreauth: false,
      needsManualPreauthApproval: false,
      tariff: 800,
    },
  ];
}

export interface EncounterDiagnosis {
  uuid: string;
  display: string;
  icd11Code: string;
  certainty: 'CONFIRMED' | 'PRESUMED';
}

/**
 * Diagnoses recorded on the patient's OpenMRS encounter, coded to ICD-11.
 * In production these come from the encounter/visit diagnosis response
 * (e.g. ETL `/patient/diagnosis` → AmrsVisitDiagnosis.icd11_code, or the
 * encounter's `diagnoses[]`). The claim's ICD-11 array is picked from here.
 */
export async function getEncounterDiagnoses(): Promise<EncounterDiagnosis[]> {
  await wait(350);
  return [
    { uuid: 'dx-1', display: 'Essential (primary) hypertension', icd11Code: 'BA00', certainty: 'CONFIRMED' },
    { uuid: 'dx-2', display: 'Type 2 diabetes mellitus', icd11Code: '5A11', certainty: 'CONFIRMED' },
    { uuid: 'dx-3', display: 'Acute upper respiratory infection', icd11Code: 'CA07', certainty: 'PRESUMED' },
  ];
}

export interface ScenarioInfo {
  key: string;
  title: string;
  preauth: 'none' | 'normal' | 'elective' | 'doctor';
  dispatch: 'submit' | 'discharge';
  lineMode: 'auto' | 'manual';
}

/** Resolve the DHA scenario from an intervention's flags (the flag-driven router). */
export function resolveScenario(iv: Intervention): ScenarioInfo {
  if (iv.fund === 'UHC' && iv.paymentMechanism === 'CAPITATION') {
    return { key: '6', title: 'UHC OP Capitation', preauth: 'none', dispatch: 'submit', lineMode: 'manual' };
  }
  const dispatch: ScenarioInfo['dispatch'] = iv.accessPoint === 'IP' ? 'discharge' : 'submit';
  if (iv.paymentMechanism === 'PER_DIEM') {
    return { key: '1', title: 'SHIF IP Per Diem', preauth: 'none', dispatch, lineMode: 'auto' };
  }
  if (!iv.needsPreauth) {
    return {
      key: iv.accessPoint === 'IP' ? '1' : '6',
      title: `SHIF ${iv.accessPoint} · no preauth`,
      preauth: 'none',
      dispatch,
      lineMode: 'manual',
    };
  }
  if (iv.needsManualPreauthApproval) {
    return {
      key: iv.accessPoint === 'IP' ? '3' : '4',
      title: `SHIF ${iv.accessPoint} FFS Elective Preauth`,
      preauth: 'elective',
      dispatch,
      lineMode: 'manual',
    };
  }
  return {
    key: iv.accessPoint === 'IP' ? '2' : '5',
    title: `SHIF ${iv.accessPoint} FFS Normal Preauth`,
    preauth: 'normal',
    dispatch,
    lineMode: 'manual',
  };
}

export interface CompatibilityResult {
  ok: boolean;
  reason?: string;
  requiresSwitch?: boolean; // per-diem: replace the existing active per-diem instead of adding
}

/**
 * SHA combination rules (subset, applied instantly as interventions are added):
 *  - a claim carries a single fund/scheme — no mixing SHIF with UHC/ECCIF;
 *  - no duplicate interventions;
 *  - only ONE active per-diem intervention at a time — a second is a SWITCH
 *    (e.g. General ward → ICU), not an add.
 * Replace with the live combination-rules check when available.
 */
export function checkCompatibility(selected: Intervention[], candidate: Intervention): CompatibilityResult {
  if (selected.some((i) => i.code === candidate.code)) {
    return { ok: false, reason: 'This intervention is already on the claim.' };
  }
  if (selected.length > 0 && selected[0].fund !== candidate.fund) {
    return {
      ok: false,
      reason: `A claim can't mix funds — ${candidate.fund} can't be added to a ${selected[0].fund} claim.`,
    };
  }
  if (candidate.paymentMechanism === 'PER_DIEM' && selected.some((i) => i.paymentMechanism === 'PER_DIEM')) {
    return {
      ok: false,
      requiresSwitch: true,
      reason: 'Only one active per-diem is allowed at a time. Switch the current per-diem instead of adding a second.',
    };
  }
  return { ok: true };
}

/** Human label for a payment mechanism. */
export function mechanismLabel(m: PaymentMechanism): string {
  switch (m) {
    case 'PER_DIEM':
      return 'Per diem';
    case 'FEE_FOR_SERVICE':
      return 'Fee for service';
    case 'CAPITATION':
      return 'Capitation';
  }
}

/** POST /api/v1/claims/authorize (biometric) or /api/v1/claims/otp — returns a consent token. */
export async function captureConsent(method: 'biometric' | 'otp'): Promise<{ consentToken: string; authGuid?: string }> {
  await wait(600);
  return {
    consentToken: `ct_${method}_${Math.floor(Math.random() * 1e6)}`,
    authGuid: method === 'biometric' ? `guid_${Math.floor(Math.random() * 1e6)}` : undefined,
  };
}

/** POST /api/v1/preauths then poll GET /api/v1/preauths until FINALISED. */
export async function raisePreauth(consentToken: string, interventionCode: string): Promise<{ status: 'FINALISED' }> {
  await wait(900);
  return { status: 'FINALISED' };
}

/** Where the copay (shortfall above the SHA tariff) is collected. */
export const COPAY_PAYERS = ['Cash', 'AAR', 'Jubilee', 'Britam', 'Madison', 'CIC'];

export interface ClaimPreview {
  previewId: string;
  generatedAt: string;
  documentName: string;
}

/**
 * POST /api/v1/claims/preview — generate the provider claim preview.
 * This must be run before submit. For fee-for-service / per-diem the preview
 * document is auto-attached as the supporting attachment; capitation needs none.
 */
export async function previewClaim(consentToken: string): Promise<ClaimPreview> {
  await wait(700);
  return {
    previewId: `PRV-${Math.floor(Math.random() * 1e6)}`,
    generatedAt: new Date().toISOString(),
    documentName: 'provider-claim-preview.pdf',
  };
}

export interface CopayReceipt {
  receiptNo: string;
  documentName: string;
  amount: number;
}

/**
 * Generate the cash copay receipt from billing so it can be attached to the
 * claim as supporting evidence. In production this comes from the billing
 * receipt generator once the copay payment is recorded at the cashier.
 */
export async function generateCopayReceipt(amount: number): Promise<CopayReceipt> {
  await wait(400);
  return {
    receiptNo: `RCPT-${Math.floor(100000 + Math.random() * 900000)}`,
    documentName: 'cash-copay-receipt.pdf',
    amount,
  };
}
