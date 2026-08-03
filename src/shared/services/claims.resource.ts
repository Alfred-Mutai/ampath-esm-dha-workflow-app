import { type Visit } from '@openmrs/esm-framework';
import { ClaimIntervention, type Intervention, type ServiceType, type VisitType } from '../../claims';

export const getConsentToken = (activeVisit: Visit | null | undefined) => {
  const consentToken =
    activeVisit?.attributes?.find((atr) => atr?.attributeType?.uuid === '4962a633-c4f8-474c-857c-5c68c72fbbe3')?.value ??
    '';
  return consentToken;
};

export const getPaymentMode = (activeVisit: Visit) => {
  const consentToken =
    activeVisit?.attributes?.find((atr) => atr?.attributeType?.uuid === '8553afa0-bdb9-4d3c-8a98-05fa9350aa85')?.value ??
    '';
  return consentToken;
};

export const getServiceType = (
  selectedIntervention: Intervention | ClaimIntervention,
  visitType?: VisitType,
): ServiceType => {
  const rawPm =
    (selectedIntervention as any)?.paymentMechanism ??
    (selectedIntervention as any)?.intervention_payment_mechanism ??
    '';
  const rawAp = (selectedIntervention as any)?.accessPoint ?? '';

  const paymentMechanism = typeof rawPm === 'string' ? rawPm.toUpperCase() : '';
  const accessPoint = typeof rawAp === 'string' ? rawAp.toUpperCase() : '';

  if (paymentMechanism.trim().toUpperCase() === 'CAPITATION') {
    return 'CAPITATION';
  }
  if (paymentMechanism.trim().toUpperCase() === 'PER_DIEM') {
    return 'PER_DIEM';
  }
  if (accessPoint.trim().toUpperCase() === 'IP') {
    return 'INPATIENT';
  }
  if (accessPoint.trim().toUpperCase() === 'OP') {
    return 'OUTPATIENT';
  }
  if (accessPoint.trim().toUpperCase() === 'OP AND IP') {
    return visitType;
  }
  return visitType;
};
