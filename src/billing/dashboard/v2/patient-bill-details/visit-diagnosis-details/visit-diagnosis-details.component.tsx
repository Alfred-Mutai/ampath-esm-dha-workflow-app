import React, { useState } from "react";
import styles from './visit-diagnosis-details.component.scss';
import { type AmrsVisitDiagnosis } from "../../../../types";
import { OverflowMenu, OverflowMenuItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import { formatDate, parseDate } from "@openmrs/esm-framework";
import AddClaimDiagnosisModal from "../modals/add-claim-diagnosis/add-claim-diagnosis.modal";

interface visitDiagnosisDetailsProps {
    amrsVisitDiagnosis: AmrsVisitDiagnosis[];
    consentToken: string;
    interventionCode: string;
    locationUuid: string;
}
const VisitDiagnosisDetails: React.FC<visitDiagnosisDetailsProps> = ({amrsVisitDiagnosis,consentToken,interventionCode,locationUuid})=>{
  const [selectedAmrsDiagnosis,setSelectedAmrsDiagnosis] = useState<AmrsVisitDiagnosis | null>(null);
  const [showAddClaimDiagnosisModal,setShowAddClaimDiagnosisModal] = useState<boolean>(false);

  function handleCloseModal(){
      setShowAddClaimDiagnosisModal(false);
  }
  function handleDiagnosisSelection(amrsVisitDiagnosis: AmrsVisitDiagnosis){
    setSelectedAmrsDiagnosis(amrsVisitDiagnosis);
    setShowAddClaimDiagnosisModal(true);
  }
  return <>
  <div>
     <Table aria-label="sample table" size="lg">
                  <TableHead>
                    <TableRow>
                      <TableHeader>No</TableHeader>
                      <TableHeader>Encounter Date</TableHeader>
                      <TableHeader>Encounter Type</TableHeader>
                      <TableHeader>ICD11 Diagnosis</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {amrsVisitDiagnosis &&
                      amrsVisitDiagnosis.map((d, index) => {
                        return (
                          <>
                            <TableRow key={d.encounter_id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{formatDate(parseDate(d.encounter_datetime))}</TableCell>
                              <TableCell>{d.encounter_type}</TableCell>
                              <TableCell>{d.icd11_code}</TableCell>
                              <TableCell>
                                <OverflowMenu aria-label="overflow-menu">
                                      <OverflowMenuItem itemText="Add Claim Diagnosis" onClick={() => handleDiagnosisSelection(d)} />
                              </OverflowMenu>
                              </TableCell>
                            </TableRow>
                          </>
                        );
                      })}
                  </TableBody>
        </Table>

        {
            (showAddClaimDiagnosisModal && selectedAmrsDiagnosis) && 
            <AddClaimDiagnosisModal 
            consentToken={consentToken}
            amrsVisitDiagnosis={selectedAmrsDiagnosis}
            locationUuid={locationUuid}
            interventionCode={interventionCode}
            open={showAddClaimDiagnosisModal}
            onClose={handleCloseModal}
            onSuccess={handleCloseModal}
            />
        }
  </div>
  </>
}
export default VisitDiagnosisDetails;