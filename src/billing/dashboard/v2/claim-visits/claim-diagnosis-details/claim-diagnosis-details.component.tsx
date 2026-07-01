import React from "react";
import { type VisitDiagnosis} from "../../types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import { formatDate, parseDate } from '@openmrs/esm-framework';

interface claimDiagnosisDetailsProps {
    claimDiagnosiss: VisitDiagnosis[]
}
const ClaimDiagnosisDetails: React.FC<claimDiagnosisDetailsProps> = ({claimDiagnosiss})=>{
   if(!claimDiagnosiss || claimDiagnosiss.length === 0){
      return <>No Diagnosis data</>
   }
   return <>
   <Table>
          <TableHead>
            <TableRow>
              <TableHeader>No</TableHeader>
              <TableHeader>Recorded On</TableHeader>
              <TableHeader>Diagnosis Name</TableHeader>
              <TableHeader>Diagnosis Code</TableHeader>
              <TableHeader>Intervention Code</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {claimDiagnosiss &&
              claimDiagnosiss.map((cd, index) => {
                return (
                  <>
                    <TableRow key={cd.claim}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{formatDate(parseDate(cd.recorded_on))}</TableCell>
                      <TableCell>{cd.diagnosis_name}</TableCell>
                      <TableCell>{cd.diagnosis_code}</TableCell>
                      <TableCell>{cd.intervention_code}</TableCell>
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>
   </>
};

export default ClaimDiagnosisDetails;