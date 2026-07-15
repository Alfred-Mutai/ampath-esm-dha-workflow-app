/**
 * Verification integrations for the registration workflow.
 *
 * NOTE: These are DEMO STUBS so the drawer flow can be clicked end-to-end.
 * Replace each with the real biometric SDK / SHA endpoints when available.
 */

export type WhitelistStatus = 'none' | 'pending' | 'approved';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Demo-only in-memory flag: once a whitelist request is submitted, the next
// status check reports it approved so the flow can continue to OTP.
let whitelistRequested = false;

/** Whether a biometric capture device/config is available on this workstation. */
export function isBiometricConfigured(): boolean {
  // DEMO: return false to mimic a workstation with no fingerprint scanner, so the
  // flow shows the "Biometric not available" branch and falls back to OTP.
  // Set to true when a real biometric device/config is available.
  return false;
}

/**
 * Launch a biometric capture session. Returns the URL to embed in an iframe for
 * fingerprint capture, or null if a session could not be started.
 */
export async function getBiometricCaptureUrl(crId: string): Promise<string | null> {
  // DEMO: return a self-contained data-URI so the iframe renders visibly.
  // Replace with the real capture URL returned by the biometric service.
  await wait(500);
  const html = `<!doctype html><html><body style="margin:0;font-family:'IBM Plex Sans',sans-serif;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#161616;background:#f4f4f4">
    <div style="font-size:56px">🖐️</div>
    <p style="margin:0;font-weight:600">Fingerprint capture in progress…</p>
    <p style="margin:0;color:#525252;font-size:13px">Demo iframe — the real biometric capture UI loads here.</p>
  </body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/** Current OTP whitelist status for a client (from the SHA team's approval queue). */
export async function getOtpWhitelistStatus(crId: string): Promise<WhitelistStatus> {
  // DEMO: default to already whitelisted so biometric failure goes straight to OTP.
  // To preview the whitelist-request flow instead, return `whitelistRequested ? 'approved' : 'none'`.
  await wait(400);
  return 'approved';
}

export interface WhitelistRequestPayload {
  crId: string;
  reason: string;
  failureCount: number;
  failedBiometricImage?: File | null;
}

/** Submit an OTP-whitelist request to the SHA team for approval. */
export async function requestOtpWhitelist(payload: WhitelistRequestPayload): Promise<void> {
  // DEMO: mark as requested so the next status check returns "approved".
  await wait(400);
  whitelistRequested = true;
}
