import { openmrsFetch, OpenmrsResource, restBaseUrl } from "@openmrs/esm-framework";
import { useState } from "react";
import useSWR from 'swr';

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
    return openmrsFetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
};
