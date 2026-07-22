import React, { useState } from 'react';
import { Button, InlineNotification } from '@carbon/react';
import { Mobile } from '@carbon/react/icons';
import BiometricsVerificationModal from '../biometrics-verification-modal/biometrics-verification-modal';
import OTPWhitlistingModal from '../otp-modal/otp-whitlisting-modal.component';
import { type OTPWhitelistRequest } from '../../hie.types';
import styles from './claims-consent.scss';

// Registration-style consent: try biometric capture up to 3 times, then fall
// back to OTP (which itself handles the whitelisting request if the client
// isn't whitelisted).
const MAX_BIOMETRIC_ATTEMPTS = 3;

interface ClaimsConsentModalProps {
  submitting: boolean;
  otpSent: boolean;
  whitelistRequest: any;
  onWhitelistSubmit: (payload: OTPWhitelistRequest) => Promise<any>;
  onSendClaimsOtp: () => Promise<any>;
  onOtpVerified: (otp: string) => Promise<any>;
  onOtpVerificationStatusChange: (verified: boolean) => void;
  serviceType: string;
  interventionCode: string;
  crId: string;
  onScanStatusChange: (status: string) => void;
}
const ClaimsConsentModal: React.FC<ClaimsConsentModalProps> = ({
  onSendClaimsOtp,
  onWhitelistSubmit,
  onOtpVerified,
  submitting,
  otpSent,
  whitelistRequest,
  serviceType,
  interventionCode,
  crId,
  onScanStatusChange,
}) => {
  // Verify biometric-first; after MAX_BIOMETRIC_ATTEMPTS failures we default to OTP.
  const [mode, setMode] = useState<'biometric' | 'otp'>('biometric');
  const [attempts, setAttempts] = useState(0);
  const [bioStatus, setBioStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [whiteListed, setIsWhitelisted] = useState<boolean>();
  const [otpVerified, setOtpVerified] = useState(false);

  const handleBiometricFailure = (reason: string) => {
    // An init/service error (device or biometric service unavailable) must NOT
    // burn an attempt or fall through to OTP — stay on biometric so the client
    // can retry the capture. Only genuine capture outcomes count toward the 3
    // attempts: rejected, expired or a scan timeout.
    if (reason === 'error') {
      return;
    }
    setAttempts((prev) => {
      const next = prev + 1;
      if (next >= MAX_BIOMETRIC_ATTEMPTS) {
        setMode('otp');
      }
      return next;
    });
  };

  if (mode === 'otp') {
    return (
      <OTPWhitlistingModal
        submitting={submitting}
        otpSent={otpSent}
        whitelistRequest={whitelistRequest}
        onWhitelistStatusChange={setIsWhitelisted}
        onWhitelistSubmit={onWhitelistSubmit}
        onSendClaimsOtp={onSendClaimsOtp}
        onOtpVerified={onOtpVerified}
        onOtpVerificationStatusChange={setOtpVerified}
        crId={crId}
      />
    );
  }

  return (
    <div className={styles.consent}>
      <div className={styles.header}>
        <span className={styles.title}>Biometric verification</span>
        <span className={styles.attempts}>
          <span className={styles.dots}>
            {Array.from({ length: MAX_BIOMETRIC_ATTEMPTS }).map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i < attempts ? styles.dotUsed : i === attempts ? styles.dotCurrent : ''}`}
              />
            ))}
          </span>
          <span className={styles.attemptsLabel}>
            Attempt {Math.min(attempts + 1, MAX_BIOMETRIC_ATTEMPTS)} of {MAX_BIOMETRIC_ATTEMPTS}
          </span>
        </span>
      </div>
      {attempts > 0 ? (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title="Biometric attempt failed"
          subtitle={`Retrying — after ${MAX_BIOMETRIC_ATTEMPTS} failed attempts you'll verify by OTP instead.`}
        />
      ) : null}
      {/* Re-mount on each attempt so a fresh capture session is initialised. */}
      <BiometricsVerificationModal
        key={attempts}
        open
        onClose={() => {}}
        serviceType={serviceType}
        interventionCode={interventionCode}
        onScanStatusChange={onScanStatusChange}
        onFailure={handleBiometricFailure}
        onStatusChange={setBioStatus}
      />
      {/* OTP fallback — always available for now. */}
      <div className={styles.otpFallback}>
        <span className={styles.otpFallbackHint}>Fingerprint not working?</span>
        <Button className={styles.useOtp} kind="ghost" size="sm" renderIcon={Mobile} onClick={() => setMode('otp')}>
          Use OTP instead
        </Button>
      </div>
    </div>
  );
};

export default ClaimsConsentModal;
