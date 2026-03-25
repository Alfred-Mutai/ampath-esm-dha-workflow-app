import { Button, InlineLoading, Modal, ModalBody, Select, SelectItem, TextArea } from '@carbon/react';
import React, { useEffect, useState } from 'react';
import styles from './move-patient.component.scss';
import { type ServiceQueue } from '../../../registry/types';
import { getServiceQueueByLocation, transitionQueueEntry } from '../../service.resource';
import { type TransitionQueueEntryDto } from '../../../types/types';
import { QUEUE_PRIORITIES_UUIDS, QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { showSnackbar } from '@openmrs/esm-framework';
interface MovePatientModalProps {
  open: boolean;
  onModalClose: () => void;
  locationUuid: string;
  currentQueueEntryUuid: string;
  onTransferSuccess?: () => void;
}
const MovePatientModal: React.FC<MovePatientModalProps> = ({
  open,
  onModalClose,
  locationUuid,
  currentQueueEntryUuid,
  onTransferSuccess,
}) => {
  const [serviceQueues, setServiceQueues] = useState<ServiceQueue[]>([]);
  const [selectedComment, setSelectedComment] = useState<string>();
  const [selectedPriority, setSelectedPriority] = useState<string>();
  const [selectedNewService, setSelectedNewService] = useState<ServiceQueue>();
  const [loading, setLoading] = useState<boolean>(false);
  useEffect(() => {
    getQueues();
  }, [locationUuid]);
  const serviceChangeHandler = (serviceQueueUuid: string) => {
    const serviceQueue = serviceQueues.find((sq) => {
      return sq.uuid === serviceQueueUuid;
    });
    setSelectedNewService(serviceQueue);
  };
  const getQueues = async () => {
    const res = await getServiceQueueByLocation(locationUuid);
    setServiceQueues(res);
  };
  const transtionQueueEntry = async () => {
    if (loading) {
      showAlert('error', 'Trsnefering patient', 'Transfering patient...please wait');
    }
    setLoading(true);
    const payload = getTransitionQueueEntryPayload();
    try {
      const resp = await transitionQueueEntry(payload);
      showAlert('success', 'Client succesfully moved', '');
      onTransferSuccess();
    } catch (e) {
      showAlert('error', e.message, '');
      setLoading(false);
    }
  };

  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };
  const getTransitionQueueEntryPayload = (): TransitionQueueEntryDto => {
    const payload: TransitionQueueEntryDto = {
      queueEntryToTransition: currentQueueEntryUuid,
      newQueue: selectedNewService.uuid,
      newStatus: QUEUE_STATUS_UUIDS.WAITING_UUID,
      newPriority: selectedPriority,
      newPriorityComment: selectedComment,
    };

    return payload;
  };
  const priorityChangeHandler = (priorityUuid: string) => {
    setSelectedPriority(priorityUuid);
  };
  const handleCommentChange = (comment: string) => {
    setSelectedComment(comment);
  };
  const placeHolderFunction = () => {};
  return (
    <>
      <Modal
        modalHeading="Transfer Client"
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={loading ? placeHolderFunction : transtionQueueEntry}
        primaryButtonText={loading ? <InlineLoading description="Transfering..." /> : 'Transfer'}
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.modelLayout}>
            <div className={styles.formSection}>
              <div className={styles.formRow}>
                <div className={styles.formControl}>
                  <Select
                    id="service-queue"
                    labelText="Select the new Queue"
                    onChange={(e) => serviceChangeHandler(e.target.value)}
                  >
                    <SelectItem value="" text="" />;
                    {serviceQueues &&
                      serviceQueues
                        .filter((qe) => {
                          return qe.uuid !== currentQueueEntryUuid;
                        })
                        .map((vt) => {
                          return <SelectItem value={vt.uuid} text={`${vt.name} (${vt.location.display})`} />;
                        })}
                  </Select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formControl}>
                  <Select
                    id="priority"
                    labelText="Select a Priority"
                    onChange={(e) => priorityChangeHandler(e.target.value)}
                  >
                    <SelectItem value="" text="Select" />;
                    <SelectItem value={QUEUE_PRIORITIES_UUIDS.NORMAL_PRIORITY_UUID} text="PRIORITY" />;
                    <SelectItem value={QUEUE_PRIORITIES_UUIDS.NOT_URGENT_PRIORITY_UUID} text="NON URGENT" />;
                    <SelectItem value={QUEUE_PRIORITIES_UUIDS.EMERGENCY_PRIORITY_UUID} text="EMERGENCY" />;
                  </Select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formControl}>
                  <TextArea
                    enableCounter
                    helperText=""
                    id="comment"
                    labelText="Comment"
                    maxCount={500}
                    placeholder=""
                    onChange={(e) => handleCommentChange(e.target.value)}
                    rows={4}
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

export default MovePatientModal;
