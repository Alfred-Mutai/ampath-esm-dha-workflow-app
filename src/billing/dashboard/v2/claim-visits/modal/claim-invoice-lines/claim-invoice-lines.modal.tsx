import React from 'react';
import { type ClaimInvoiceLine } from '../../../types';
import ClaimInvoiceLineDetails from '../../claim-invoice-line-details/claim-invoice-line-details.component';
import styles from './claim-invoice-lines.modal.scss';
import { Modal, ModalBody } from '@carbon/react';

interface claimInvoiceLinesModalProps {
  open: boolean;
  handleClose: () => void;
  claimInvoiceLines: ClaimInvoiceLine[];
  consentToken: string;
}
const ClaimInvoiceLinesModal: React.FC<claimInvoiceLinesModalProps> = ({ open, handleClose, claimInvoiceLines, consentToken }) => {
  return (
    <>
        <Modal
          modalHeading="Invoice Line Details"
          open={open}
          size="lg"
          onSecondarySubmit={() => {}}
          onRequestClose={handleClose}
          onRequestSubmit={() => {}}
          primaryButtonText=""
          secondaryButtonText="Close"
        >
          <ModalBody>
           <div className={styles.claimInvoiceLinesModalLayout}>
              <ClaimInvoiceLineDetails claimInvoiceLines={claimInvoiceLines} consentToken={consentToken}/>
            </div>
          </ModalBody>
        </Modal>
    </>
  );
};
export default ClaimInvoiceLinesModal;
