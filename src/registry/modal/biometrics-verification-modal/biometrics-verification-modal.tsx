/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';

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
    // eslint-disable-next-line no-console
    console.log('Patient:', patient);
    // eslint-disable-next-line no-console
    console.log('Location UUID:', locationUuid);
    // eslint-disable-next-line no-console
    console.log('Intervention Code:', interventionCode);
    // eslint-disable-next-line no-console
    console.log('Service Type:', serviceType);
    if (!patient || !locationUuid) return;
    async function fetchBiometricUrl() {
      try {
        const urlData = await getBiometrictsRequestUrl(patient!, locationUuid!, interventionCode, serviceType);
        // eslint-disable-next-line no-console
        console.log('Biometric request URL response:', urlData);

        // eslint-disable-next-line no-console
        console.log('Request URL:', urlData?.shaVerificationRequest?.requestUrl);

        const url = urlData?.shaVerificationRequest?.requestUrl;

        setBiometricIframeUrl(url);
      } catch (err) {
        console.error('Failed to fetch biometric URL:', err);
        setError('Failed to load biometric verification. Please try again later.');
      }
    }

    fetchBiometricUrl();
  }, [patient, locationUuid, interventionCode, serviceType]);

  const config = useMemo(
    () => ({
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
    }),
    [],
  );

  useEffect(() => {
    if (!open || !biometricIframeUrl) return;
    const handler = (event: MessageEvent) => {
      // eslint-disable-next-line no-console
      console.log('Received message from iframe:', event.data);
      // eslint-disable-next-line no-console
      console.log('Open:', event.data);
      if (!open || !biometricIframeUrl) return;

      const origin = new URL(biometricIframeUrl).origin;
      if (event.origin !== origin) return;

      const data = event.data;

      console.log('Message:', data);
      console.log('Origin:', event.origin);

      if (!data || typeof data !== 'object') return;
      if (data.type === 'BIOMETRIC_RESULT') {
        setCaptureResult(data.payload);
        setScanning(false);
      }

      if (data.type === 'BIOMETRIC_ERROR') {
        setError(data.message);
        setScanning(false);
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [open, biometricIframeUrl]);

  const startScan = () => {
    if (!biometricIframeUrl) return;

    const origin = new URL(biometricIframeUrl).origin;

    setScanning(true);
    setError(null);

    iframeRef.current?.contentWindow?.postMessage({ type: 'START_CAPTURE' }, origin);
  };

  // const startScan = () => {
  //   setScanning(true);
  //   setError(null);

  //   iframeRef.current?.contentWindow?.postMessage({ type: 'START_CAPTURE' }, origin);
  // };

  // eslint-disable-next-line no-console
  console.log('biometricIframeUrl:', biometricIframeUrl);

  return (
    <div>
      <div>
        <div className={styles.container}>
          <h2 className={styles.centerText}>Biometrics Verification</h2>
          <p className={styles.centerText}>Please verify your identity using biometrics.</p>

          {/* Scanner zone */}
          {/* {biometricIframeUrl && <iframe ref={iframeRef} src={`${biometricIframeUrl}`} className={styles.iframe} />} */}
          {biometricIframeUrl && (
            <iframe
              ref={iframeRef}
              src={biometricIframeUrl}
              className={styles.iframe}
              onLoad={() => {
                console.log('Iframe loaded');

                const origin = new URL(biometricIframeUrl).origin;

                iframeRef.current?.contentWindow?.postMessage(config, origin);
              }}
              onError={() => console.log('Iframe failed')}
            />
          )}

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
