/**
 * Remittances — DEMO STUBS for the DHA Remittance service.
 * Replace with:
 *   getRemittances            -> GET /api/v1/remittances
 *   getClaimsPaidByRemittance -> GET claims paid by a remittance
 *     (re-exported from claims-accounting.resource so both share the claim store)
 */

export type RemittanceStatus = 'RECEIVED' | 'RECONCILED';

export interface Remittance {
  ref: string;
  date: string;
  payer: string;
  claimCount: number;
  totalAmount: number;
  status: RemittanceStatus;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const REMITTANCES: Remittance[] = [
  {
    ref: 'RMT-2026-0417',
    date: '2026-07-05',
    payer: 'SHA / SHIF',
    claimCount: 2,
    totalAmount: 7500,
    status: 'RECONCILED',
  },
  {
    ref: 'RMT-2026-0421',
    date: '2026-07-07',
    payer: 'SHA / UHC',
    claimCount: 1,
    totalAmount: 800,
    status: 'RECEIVED',
  },
];

export async function getRemittances(): Promise<Remittance[]> {
  await wait(300);
  return [...REMITTANCES].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export { getClaimsPaidByRemittance } from './claims-accounting.resource';
