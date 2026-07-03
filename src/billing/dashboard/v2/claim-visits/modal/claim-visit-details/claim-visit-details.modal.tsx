import React from 'react';
import styles from './claim-visit-details.modal.scss';
import { Modal, ModalBody } from '@carbon/react';
import ClaimVisitDetails from '../../claim-visit-details/claim-visit-details.component';
import { type ClaimsVisit } from '../../../types';
interface claimVisitDetailsModalProps {
  open: boolean;
  claimsVisit: ClaimsVisit;
  locationUuid: string;
  handleClose: () => void;
}
const ClaimVisitDetailsModal: React.FC<claimVisitDetailsModalProps> = ({ open, claimsVisit, handleClose, locationUuid }) => {
  return (
    <>
      <Modal
        open={open}
        size="lg"
        onSecondarySubmit={() => {}}
        onRequestClose={handleClose}
        onRequestSubmit={() => {}}
        primaryButtonText=""
        secondaryButtonText="Close"
      >
        <ModalBody>
          <div className={styles.cvModalLayout}>
            <ClaimVisitDetails claimsVisit={claimsVisit} locationUuid={locationUuid}/>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};
export default ClaimVisitDetailsModal;
