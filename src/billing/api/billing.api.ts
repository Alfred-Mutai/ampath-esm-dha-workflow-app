import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export async function fetchBillById(billId: string) {
  const res = await openmrsFetch(`${restBaseUrl}/billing/bill/${billId}`);
  return res.data;
}

export async function fetchPaymentModes() {
  const res = await openmrsFetch(`${restBaseUrl}/billing/paymentMode`);
  return res.data;
}

export async function fetchAllBills() {
  const res = await openmrsFetch(
    `${restBaseUrl}/billing/bill?v=custom:(id,uuid,dateCreated,status,receiptNumber,patient:(uuid,display),cashier:(uuid,display),lineItems:(uuid,price,priceName,billableService,voided))&status=PENDING,POSTED,PAID&limit=500&startIndex=0&totalCount=true`,
  );
  return res.data;
}

export async function processPayment(billId: string, payload: any) {
  return openmrsFetch(`${restBaseUrl}/billing/bill/${billId}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
}

export async function raiseSHAClaim(billId: string, payload: any) {
  return openmrsFetch(`${restBaseUrl}/billing/bill/${billId}/sha-claim`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateQuantity(itemId: string, quantity: number) {
  return openmrsFetch(`${restBaseUrl}/billing/item/${itemId}/quantity`, {
    method: 'PATCH',
    body: { quantity },
  });
}

export async function deleteBillItem(itemId: string) {
  return openmrsFetch(`${restBaseUrl}/billing/item/${itemId}`, {
    method: 'DELETE',
  });
}
