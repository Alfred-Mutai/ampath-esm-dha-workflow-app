import React from 'react';
import styles from './add-claim-doctor.modal.scss';
import { Button, Modal, ModalBody, TextInput } from '@carbon/react';
import { type ClaimDoctor } from '../../../../types';

interface claimInvoiceLinesModalProps {
  open: boolean;
  handleClose: () => void;
  claimDoctors: ClaimDoctor[];
  consentToken: string;
}
const AddClaimDoctorModal: React.FC<claimInvoiceLinesModalProps> = ({ open, handleClose, claimDoctors, consentToken }) => {
  function handleDoctorChange(natId: string){
  }
  function handleDoctorSearch(){

  }
  return (
    <>
        <Modal
          modalHeading="Add Claim Doctor"
          open={open}
          size="md"
          onSecondarySubmit={() => {}}
          onRequestClose={handleClose}
          onRequestSubmit={() => {}}
          primaryButtonText="Add"
          secondaryButtonText="Close"
        >
          <ModalBody>
           <div className={styles.addClaimDoctorModalLayout}>
            <div className={styles.addClaimDoctorlRow}>
              <TextInput
                id="doctor-national-id"
                labelText="Doctor National ID"
                type='number'
                onChange={(e)=>handleDoctorChange(e.target?.value ?? '')}
              />
            </div>
            <div className={styles.addClaimDoctorlRow}>
                <Button onClick={handleDoctorSearch}>Search</Button>
            </div>
            </div>
          </ModalBody>
        </Modal>
    </>
  );
};
export default AddClaimDoctorModal;
