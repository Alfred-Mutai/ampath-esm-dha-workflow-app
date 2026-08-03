import React, { useEffect, useState } from 'react';
import { type QueueRoom, type CreateQueueRoomDto, type Queue } from '../../../../../types/types';
import { Modal, ModalBody, Select, SelectItem, TextInput } from '@carbon/react';
import styles from './edit-queue-room.modal.scss';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { editQueueRoom, getQueuesByLocationUuid } from '../../../../service-queues.resource';

interface EditQueueRoomModalProps {
  open: boolean;
  queueRoom: QueueRoom;
  onModalClose: () => void;
}

const EditQueueRoomModal: React.FC<EditQueueRoomModalProps> = ({ open, queueRoom, onModalClose }) => {
  const session = useSession();
  const location = session.sessionLocation;
  const locationUuid = location.uuid;
  const [queueRoomName, setQueueRoomName] = useState<string>(queueRoom.name);
  const [description, setDescription] = useState<string>(queueRoom.description);
  const [queueServiceUuid, setQueueServiceUuid] = useState<string>();
  const [queues, setQueues] = useState<Queue[]>([]);

  useEffect(() => {
    fetchQueues();
  }, [locationUuid]);
  const fetchQueues = async () => {
    const queues = await getQueuesByLocationUuid(locationUuid);
    setQueues(queues);
  };

  const handleQueueRoomName = (queueRoomName: string) => {
    setQueueRoomName(queueRoomName);
  };
  const handleQueueDescription = (queueDescription: string) => {
    setDescription(queueDescription);
  };
  const handleQueueService = (queueServiceUuid: string) => {
    setQueueServiceUuid(queueServiceUuid);
  };
  if (!queueRoom) {
    return <>No Queue room selected</>;
  }
  const handleUpdateQueueRoom = async () => {
    const payload = generateCreateQueueRoomPayload();
    if (isValidateEditQueueRoomDto(payload)) {
      const resp = await editQueueRoom(queueRoom.uuid, payload);
      if (resp) {
        showAlert('Queue updated successfully!', 'success');
        onModalClose();
      }
    }
  };
  const generateCreateQueueRoomPayload = (): CreateQueueRoomDto => {
    return {
      name: queueRoomName,
      description: description,
      queue: {
        uuid: queueServiceUuid,
      },
    };
  };
  const isValidateEditQueueRoomDto = (payload: CreateQueueRoomDto): boolean => {
    if (!payload.name) {
      showAlert('Please add the queue room name', 'error');
      return false;
    }
    if (!payload.description) {
      showAlert('Please add the queue room description', 'error');
      return false;
    }
    if (!payload.queue) {
      showAlert('Please add the queue service', 'error');
      return false;
    } else {
      if (!payload.queue.uuid) {
        showAlert('Please select a queue service', 'error');
        return false;
      }
    }
    return true;
  };
  const showAlert = (message: string, alertType: 'success' | 'error') => {
    showSnackbar({
      kind: alertType,
      title: 'Queue Room Updated',
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
        onRequestSubmit={handleUpdateQueueRoom}
        primaryButtonText="Update Queue Room"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.createQueueModalLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Update Queue Room</h4>
            </div>
            <div className={styles.createQueueModalContentSection}>
              <div className={styles.createQueueModalFormRow}>
                <div className={styles.createQueueModalFormControl}>
                  <TextInput
                    id="queue-room-name"
                    labelText="Queue Room Name"
                    value={queueRoomName}
                    onChange={(e) => handleQueueRoomName(e.target.value)}
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
                  <Select id="service" labelText="Service Queue" onChange={(e) => handleQueueService(e.target.value)}>
                    <SelectItem value="" text="Select Queue" />
                    {queues.map((queue) => {
                      return <SelectItem value={queue.uuid} text={queue.display} />;
                    })}
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

export default EditQueueRoomModal;
