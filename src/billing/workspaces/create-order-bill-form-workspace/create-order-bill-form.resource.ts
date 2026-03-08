import { openmrsFetch, OpenmrsResource, restBaseUrl } from "@openmrs/esm-framework";
import { useState } from "react";
import useSWR from 'swr';
import { getHieBaseUrl } from "../../../shared/utils/get-base-url";
import { postJson } from "../../../registry/registry.resource";

export const useBillableItems = () => {
    const url = `${restBaseUrl}/billing/billableService?v=custom:(uuid,name,shortName,serviceStatus,serviceType:(uuid,display),servicePrices:(uuid,name,price,paymentMode),concept:(uuid))`;
    const { data, isLoading, error } = useSWR<{ data: { results: Array<OpenmrsResource> } }>(url, openmrsFetch);
    const [searchTerm, setSearchTerm] = useState('');
    const filteredItems =
        data?.data?.results?.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? [];
    return {
        lineItems: filteredItems,
        isLoading,
        error,
        searchTerm,
        setSearchTerm,
    };
};

export const useCashPoint = () => {
    const url = `/ws/rest/v1/billing/cashPoint`;
    const { data, isLoading, error } = useSWR<{ data: { results: Array<OpenmrsResource> } }>(url, openmrsFetch);

    return { isLoading, error, cashPoints: data?.data?.results ?? [] };
};

export const createPatientBill = (payload) => {
    const postUrl = `${restBaseUrl}/billing/bill`;
    return openmrsFetch<{ uuid: string }>(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
};

export const removePatientBill = (uuid) => {
    const purgeUrl = `${restBaseUrl}/billing/bill/${uuid}?purge=true`;
    return openmrsFetch<{ uuid: string }>(purgeUrl, { method: 'DELETE' });
};

export const createOrderBillInHie = async (payload) => {
    const hieBaseUrl = await getHieBaseUrl();
    const url = `${hieBaseUrl}/bill-order`;
    return postJson<{ bill_uuid: string }>(url, payload);
}
