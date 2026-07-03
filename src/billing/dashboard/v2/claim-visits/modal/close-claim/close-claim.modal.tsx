import React, { useState } from 'react';
import { Modal, ModalBody, Select, SelectItem, TextInput } from '@carbon/react';
import styles from './close-claim.modal.scss';
import { addClaimItem, closeClaim } from '../../../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-framework';
import { ClaimCloseReasonType, type CloseClaimDto } from '../../../types';

interface closeClaimModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  consentToken: string;
  locationUuid: string;
}
const CloseClaimModal: React.FC<closeClaimModalProps> = ({ open, onClose, onSuccess, locationUuid, consentToken }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [cancelReasonType, setCancelReasonType] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const closeClaimReasonTypes = Object.values(ClaimCloseReasonType);
  async function handleCloseClaim() {
    setLoading(true);
    try {
      const closeClaimPayload = getCloseClaimPayload();
      if (isValidClaimClosePayload(closeClaimPayload)) {
        return false;
      }

      const resp = await closeClaim(closeClaimPayload);
      if ('error' in resp) {
        showSnackbar({
          title: 'Error Adding Closing claim',
          kind: 'error',
          subtitle: 'An error occurred while closing the claim. Kindy retry or contact support',
        });
        onSuccess();
      } else {
        showSnackbar({
          title: 'Sucess Closing Claim',
          kind: 'success',
          subtitle: 'Claim closed successfully',
        });
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error Closing Claim',
        subtitle: 'An error occurred while closing the claim. Kindy retry or contact support',
      });
    } finally {
      setLoading(false);
    }
  }
  function getCloseClaimPayload(): CloseClaimDto {
    return {
      consentToken: consentToken,
      cancelReasonType: cancelReasonType ?? '',
      cancelReasonText: cancelReason ?? '',
      locationUuid: locationUuid,
    };
  }
  function holderFunction() {
    return;
  }
  function cancelClaimReasonTypeHandler(cancelReasonType: string) {
    setCancelReasonType(cancelReasonType);
  }
  function cancelClaimReasonHandler(cancelReason: string) {
    setCancelReason(cancelReason);
  }
  function isValidClaimClosePayload(closeClaimDto: CloseClaimDto): boolean {
    if (!closeClaimDto.cancelReasonText) {
      showSnackbar({
        kind: 'error',
        title: 'Missing Cancel Reason',
        subtitle: 'Please add a cancel reason',
      });
      return false;
    }
    if (!closeClaimDto.cancelReasonType) {
      showSnackbar({
        kind: 'error',
        title: 'Missing Cancel Reason Type',
        subtitle: 'Please add a cancel reason type',
      });
      return false;
    }
    return true;
  }
  return (
    <>
      <Modal
        modalHeading="Close Claim"
        open={open}
        size="md"
        onSecondarySubmit={onClose}
        onRequestClose={onClose}
        onRequestSubmit={loading ? holderFunction : handleCloseClaim}
        primaryButtonText={loading ? 'Closing Claim...' : 'Close Claim'}
        secondaryButtonText="Close"
      >
        <ModalBody>
          <div className={styles.closeClaimModalLayout}>
            <div className={styles.closeClaimModalRow}>
              <Select
                id="cancel_reason_type"
                labelText="Cancel Reason Type"
                onChange={($event) => cancelClaimReasonTypeHandler($event.target.value)}
              >
                <SelectItem value="" text="Select" />;
                {closeClaimReasonTypes.map((c) => {
                  return <SelectItem value={c} text={c} />;
                })}
              </Select>
            </div>
            <div className={styles.closeClaimModalRow}>
              <TextInput
                id="cancel_reason_text"
                labelText="Cancel Reason"
                onChange={($event) => cancelClaimReasonHandler($event.target.value)}
              />
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};
export default CloseClaimModal;
