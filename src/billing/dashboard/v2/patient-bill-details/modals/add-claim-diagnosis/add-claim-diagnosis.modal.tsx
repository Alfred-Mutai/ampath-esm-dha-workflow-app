import React, { useState } from "react";
import styles from './add-claim-diagnosis.modal.scss';
import { type AmrsVisitDiagnosis } from "../../../../../types";
import { Modal, ModalBody, TextInput } from "@carbon/react";
import { showSnackbar } from "@openmrs/esm-framework";
import { addClaimDiagnosis } from "../../../../../billing-claims.resource";
import { type AddClaimDiagnosisDto } from "../../../types";
interface addClaimDiagnosisModal {
     open: boolean;
     onClose: () => void;
     onSuccess: () => void;
     amrsVisitDiagnosis: AmrsVisitDiagnosis;
     interventionCode: string;
     consentToken: string;
     locationUuid: string;
}
const AddClaimDiagnosisModal:React.FC<addClaimDiagnosisModal> = ({open,onClose,onSuccess,amrsVisitDiagnosis,interventionCode,consentToken,locationUuid})=>{
    const [loading,setLoading] = useState<boolean>(false);
  async function handleAddClaimDiagnosis() {
    setLoading(true);
    const addClaimDiagnosisDto = getClaimDiagnosisDto();
    try{
        const resp = await addClaimDiagnosis(addClaimDiagnosisDto);
        if(resp['error']){
           showSnackbar({
             title: resp['error'] ?? 'Error Adding Claim Diagnosis',
             kind: 'error',
             subtitle: resp['message'] ?? 'An error occurred while adding the claim disgnosis. Kindy retry or contact support'
           })
           onSuccess();
        }else{
             showSnackbar({
             title: 'Sucess Adding Claim Diagnosis',
             kind: 'success',
             subtitle: 'Claim Item added successfully'
           });
           onSuccess();
        }
    }catch(error){
       showSnackbar({
        kind: 'error',
        title: 'Error Adding Claim Diagnosis',
        subtitle: 'An error occurred while adding the Claim Diagnosis. Kindy retry or contact support'
       });
    }finally{
        setLoading(false);
    }
  }
  function getClaimDiagnosisDto(): AddClaimDiagnosisDto {
    return {
      consentToken: consentToken,
      interventionCode: interventionCode,
      locationUuid: locationUuid,
      icdCode: amrsVisitDiagnosis.icd11_code,
      practitionerIdentificationNumber: amrsVisitDiagnosis.practioner_nat_id,
      practitionerIdentificationType: amrsVisitDiagnosis.practitioner_identifier_type,
      practitionerRegulationBody: amrsVisitDiagnosis.practitioner_body
    };
  }
  function holderFunction(){
    return;
  }
  return (
    <>
      <Modal
        modalHeading="Add Claim Diagnosis"
        open={open}
        size="md"
        onSecondarySubmit={onClose}
        onRequestClose={onClose}
        onRequestSubmit={loading ? holderFunction : handleAddClaimDiagnosis}
        primaryButtonText={loading ? 'Adding...': 'Add'}
        secondaryButtonText="Close"
      >
        <ModalBody>
          <div className={styles.addClaimDiagnosisModalLayout}>
            <div className={styles.addClaimDiagnosisModalRow}>
              <TextInput
                id="intervention-code"
                labelText="Intervention Code"
                value={interventionCode}
                readOnly={true}
              />
            </div>
            <div className={styles.addClaimDiagnosisModalRow}>
              <TextInput
                id="icd11Code"
                labelText="ICD11 Diagnosis"
                value={amrsVisitDiagnosis.icd11_code}
                readOnly={true}
              />
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}
export default AddClaimDiagnosisModal;