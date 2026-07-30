import React, { useEffect, useState } from 'react';
import { InlineNotification, Modal, ModalBody, TextInput } from '@carbon/react';
import styles from './add-claim-line.modal.scss';
import { type AddClaimLineDto, type PatientFacilityBillDetails } from '../../../types';
import { addClaimItem } from '../../../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-framework';
import { extractPreauthStatus, getPreauthPreview } from '../../../../../../claims/claims.resource';
import { asBool, getStoredPreauthCode, needsNormalPreauth } from '../../../preauth/preauth.resource';

interface addClaimLineModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  billItem: PatientFacilityBillDetails;
  locationUuid: string;
  /** Prefer visit-derived token when available */
  consentToken?: string;
}
const AddClaimLineModal: React.FC<addClaimLineModalProps> = ({
  open,
  onClose,
  onSuccess,
  billItem,
  locationUuid,
  consentToken: consentTokenProp,
}) => {
  const [loading, setLoading] = useState(false);
  const [checkingPreauth, setCheckingPreauth] = useState(false);
  const [preauthBlocked, setPreauthBlocked] = useState(false);
  const [preauthCode, setPreauthCode] = useState<string | undefined>();

  const resolvedToken = consentTokenProp || billItem.consent_token || '';

  useEffect(() => {
    if (!open || !needsNormalPreauth(billItem) || !resolvedToken) {
      setPreauthBlocked(false);
      setPreauthCode(getStoredPreauthCode(resolvedToken, billItem.intervention_code));
      return;
    }

    let cancelled = false;
    const run = async () => {
      setCheckingPreauth(true);
      try {
        const stored = getStoredPreauthCode(resolvedToken, billItem.intervention_code);
        setPreauthCode(stored);
        const preview = await getPreauthPreview(resolvedToken, locationUuid);
        const status = extractPreauthStatus(preview);
        if (!cancelled) {
          const ok = status === 'FINALISED' || status === 'FINALIZED' || asBool(billItem.preauth_approved);
          setPreauthBlocked(!ok);
        }
      } catch {
        if (!cancelled) {
          // If preview fails but we have a stored code or approved flag, allow; else block.
          setPreauthBlocked(!asBool(billItem.preauth_approved) && !getStoredPreauthCode(resolvedToken, billItem.intervention_code));
        }
      } finally {
        if (!cancelled) setCheckingPreauth(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, billItem, resolvedToken, locationUuid]);

  async function handleAddClaimLineItem() {
    if (preauthBlocked) {
      showSnackbar({
        kind: 'error',
        title: 'Preauth required',
        subtitle: 'Wait until preauth is FINALISED before adding a claim line for this intervention.',
      });
      return;
    }
    setLoading(true);
    const addClaimLineDto = getClaimLineDto();
    try {
      const resp = await addClaimItem(addClaimLineDto);
      if (resp['error']) {
        showSnackbar({
          title: resp['error'] ?? 'Error Adding Claim Line',
          kind: 'error',
          subtitle:
            resp['message'] ?? 'An error occurred while adding the claim line. Kindy retry or contact support',
        });
        onSuccess();
      } else {
        showSnackbar({
          title: 'Sucess Adding Claim Line',
          kind: 'success',
          subtitle: 'Claim Item added successfully',
        });
        onSuccess();
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error Adding Claim Line',
        subtitle: 'An error occurred while adding the claim line. Kindy retry or contact support',
      });
    } finally {
      setLoading(false);
    }
  }
  function getClaimLineDto(): AddClaimLineDto {
    const dto: AddClaimLineDto = {
      consentToken: resolvedToken,
      interventionCode: billItem.intervention_code,
      unitPrice: String(billItem.item_price),
      quantity: String(billItem.item_quantity),
      locationUuid: locationUuid,
    };
    if (preauthCode) {
      dto.preauthCode = preauthCode;
    }
    return dto;
  }
  function holderFunction() {
    return;
  }
  return (
    <>
      <Modal
        modalHeading="Add Claim Line"
        open={open}
        size="md"
        onSecondarySubmit={onClose}
        onRequestClose={onClose}
        onRequestSubmit={loading || checkingPreauth || preauthBlocked ? holderFunction : handleAddClaimLineItem}
        primaryButtonText={loading ? 'Adding...' : 'Add'}
        secondaryButtonText="Close"
        primaryButtonDisabled={loading || checkingPreauth || preauthBlocked || !resolvedToken}
      >
        <ModalBody>
          <div className={styles.addClaimLineModalLayout}>
            {preauthBlocked ? (
              <InlineNotification
                kind="warning"
                lowContrast
                hideCloseButton
                title="Preauth not finalised"
                subtitle="Raise and finalise preauth for this intervention before adding a claim line."
              />
            ) : null}
            {preauthCode ? (
              <InlineNotification
                kind="info"
                lowContrast
                hideCloseButton
                title="Preauth code"
                subtitle={preauthCode}
              />
            ) : null}
            <div className={styles.addClaimLineModalRow}>
              <TextInput
                id="bill-item"
                labelText="Intervention Code"
                value={billItem.intervention_code}
                readOnly={true}
              />
            </div>
            <div className={styles.addClaimLineModalRow}>
              <TextInput
                id="bill-item-amount"
                labelText="Unit Price"
                value={`Ksh ${billItem.item_price}`}
                readOnly={true}
              />
            </div>
            <div className={styles.addClaimLineModalRow}>
              <TextInput
                id="bill-item-qty"
                labelText="Quantity"
                value={billItem.item_quantity}
                readOnly={true}
              />
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};
export default AddClaimLineModal;
