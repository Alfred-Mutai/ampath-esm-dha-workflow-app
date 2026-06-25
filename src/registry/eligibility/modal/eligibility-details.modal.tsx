import { Modal, ModalBody, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { type HieClientEligibility } from '../../types';
import React from 'react';
import styles from './eligibility-details.modal.scss';
import { getTagType } from '../../../shared/utils/get-tag-type';
import EligibilityDetails from '../eligibility-details/eligibility-details';

interface ClientEligibilityDetailsModalProps {
  hieClientEligibility: HieClientEligibility;
  open: boolean;
  onModalClose: () => void;
  onSubmit: () => void;
}

const ClientEligibilityDetailsModal: React.FC<ClientEligibilityDetailsModalProps> = ({
  hieClientEligibility,
  open,
  onModalClose,
  onSubmit,
}) => {
  if (!hieClientEligibility) {
    return <>No Client data</>;
  }
  return (
    <>
      <Modal
        open={open}
        size="lg"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={onModalClose}
        primaryButtonText="Done"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <EligibilityDetails
           hieClientEligibility={hieClientEligibility}
          />
        </ModalBody>
      </Modal>
    </>
  );
};

export default ClientEligibilityDetailsModal;
