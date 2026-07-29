import React, { useRef } from 'react';
import styles from './cancel-admission-request.scss';
import { Modal, ModalBody, TextArea } from '@carbon/react';
import { type FacilityAdmissionRequest, type CancelAdmissionDto, type Disposition } from '../../types';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { AdmissionConcepts, AdmissionEncounterTypeUuids } from '../../constants';
import { cancelAdmissionRequest } from '../../admissions.resource';

interface CancelAdmissionRequestModalProps {
  open: boolean;
  facilityAdmissionRequest: FacilityAdmissionRequest;
  onModalClose: () => void;
  onCancelAdmission: () => void;
}
const CancelAdmissionRequestModal: React.FC<CancelAdmissionRequestModalProps> = ({
  open,
  facilityAdmissionRequest,
  onCancelAdmission,
  onModalClose,
}) => {
  const reasonRef = useRef<string>();
  const session = useSession();
  const location = session.sessionLocation;
  const handleReasonText = (reason: string) => {
    reasonRef.current = reason;
  };
  const handleCancelRequest = async () => {
    try {
      const cancelAdmissionDto = generateCancelAdmissionRequestDto();
      const resp = await cancelAdmissionRequest(cancelAdmissionDto);
      if (resp) {
        showSnackbar({
          kind: 'success',
          title: 'Cancel request successfull',
          subtitle: 'Admission request succesfully cancelled',
        });
      }
      onCancelAdmission();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Bed Assignment failed',
        subtitle: error.message ?? 'Bed Assignment failed',
      });
    }
  };
  const generateCancelAdmissionRequestDto = (): CancelAdmissionDto => {
    return {
      patient: facilityAdmissionRequest.patient_uuid,
      encounterType: {
        uuid: AdmissionEncounterTypeUuids.CANCEL_ADT_ENCOUNTER_TYPE_UUID,
      },
      location: facilityAdmissionRequest.location_uuid,
      obs: [
        {
          concept: AdmissionConcepts.CLINICAL_NOTES_UUID,
          value: reasonRef.current,
        },
        {
          concept: AdmissionConcepts.ADMISSION_TO_HOSPITAL_DECISION_UUID,
          value: {
            uuid: AdmissionConcepts.ADMISSION_DENIED_UUID,
          },
        },
      ],
      visit: facilityAdmissionRequest.visit_uuid,
    };
  };

  return (
    <>
      <Modal
        modalHeading="Cancel Admission Request"
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={handleCancelRequest}
        primaryButtonText="Cancel Admission Request"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.cancelAdmissionLayout}>
            <div className={styles.contentSection}>
              <div className={styles.formRow}>
                <TextArea
                  enableCounter
                  helperText=""
                  id="cancel-reason"
                  labelText="Cancel Reason"
                  maxCount={500}
                  placeholder=""
                  rows={4}
                  onChange={(e) => handleReasonText(e.target.value)}
                />
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default CancelAdmissionRequestModal;
