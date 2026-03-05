import React, { useState } from 'react';
import styles from './edit-bill-item.modal.scss';
import { type LineItem } from '../../../../shared/types';
import { type EditBillLineItemDto, type Bill } from '../../../types';
import { Modal, ModalBody, TextInput } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import { editBillLineItem } from '../../bill.resource';
interface EditBillItemModalProps {
  open: boolean;
  lineItem: LineItem;
  bill: Bill;
  onModalClose: () => void;
  onSuccessfullEdit: () => void;
}
const EditBillItemModal: React.FC<EditBillItemModalProps> = ({
  open,
  lineItem,
  bill,
  onModalClose,
  onSuccessfullEdit,
}) => {
  const [newQuantity, setNewQuantity] = useState<number>();
  if (!lineItem || !bill) {
    return <>No Line item selected</>;
  }
  const isValidatePayload = (): boolean => {
    if (!newQuantity || newQuantity < 1) {
      showSnackbar({
        kind: 'error',
        title: 'Invalid set Quantity',
        subtitle: 'Please enter a valid quantity',
      });
      return false;
    }
    return true;
  };
  const handleSaveBillLineItem = async () => {
    if (isValidatePayload()) {
      const editBillLineItemDto = generateEditPayload();
      try {
        const resp = await editBillLineItem(bill.uuid, editBillLineItemDto);
        if (resp) {
          showSnackbar({
            kind: 'success',
            title: 'Edit Successfull',
            subtitle: 'Bill Quantity has been edited successfully',
          });
        }
        onSuccessfullEdit();
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: 'Invalid set Quantity',
          subtitle: 'Please enter a valid quantity',
        });
      }
    }
  };
  const newQuantityHandler = (newQty: number) => {
    setNewQuantity(newQty);
  };
  const generateEditPayload = (): EditBillLineItemDto => {
    const payload = {
      cashPoint: bill.cashPoint.uuid,
      cashier: bill.cashier.uuid,
      lineItems: [
        {
          ...lineItem,
          quantity: newQuantity,
        },
      ],
      patient: bill.patient.uuid,
      status: bill.status,
      uuid: bill.uuid,
    } as EditBillLineItemDto;
    return payload;
  };
  return (
    <>
      <Modal
        modalHeading="Edit Bill Line item"
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={handleSaveBillLineItem}
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.editLineItemLayout}>
            <div className={styles.contentSection}>
              <div className={styles.form}>
                <div className={styles.formRow}>
                  <TextInput
                    id="name"
                    labelText="Name"
                    value={`${lineItem.billableService} (${lineItem.priceName}) ${lineItem.price}`}
                    readOnly
                  />
                </div>
                <div className={styles.formRow}>
                  <TextInput id="Old Quantity" labelText="Current Quantity" value={`${lineItem.quantity}`} readOnly />
                </div>
                <div className={styles.formRow}>
                  <TextInput
                    id="quantity"
                    labelText="Quantity"
                    min={1}
                    type="number"
                    onChange={(e) => newQuantityHandler(parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};
export default EditBillItemModal;
