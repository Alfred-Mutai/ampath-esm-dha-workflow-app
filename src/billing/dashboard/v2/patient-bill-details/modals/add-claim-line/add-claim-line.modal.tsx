import React, { useState } from 'react';
import { Modal, ModalBody, TextInput } from '@carbon/react';
import styles from './add-claim-line.modal.scss';
import { type AddClaimLineDto, type PatientFacilityBillDetails } from '../../../types';
import { addClaimItem } from '../../../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-framework';

interface addClaimLineModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  billItem: PatientFacilityBillDetails;
  locationUuid: string;
}
const AddClaimLineModal: React.FC<addClaimLineModalProps> = ({ open, onClose, onSuccess, billItem, locationUuid }) => {
   const [loading,setLoading] = useState<boolean>(false);
  async function handleAddClaimLineItem() {
    setLoading(true);
    const addClaimLineDto = getClaimLineDto();
    try{
        const resp = await addClaimItem(addClaimLineDto);
        if(resp['error']){
           showSnackbar({
             title: resp['error'] ?? 'Error Adding Claim Line',
             kind: 'error',
             subtitle: resp['message'] ?? 'An error occurred while adding the claim line. Kindy retry or contact support'
           })
           onSuccess();
        }else{
             showSnackbar({
             title: 'Sucess Adding Claim Line',
             kind: 'success',
             subtitle: 'Claim Item added successfully'
           })
        }
    }catch(error){
       showSnackbar({
        kind: 'error',
        title: 'Error Adding Claim Line',
        subtitle: 'An error occurred while adding the claim line. Kindy retry or contact support'
       });
    }finally{
        setLoading(false);
    }
  }
  function getClaimLineDto(): AddClaimLineDto {
    return {
      consentToken: billItem.consent_token,
      interventionCode: billItem.intervention_code,
      unitPrice: String(billItem.item_price),
      quantity: String(billItem.item_quantity),
      locationUuid: locationUuid,
    };
  }
  function holderFunction(){
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
        onRequestSubmit={loading ? holderFunction : handleAddClaimLineItem}
        primaryButtonText={loading ? 'Adding...': 'Add'}
        secondaryButtonText="Close"
      >
        <ModalBody>
          <div className={styles.addClaimLineModalLayout}>
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
                id="bill-item-amount"
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
