import React, { useRef } from 'react';
import {
  Modal,
  ModalBody,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextArea,
} from '@carbon/react';
import { type LineItem } from '../../../../shared/types';
import styles from './delete-bill-item.modal.scss';
import LineItems from '../../line-items/line-items';
import { deleteBillLineItem } from '../../bill.resource';
import { showSnackbar } from '@openmrs/esm-framework';
interface DeleteBillLineItemProps {
  open: boolean;
  lineItem: LineItem;
  onModalClose: () => void;
  onSuccessfullDeletion: () => void;
}
const DeleteBillLineItemModal: React.FC<DeleteBillLineItemProps> = ({
  open,
  lineItem,
  onModalClose,
  onSuccessfullDeletion,
}) => {
  const reasonRef = useRef<string>();

  if (!lineItem) {
    return <>No Line Item Selected</>;
  }
  const handleReasonText = (reason: string) => {
    reasonRef.current = reason;
  };
  const handleBillItemDeletion = async () => {
    try {
      await deleteBillLineItem(lineItem.uuid, reasonRef.current);
      showSnackbar({
        kind: 'success',
        title: 'Bill Item deleted successfully',
        subtitle: 'Bill line item has been succesfully deleted',
      });
      onSuccessfullDeletion();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error Deleting Bill Line Item',
        subtitle:
          error.message ?? 'An error occurred while deleting the bill line item. Kindly retry of contact support',
      });
    }
  };
  return (
    <>
      <Modal
        modalHeading="Delete Bill Line item"
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={handleBillItemDeletion}
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.deleteLineItemLayout}>
            <div className={styles.contentSection}>
              <div className={styles.details}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Bill Item</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Quantity</TableHeader>
                      <TableHeader>Price</TableHeader>
                      <TableHeader>Total</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow id={lineItem.uuid}>
                      <TableCell>{lineItem.billableService}</TableCell>
                      <TableCell>{lineItem.status}</TableCell>
                      <TableCell>{lineItem.quantity}</TableCell>
                      <TableCell>KES {lineItem.price}</TableCell>
                      <TableCell>KES {lineItem.price * lineItem.quantity}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className={styles.form}>
                <div className={styles.formRow}>
                  <TextArea
                    enableCounter
                    helperText=""
                    id="delete-reason"
                    labelText="Delete Reason"
                    maxCount={500}
                    placeholder=""
                    rows={4}
                    onChange={(e) => handleReasonText(e.target.value)}
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
export default DeleteBillLineItemModal;
