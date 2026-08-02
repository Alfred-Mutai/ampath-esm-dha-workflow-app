import { openmrsFetch, restBaseUrl, useConfig, useSession, Visit } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';
import { type ConfigObject } from '../../../../config-schema';
import { fetchFacilityClaimVisits } from '../../../billing-claims.resource';

// Visit attribute that records the payment mode chosen at registration.
const PAYMENT_MODE_ATTRIBUTE_UUID = '8553afa0-bdb9-4d3c-8a98-05fa9350aa85';

// The payment mode value can come back as a plain uuid or a hydrated object.
export const readPaymentModeUuid = (visit: any): string => {
  const raw = visit?.attributes?.find((a: any) => a?.attributeType?.uuid === PAYMENT_MODE_ATTRIBUTE_UUID)?.value;
  return typeof raw === 'string' ? raw : (raw?.uuid ?? '');
};

export const useActiveVisits = (date?: string) => {
  const sessionLocation = useSession();

  // Fetch visits from the start of the selected day (defaults to today).
  const fromStartDate = (date ? dayjs(date) : dayjs()).startOf('day').toISOString();
  // Custom rep so the patient's FULL identifier list (incl. the CR number) and
  // the payment-mode attribute are both present.
  const rep =
    'custom:(uuid,startDatetime,visitType:(uuid,display),' +
    'patient:(uuid,display,identifiers:(identifier,identifierType:(uuid,display))),' +
    'attributes:(uuid,value,attributeType:(uuid)))';
  const url = `${restBaseUrl}/visit?location=${sessionLocation?.sessionLocation?.uuid}&includeInactive=false&fromStartDate=${fromStartDate}&v=${rep}`;

  const { data, error, isLoading } = useSWR<{
    data: {
      results: Array<Visit>;
    };
  }>(url, openmrsFetch);

  return {
    activeVisits: data?.data?.results,
    error,
    isLoading,
  };
};

// Patient identifiers (CR number, national id, SHA number…) that already have a
// SHA claim visit for the location/day. Once a claim visit exists the patient has
// moved into the claims workflow and is no longer pending clearance.
const useClaimedPatientIds = (locationUuid: string, date?: string) => {
  const { data } = useSWR(locationUuid && date ? ['facility-claim-visits', locationUuid, date] : null, () =>
    fetchFacilityClaimVisits({ locationUuid, visitDate: date }),
  );

  return useMemo(() => new Set((data ?? []).map((cv) => cv.patientId?.trim()).filter(Boolean)), [data]);
};

// True when any of the visit's patient identifiers already has an associated SHA
// claim visit.
const visitHasClaim = (visit: Visit, claimedPatientIds: Set<string>): boolean => {
  if (claimedPatientIds.size === 0) {
    return false;
  }
  return (visit.patient?.identifiers ?? []).some(
    (identifier: any) => identifier?.identifier && claimedPatientIds.has(identifier.identifier.trim()),
  );
};

// The Pending clearance queue: active visits paying via SHA and awaiting their
// claim. Shared by the ActiveVisits list and the tab count so they stay in sync.
export const usePendingClearanceVisits = (date?: string) => {
  const { activeVisits, isLoading, error } = useActiveVisits(date);
  const { shaPaymentModeUuid } = useConfig<ConfigObject>();
  const sessionLocation = useSession();
  const locationUuid = sessionLocation?.sessionLocation?.uuid ?? '';
  const claimedPatientIds = useClaimedPatientIds(locationUuid, date);

  const dayFilter = date ? dayjs(date) : null;
  const visits = (activeVisits ?? [])
    .filter((visit) => !dayFilter || dayjs(visit.startDatetime).isSame(dayFilter, 'day'))
    .filter((visit) => readPaymentModeUuid(visit) === shaPaymentModeUuid);
  // Drop visits that already have an associated SHA claim visit — those have
  // left "pending clearance" and are being handled in the claims workflow.
  // .filter((visit) => !visitHasClaim(visit, claimedPatientIds));

  return { visits, count: visits.length, isLoading, error };
};
