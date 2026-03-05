import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Bill, type PayBillDto, type Payment } from '../types';

export async function fetchBill(billUuid: string): Promise<Bill> {
  const billUrl = `${restBaseUrl}/billing/bill/${billUuid}`;
  const resp = await openmrsFetch<Bill>(billUrl);
  const result = await resp.json();
  return result;
}

export async function payBill(billUuid: string, payBillDto: PayBillDto): Promise<Payment> {
  const billUrl = `${restBaseUrl}/billing/bill/${billUuid}/payment`;
  const resp = await openmrsFetch<Bill>(billUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payBillDto),
  });
  const result = await resp.json();
  return result;
}
