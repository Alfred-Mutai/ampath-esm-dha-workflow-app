import { openmrsFetch, restBaseUrl, useConfig, useSession, Visit } from "@openmrs/esm-framework";
import dayjs from "dayjs";
import useSWR from "swr";
import { type ConfigObject } from "../../../../config-schema";

// Visit attribute that records the payment mode chosen at registration.
const PAYMENT_MODE_ATTRIBUTE_UUID = '8553afa0-bdb9-4d3c-8a98-05fa9350aa85';

// The payment mode value can come back as a plain uuid or a hydrated object.
export const readPaymentModeUuid = (visit: any): string => {
    const raw = visit?.attributes?.find((a: any) => a?.attributeType?.uuid === PAYMENT_MODE_ATTRIBUTE_UUID)?.value;
    return typeof raw === 'string' ? raw : raw?.uuid ?? '';
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

    const {
        data,
        error,
        isLoading
    } = useSWR<{
        data: {
            results: Array<Visit>
        }
    }>(url, openmrsFetch);

    return {
        activeVisits: data?.data?.results,
        error,
        isLoading
    };
}

// The Pending clearance queue: active visits paying via SHA and awaiting their
// claim. Shared by the ActiveVisits list and the tab count so they stay in sync.
export const usePendingClearanceVisits = (date?: string) => {
    const { activeVisits, isLoading, error } = useActiveVisits(date);
    const { shaPaymentModeUuid } = useConfig<ConfigObject>();

    const dayFilter = date ? dayjs(date) : null;
    const visits = (activeVisits ?? [])
        .filter((visit) => !dayFilter || dayjs(visit.startDatetime).isSame(dayFilter, 'day'))
        .filter((visit) => readPaymentModeUuid(visit) === shaPaymentModeUuid);

    return { visits, count: visits.length, isLoading, error };
};