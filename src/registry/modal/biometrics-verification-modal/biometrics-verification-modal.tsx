import React, { useEffect, useState } from 'react';

import styles from './biometrics-verification-modal.scss';
import { Button } from '@carbon/react';
import { getBiometrictsRequestUrl } from '../../hie.resource';
import { usePatient } from '../../../context/patient-context';
import { useSession } from '@openmrs/esm-framework';

type BiometricsVerificationModalProps = {
  open: boolean;
  onClose: () => void;
  serviceType: string;
  interventionCode: string;
};

const BiometricsVerificationModal: React.FC<BiometricsVerificationModalProps> = ({
  open,
  onClose,
  serviceType,
  interventionCode,
}) => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [biometricIframeUrl, setBiometricIframeUrl] = useState<string>('');
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid;

  const { patient } = usePatient();

  useEffect(() => {
    async function fetchBiometricUrl() {
      try {
        const urlData = await getBiometrictsRequestUrl(patient!, locationUuid!, interventionCode, serviceType);
        // eslint-disable-next-line no-console
        console.log('Biometric request URL response:', urlData);

        const url = urlData?.shaVerificationRequest?.requestUrl;

        setBiometricIframeUrl(url);
      } catch (err) {
        console.error('Failed to fetch biometric URL:', err);
        setError('Failed to load biometric verification. Please try again later.');
      }
    }

    fetchBiometricUrl();
  }, []);

  const config = {
    type: 'INIT_DEVICE_CONFIG',
    payload: {
      devices: [
        {
          id: 'H59241200603',
          name: 'Secugen',
          displayName: 'SladeID',
          type: 'Fingerprint',
        },
      ],
      card_readers: [],
      isAuthed: true,
      workstationID: '790bf760-08e6-4fbe-b892-7b877dd52f2b-F406692C85F3',
      version: '1.14.0519.1301',
    },
  };

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(config, `${biometricIframeUrl}`);
    }, 1000);

    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MessageEvent) => {
      // if (event.origin !== `${biometricIframeUrl}`) return;

      const data = event.data;

      // if (data?.type === 'BIOMETRIC_RESULT') {
      setCaptureResult(data.payload);
      setScanning(false);
      // }

      if (data?.type === 'BIOMETRIC_ERROR') {
        setError(data.message || 'Biometric capture failed');
        setScanning(false);
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [open]);

  const startScan = () => {
    setScanning(true);
    setError(null);

    iframeRef.current?.contentWindow?.postMessage({ type: 'START_CAPTURE' }, `${biometricIframeUrl}`);
  };

  return (
    <div>
      <div>
        <div className={styles.container}>
          <h2 className={styles.centerText}>Biometrics Verification</h2>
          <p className={styles.centerText}>Please verify your identity using biometrics.</p>

          {/* Scanner zone */}
          {biometricIframeUrl && <iframe ref={iframeRef} src={`${biometricIframeUrl}`} className={styles.iframe} />}

          <p className={`${styles.statusLabel} ${scanning ? styles.active : ''}`}>
            {scanning ? 'acquiring biometric data...' : 'awaiting input'}
          </p>

          <Button className={styles.button} onClick={startScan} disabled={scanning}>
            <span>{scanning ? 'Scanning...' : 'Scan Fingerprint'}</span>
          </Button>

          {captureResult && (
            <div className={styles.result}>
              <div className={styles.qualityRow}>
                <span>Quality: {captureResult.quality}%</span>

                <div className={styles.qualityBar}>
                  <div className={styles.qualityBarInner} style={{ width: `${captureResult.quality}%` }} />
                </div>
              </div>

              <img
                className={styles.fingerprintImage}
                src={`data:image/bmp;base64,${captureResult.image}`}
                alt="Fingerprint preview"
              />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default BiometricsVerificationModal;
