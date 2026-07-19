/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';

import styles from './biometrics-verification-modal.scss';
import { getWorkstationId, getBiometrictsRequestUrl, getAuthorizations } from '../../hie.resource';
import { usePatient } from '../../../context/patient-context';
import { useSession } from '@openmrs/esm-framework';
import { type BiometricsStatus } from '../../hie.types';

type BiometricsVerificationModalProps = {
  open: boolean;
  onClose: () => void;
  serviceType: string;
  interventionCode: string;
  onScanStatusChange?: (status: string) => void;
};

const BiometricsVerificationModal: React.FC<BiometricsVerificationModalProps> = ({
  open,
  onClose,
  serviceType,
  interventionCode,
  onScanStatusChange,
}) => {
  const [error, setError] = useState<string | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [biometricIframeUrl, setBiometricIframeUrl] = useState<string>('');
  const [workstationId, setWorkstationId] = useState<string>('');
  const [authGuid, setAuthGuid] = useState<string>();
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid;

  const { patient } = usePatient();

  useEffect(() => {
    if (!patient || !locationUuid) return;

    const initialize = async () => {
      try {
        const workstation: BiometricsStatus = await getWorkstationId();
        setWorkstationId(workstation.workstationID);

        const urlData = await getBiometrictsRequestUrl(
          patient,
          locationUuid,
          interventionCode,
          serviceType,
          workstation.workstationID,
        );
        const token = urlData.token;

        const url = urlData?.shaVerificationRequest?.requestUrl;

        setBiometricIframeUrl(url);

        const pending = await getAuthorizations(locationUuid!, undefined, token);

        const authGuid = pending[0].status;
        setAuthGuid(authGuid);
        console.log('Child sending:', authGuid);
        onScanStatusChange?.(authGuid);
      } catch (err) {
        console.error(err);
        setError('Failed to initialize biometric verification.');
      }
    };

    initialize();
  }, [patient, locationUuid, interventionCode, serviceType, onScanStatusChange]);

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
                setTimeout(() => {
                  const origin = new URL(biometricIframeUrl).origin;
                  iframeRef.current?.contentWindow?.postMessage(config, origin);
                }, 500);
              }}
              onError={() => console.log('Iframe failed')}
            />
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default BiometricsVerificationModal;
