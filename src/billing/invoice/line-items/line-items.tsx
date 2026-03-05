import React, { useState } from 'react';
import {
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { type LineItem } from '../../../shared/types';
import DeleteBillLineItemModal from '../modal/delete-bill-item/delete-bill-item.modal';
import EditBillItemModal from '../modal/edit-bill-item/edit-bill-item.modal';
import { type Bill } from '../../types';
interface LineItemsProps {
  lineItems: LineItem[];
  refresh: () => void;
  bill?: Bill;
}
const LineItems: React.FC<LineItemsProps> = ({ lineItems, refresh, bill }) => {
  const [selectedLineItem, setSelectedLineItem] = useState<LineItem>();
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>();
  const [showEditModal, setShowEditModal] = useState<boolean>();
  if (!lineItems || lineItems.length === 0) {
    return <>No Data to Display</>;
  }
  const handleEditLineItem = (selectedLineItem: LineItem) => {
    setSelectedLineItem(selectedLineItem);
    setShowEditModal(true);
  };
  const handleDeleteLineItem = (selectedLineItem: LineItem) => {
    setSelectedLineItem(selectedLineItem);
    setShowDeleteModal(true);
  };
  const hideDeleteModal = () => {
    setShowDeleteModal(false);
    refresh();
  };
  const hideEditModal = () => {
    setShowEditModal(false);
    refresh();
  };
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Bill Item</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Quantity</TableHeader>
            <TableHeader>Price</TableHeader>
            <TableHeader>Total</TableHeader>
            <TableHeader>Action</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {lineItems.map((item, index) => {
            return (
              <>
                <TableRow id={item.uuid}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.billableService}</TableCell>
                  <TableCell>{item.paymentStatus}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>KES {item.price}</TableCell>
                  <TableCell>KES {item.price * item.quantity}</TableCell>
                  <TableCell>
                    <>
                      {bill.status === 'PENDING' ? (
                        <>
                          <OverflowMenu aria-label="overflow-menu">
                            <OverflowMenuItem itemText="Edit" onClick={() => handleEditLineItem(item)} />
                            <OverflowMenuItem itemText="Delete" onClick={() => handleDeleteLineItem(item)} />
                          </OverflowMenu>
                        </>
                      ) : (
                        <></>
                      )}
                    </>
                  </TableCell>
                </TableRow>
              </>
            );
          })}
        </TableBody>
      </Table>
      {showDeleteModal ? (
        <>
          <DeleteBillLineItemModal
            lineItem={selectedLineItem}
            onModalClose={hideDeleteModal}
            onSuccessfullDeletion={hideDeleteModal}
            open={showDeleteModal}
          />
        </>
      ) : (
        <></>
      )}

      {showEditModal ? (
        <>
          <EditBillItemModal
            lineItem={selectedLineItem}
            onModalClose={hideEditModal}
            onSuccessfullEdit={hideEditModal}
            open={showEditModal}
            bill={bill}
          />
        </>
      ) : (
        <></>
      )}
    </>
  );
};
export default LineItems;
