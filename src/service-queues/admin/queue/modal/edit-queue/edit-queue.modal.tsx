import React, { useState } from 'react';
import { type CreateQueueDto, type Queue } from '../../../../../types/types';
import { Modal, ModalBody, Select, SelectItem, TextInput } from '@carbon/react';
import styles from './edit-queue.modal.scss';
import { QUEUE_SERVICE_UUIDS } from '../../../../../shared/constants/concepts';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { editQueue } from '../../../../service-queues.resource';

interface EditQueueModalProps {
  open: boolean;
  queue: Queue;
  onModalClose: () => void;
}

const EditQueueModal: React.FC<EditQueueModalProps> = ({ open, queue, onModalClose }) => {
  const session = useSession();
  const location = session.sessionLocation;
  const [queueName, setQueueName] = useState<string>(queue.name);
  const [description, setDescription] = useState<string>(queue.description);
  const [queueService, setQueueService] = useState<string>();

  const handleQueueName = (queueName: string) => {
    setQueueName(queueName);
  };
  const handleQueueDescription = (queueDescription: string) => {
    setDescription(queueDescription);
  };
  const handleQueueService = (queueServiceUuid: string) => {
    setQueueService(queueServiceUuid);
  };
  if (!queue) {
    return <>No Queue selected</>;
  }
  const handleUpdateQueue = async () => {
    const payload = generateCreateQueuePayload();
    if (isValidateEditQueueDto(payload)) {
      const resp = await editQueue(queue.uuid, payload);
      if (resp) {
        showAlert('Queue updated successfully!', 'success');
        onModalClose();
      }
    }
  };
  const generateCreateQueuePayload = (): CreateQueueDto => {
    return {
      name: queueName,
      description: description,
      service: {
        uuid: queueService,
      },
      location: {
        uuid: location.uuid,
      },
    };
  };
  const isValidateEditQueueDto = (payload: CreateQueueDto): boolean => {
    if (!payload.name) {
      showAlert('Please add the queue name', 'error');
      return false;
    }
    if (!payload.description) {
      showAlert('Please add the queue description', 'error');
      return false;
    }
    if (!payload.service) {
      showAlert('Please add the queue service', 'error');
      return false;
    } else {
      if (!payload.service.uuid) {
        showAlert('Please select as service', 'error');
        return false;
      }
    }
    return true;
  };
  const showAlert = (message: string, alertType: 'success' | 'error') => {
    showSnackbar({
      kind: alertType,
      title: 'Queue Deleted',
      subtitle: message,
    });
  };
  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={handleUpdateQueue}
        primaryButtonText="Update Queue"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.createQueueModalLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Create Service Queue</h4>
            </div>
            <div className={styles.createQueueModalContentSection}>
              <div className={styles.createQueueModalFormRow}>
                <div className={styles.createQueueModalFormControl}>
                  <TextInput
                    id="queue-name"
                    labelText="Queue Name"
                    value={queueName}
                    onChange={(e) => handleQueueName(e.target.value)}
                    type="text"
                  />
                </div>
              </div>
              <div className={styles.createQueueModalFormRow}>
                <div className={styles.createQueueModalFormControl}>
                  <TextInput
                    id="description"
                    value={description}
                    labelText="Description"
                    onChange={(e) => handleQueueDescription(e.target.value)}
                    type="text"
                  />
                </div>
              </div>
              <div className={styles.createQueueModalFormRow}>
                <div className={styles.createQueueModalFormControl}>
                  <Select id="service" labelText="Service" onChange={(e) => handleQueueService(e.target.value)}>
                    <SelectItem value="" text="Select Service" />
                    <SelectItem value={QUEUE_SERVICE_UUIDS.TRIAGE_SERVICE_UUID} text="Triage Service" />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.CLINICAL_CONSULTATION_SERVICE_UUID}
                      text="Clinical Consultation Service"
                    />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.MCH_TRIAGE_SERVICE_UUID}
                      text="Maternal Child Health Triage Service"
                    />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.MCH_CLINICAL_CONSULTATION_SERVICE_UUID}
                      text="Maternal Child Health Consultation Service"
                    />
                    <SelectItem value={QUEUE_SERVICE_UUIDS.MATERNITY_TRIAGE_SERVICE_UUID} text="Maternity Triage" />
                    <SelectItem value={QUEUE_SERVICE_UUIDS.DIALYSIS_TRIAGE_SERVICE_UUID} text="Renal Triage" />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.DIALYSIS_CONSULTATION_SERVICE_UUID}
                      text="Renal Consultation"
                    />
                    <SelectItem value={QUEUE_SERVICE_UUIDS.ONCOLOGY_TRIAGE_SERVICE_UUID} text="Oncology Triage" />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.ONCOLOGY_CONSULTATION_SERVICE_UUID}
                      text="Oncology Consultation"
                    />
                    <SelectItem value={QUEUE_SERVICE_UUIDS.DENTAL_TRIAGE_SERVICE_UUID} text="Dental Triage" />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.DENTAL_CONSULTATION_SERVICE_UUID}
                      text="Dental Consultation"
                    />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.DIAGNOSTIC_AND_IMAGING_TRIAGE_SERVICE_UUID}
                      text="Diagnosis and Imaging Triage"
                    />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.DIAGNOSTIC_AND_IMAGING_CONSULTATION_SERVICE_UUID}
                      text="Diagnosis and Imaging Consultation"
                    />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.OPTHALMOLOGY_TRIAGE_SERVICE_UUID}
                      text="Opthalmology Triage"
                    />
                    <SelectItem
                      value={QUEUE_SERVICE_UUIDS.OPTHALMOLOGY_CONSULTATION_SERVICE_UUID}
                      text="Opthalmology Consultation"
                    />
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default EditQueueModal;
