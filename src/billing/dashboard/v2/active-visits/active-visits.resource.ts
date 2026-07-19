import { openmrsFetch, restBaseUrl, useSession, Visit } from "@openmrs/esm-framework";
import dayjs from "dayjs";
import useSWR from "swr";

export const useActiveVisits = (date?: string) => {
    const sessionLocation = useSession();

    // Fetch visits from the start of the selected day (defaults to today).
    const fromStartDate = (date ? dayjs(date) : dayjs()).startOf('day').toISOString();
    const url = `${restBaseUrl}/visit?location=${sessionLocation?.sessionLocation?.uuid}&includeInactive=false&fromStartDate=${fromStartDate}&v=full`;

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