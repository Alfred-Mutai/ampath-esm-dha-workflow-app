import { type PatientFacilityBillDetails } from '../types';

/**
 * Who is paying for a bill line, and what that means for how the bill is shown.
 *
 * A bill's payer is not one field. `payment_scheme` carries the scheme when ETL knows it,
 * a consent token means the visit was authorised through SHA/HIE, and the line's price
 * name is what the cashier actually charged against. The rules for reading those live
 * here rather than in a component, so a page, a table cell and a summary tile can't come
 * to different conclusions about the same bill.
 */
export type PaymentModeKey = 'cash' | 'sha' | 'copay' | 'insurance' | 'unknown';

export interface PaymentModeDescriptor {
  key: PaymentModeKey;
  /** What to call it on screen. */
  label: string;
  /** The scheme's own name where there is one — "Social Health Insurance Fund", a private
      insurer — which `label` is too short to carry. */
  schemeName?: string;
  /** Carbon tag colour, so the same payer is the same colour everywhere. */
  tagType: 'green' | 'blue' | 'teal' | 'purple' | 'gray';
  /** Whether this bill has a claim behind it worth linking to. */
  hasClaim: boolean;
  /** Whether the patient pays part of it themselves — the reason a co-pay is its own
      mode rather than a kind of insurance. */
  hasPatientPortion: boolean;
}

const norm = (value?: string | null): string => (value ?? '').trim().toUpperCase();

/** The scheme as the bill records it, cased for reading rather than matching. */
const schemeLabel = (value?: string | null): string | undefined => {
  const v = (value ?? '').trim();
  return v ? v : undefined;
};

/**
 * A bill line's payment mode.
 *
 * Order matters: a line can satisfy more than one test — a SHA claim with a co-pay has
 * both a consent token and a patient portion — and the more specific answer is the useful
 * one, so co-pay is decided before SHA and SHA before "some insurer".
 */
export function paymentModeOf(line?: Partial<PatientFacilityBillDetails> | null): PaymentModeDescriptor {
  if (!line) {
    return { key: 'unknown', label: 'Unknown', tagType: 'gray', hasClaim: false, hasPatientPortion: false };
  }

  const scheme = norm(line.payment_scheme);
  const name = schemeLabel(line.payment_scheme);
  const hasToken = Boolean((line.consent_token ?? '').trim());

  // A co-pay is a bill the patient part-pays alongside a payer, so it is neither cash nor
  // a plain insurance line and is worth naming as itself.
  if (scheme.includes('COPAY') || scheme.includes('CO-PAY')) {
    return {
      key: 'copay',
      label: 'Co-pay',
      schemeName: name,
      tagType: 'purple',
      hasClaim: hasToken,
      hasPatientPortion: true,
    };
  }

  if (scheme.includes('SHA') || scheme.includes('SHIF') || scheme.includes('SOCIAL HEALTH') || hasToken) {
    return { key: 'sha', label: 'SHA', schemeName: name, tagType: 'teal', hasClaim: true, hasPatientPortion: false };
  }

  if (scheme.includes('CASH') || scheme.includes('SELF')) {
    return { key: 'cash', label: 'Cash', schemeName: name, tagType: 'green', hasClaim: false, hasPatientPortion: true };
  }

  // Named scheme that is none of the above: another insurer. Kept as one mode rather than
  // one per company, since what changes between them is the name and nothing else.
  if (name) {
    return {
      key: 'insurance',
      label: 'Insurance',
      schemeName: name,
      tagType: 'blue',
      hasClaim: hasToken,
      hasPatientPortion: false,
    };
  }

  // No scheme and no token is how a straight cash bill usually arrives.
  return { key: 'cash', label: 'Cash', tagType: 'green', hasClaim: false, hasPatientPortion: true };
}

/**
 * The payment mode for a whole bill, which is a set of lines.
 *
 * A visit's lines can be split across payers — an insured consultation with a cash
 * pharmacy item. Rather than pick a winner, that is reported as what it is, so the page
 * can say so instead of labelling the whole bill after whichever line happened to be
 * first.
 */
export function billPaymentModes(lines: PatientFacilityBillDetails[] = []): {
  modes: PaymentModeDescriptor[];
  primary: PaymentModeDescriptor;
  mixed: boolean;
} {
  const byKey = new Map<PaymentModeKey, PaymentModeDescriptor>();
  for (const line of lines) {
    const mode = paymentModeOf(line);
    if (!byKey.has(mode.key)) {
      byKey.set(mode.key, mode);
    }
  }
  const modes = [...byKey.values()];
  // The payer of the most lines would be arbitrary on a two-line bill; the first is at
  // least stable, and `mixed` is what the page actually reacts to.
  const primary = modes[0] ?? paymentModeOf(null);
  return { modes, primary, mixed: modes.length > 1 };
}
