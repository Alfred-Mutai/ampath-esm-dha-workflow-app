/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';

import styles from './biometrics-verification-modal.scss';
import { Button } from '@carbon/react';
import { getWorkstationId, getBiometrictsRequestUrl } from '../../hie.resource';
import { usePatient } from '../../../context/patient-context';
import { useSession } from '@openmrs/esm-framework';
import { type BiometricsStatus } from '../../hie.types';

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
  const [workstationId, setWorkstationId] = useState<string>('');
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid;

  const { patient } = usePatient();

  useEffect(() => {
    async function fetchWorkstationId() {
      try {
        const workstationData: BiometricsStatus = await getWorkstationId();
        setWorkstationId(workstationData.workstationID);
      } catch (err) {
        console.error('Failed to fetch workstation ID:', err);
        setError('Failed to load workstation ID. Please try again later.');
      }
    }

    fetchWorkstationId();
  }, []);

  useEffect(() => {
    if (!patient || !locationUuid) return;
    async function fetchBiometricUrl() {
      try {
        const urlData = await getBiometrictsRequestUrl(
          patient!,
          locationUuid!,
          interventionCode,
          serviceType,
          workstationId,
        );
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
  }, [patient, locationUuid, interventionCode, serviceType, workstationId]);

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
        workstationID: workstationId || '54cf356c-c4f9-4fd2-a9df-9ca1723b98a6-B0A460977E12',
        version: '1.14.0519.1301',
      },
    }),
    [workstationId],
  );

  useEffect(() => {
    if (!open || !biometricIframeUrl) return;
    const expectedOrigin = new URL(biometricIframeUrl).origin;
    const handler = (event: MessageEvent) => {
      console.log('================================');
      console.log('Expected Origin:', expectedOrigin);
      console.log('Actual Origin:', event.origin);
      console.log('Event:', event);
      console.log('Data:', event.data);
      console.log('================================');

      if (event.origin !== expectedOrigin) {
        return;
      }

      const data = event.data;

      if (!data || typeof data !== 'object') {
        return;
      }

      if (data.status === 'SUCCESS') {
        setCaptureResult(data);
      } else if (data.type === 'BIOMETRIC_RESULT') {
        setCaptureResult(data.payload);
      } else if (data.status === 'SCANNING') {
        setScanning(true);
      } else if (data.status === 'IDLE') {
        setScanning(false);
      } else if (data.status === 'ERROR') {
        setError(data.message || 'An error occurred during biometric verification.');
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [open, biometricIframeUrl]);

  // eslint-disable-next-line no-console
  console.log('biometricIframeUrl:', biometricIframeUrl);

  return (
    <div>
      <div>
        <div className={styles.container}>
          <h2 className={styles.centerText}>Biometrics Verification</h2>
          <p className={styles.centerText}>Please verify your identity using biometrics.</p>

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
