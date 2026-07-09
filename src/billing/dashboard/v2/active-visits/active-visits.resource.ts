import { openmrsFetch, restBaseUrl, useSession, Visit } from "@openmrs/esm-framework";
import dayjs from "dayjs";
import useSWR from "swr";

export const useActiveVisits = () => {
    const sessionLocation = useSession();

    const url = `${restBaseUrl}/visit?location=${sessionLocation?.sessionLocation?.uuid}&includeInactive=false&fromStartDate=${dayjs().startOf('day').toISOString()}&v=full`;

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