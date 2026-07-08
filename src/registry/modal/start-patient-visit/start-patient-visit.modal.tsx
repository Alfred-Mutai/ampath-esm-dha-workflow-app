import React, { useMemo, useState } from "react";
import { Button, ComboBox, Modal, ModalBody } from "@carbon/react";
import { showSnackbar, type Visit, type Patient, useSession } from "@openmrs/esm-framework";
import { type VisitAttribute, type CreateVisitDto, type HieClient } from "../../types";
import styles from './start-patient-visit.modal.scss';
import { PatientTypes } from "../../../shared/constants/patient-type";
import { VisitTypeUuids } from "../../../shared/constants/visit-types";
import { createVisit } from "../../../resources/visit.resource";
interface startPatientVisitModalProps {
  amrsPatient: Patient | null;
  open: boolean;
  onModalClose: (modalCloseResp?: { success: boolean }) => void;
  onSubmit: () => void;
  client: HieClient;
  onCreateAmrsPatient: (client: HieClient) => void;
  onManualRegistration: () => void;
}
const StartPatientVisitModal: React.FC<startPatientVisitModalProps> = ({open,amrsPatient,onModalClose,onSubmit,client,onCreateAmrsPatient,onManualRegistration})=>{
  const [selectedPatientType, setSelectedPatientType] = useState<string>();
  const [selectedVisitType, setSelectedVisitType] = useState<string>();
  const [loading, setLoading] = useState<boolean>(false);
  const [disableSubmission, setDisableSubmission] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  
  const patientTypeHandler = (selectedPatientType: { selectedItem: { id: string; text: string } }) => {
    const pt = selectedPatientType.selectedItem.id;
    setSelectedPatientType(pt);
  };
  const visitTypeChangeHandler = (selectedVisitType: { selectedItem: { id: string; text: string } }) => {
    const vt = selectedVisitType.selectedItem.id;
    setSelectedVisitType(vt);
  };
   const patientTypeOptions = useMemo(
    () => [
      {
        text: 'Walk-In',
        id: PatientTypes.WALK_IN_UUID,
      },
      {
        text: 'Self-Referral',
        id: PatientTypes.SELF_RERERRAL_UUID,
      },
     {
        text: 'Referral from another Facility',
        id: PatientTypes.REFERRAL_FROM_ANOTHER_FACILITY_UUID,
      },
      {
        text: 'Referral from Community',
        id: PatientTypes.REFERRED_BY_COMMUNITY_HEALTH_WORKER_UUID,
      },
    ],
    [client],
  );
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };
  const startPatientVisit = async () => {
    if (disableSubmission) {
      showAlert(
        'error',
        'Form already Submitted',
        'Form has already been submitted, please wait for the visit to be created',
      );
      return;
    }
    setDisableSubmission(true);
    setLoading(true);
    try {
      const newVisit: Visit = await createPatientVisit();
      if (newVisit) {
         onModalClose();
      }
    } catch (error: any) {
      setDisableSubmission(false);
      showAlert('error', error.message ?? 'Error creating visit', '');
    } finally {
      setLoading(false);
    }
  };
  const createPatientVisit = async () => {
    const visitDto = getCreateVisitDto();
    if (!isValidCreateVisitDto(visitDto)) {
      return false;
    }

    const result = await createVisit(visitDto);
    if (result) {
      showAlert('success', 'Visit has been created succesfully', '');
      return result;
    } else {
      showAlert('error', 'Error creating patient visit', '');
      throw new Error('Error creating patient visit');
    }
  };
    const isValidCreateVisitDto = (createVisitDto: CreateVisitDto): boolean => {
    if (!createVisitDto.location) {
      showAlert('error', 'Missing location in create visits', '');
      return false;
    }
    if (!createVisitDto.patient) {
      showAlert('error', 'Please select a patient', '');
      return false;
    }

    if (!createVisitDto.visitType) {
      showAlert('error', 'Please select a visit', '');
      return false;
    }
    if(!selectedPatientType){
      showAlert('error', 'Please select a patient type', '');
      return false;
    }
    return true;
  };
   const getCreateVisitDto = (): CreateVisitDto => {
    const visitAttributes = getVisitAttributes();
    const visitDto: CreateVisitDto = {
      visitType: selectedVisitType ?? '',
      location: locationUuid ?? '',
      startDatetime: null,
      stopDatetime: null,
      patient: amrsPatient?.uuid ?? '',
    };
    if (visitAttributes.length > 0) {
      visitDto['attributes'] = visitAttributes;
    }
    return visitDto;
  };
   function getVisitAttributes(): VisitAttribute[] {
    const attributes: VisitAttribute[] = [];
    if(selectedPatientType) {
        attributes.push({
          attributeType: 'fbc0702d-b4c9-4968-be63-af8ad3ad6239',
          value: selectedPatientType,
        });
    }
    return attributes;
  }
  const visitTypeOptions = useMemo(
    () => [
      {
        text: 'OPD',
        id: VisitTypeUuids.OPD_VISIT_TYPE_UUID,
      },
      {
        text: 'Inpatient',
        id: VisitTypeUuids.INPATIENT_VISIT_TYPE_UUID,
      },
    ],
    [client],
  );
  function dummyFunction(){

  }
  return <>
  <Modal
        open={open}
        size="md"
        modalHeading='Start Patient Visit'
        onSecondarySubmit={() => onModalClose({ success: false })}
        onRequestClose={() => onModalClose({ success: false })}
        onRequestSubmit={loading ? dummyFunction : startPatientVisit}
        primaryButtonText={'Start Visit'}
        secondaryButtonText="Cancel"
          >
            <ModalBody>
                <div className={styles.clientDetailsLayout}>
                 <div className={styles.sectionContent}>
                  {
                    amrsPatient ? (<>
                    <div className={styles.formSection}>
                            <div className={styles.formRow}>
                                    <div className={styles.formControl}>
                                        <ComboBox
                                            onChange={patientTypeHandler}
                                            id="patient-type-combobox"
                                            items={patientTypeOptions}
                                            itemToString={(item) => (item ? item.text : '')}
                                            titleText="Patient Type"
                                        />
                                    </div>
                                    <div className={styles.formControl}>
                                        <ComboBox
                                            onChange={visitTypeChangeHandler}
                                            id="visit-type-combobox"
                                            items={visitTypeOptions}
                                            itemToString={(item) => (item ? item.text : '')}
                                            titleText="Visit Type"
                                        />
                                    </div>
                            </div>
                        </div>
                    
                    </>): (<>
                    <div className={styles.actionSection}>
                            {!amrsPatient ? (
                                <>
                                <div className={styles.patientAction}>
                                    <div className={styles.btnContainer}>
                                    <Button kind="primary" onClick={() => onCreateAmrsPatient(client)}>
                                        Automatically Register in AMRS
                                    </Button>
                                    </div>
                                    <div className={styles.btnContainer}>
                                    <Button kind="secondary" onClick={onManualRegistration}>
                                        Manually Register
                                    </Button>
                                    </div>
                                </div>
                                </>
                            ) : (
                                <></>
                            )}
                        </div>
                    </>)
                  }
                       
                        
                 </div>
                </div>

            </ModalBody>
        </Modal>
  </>
}
export default StartPatientVisitModal;