import React from "react";
import { type VisitIntervention } from "../../types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from "@carbon/react";

interface claimInterventionDetailsProps {
    claimInterventions: VisitIntervention[]
}
const ClaimInterventionDetails: React.FC<claimInterventionDetailsProps> = ({claimInterventions})=>{
   if(!claimInterventions || claimInterventions.length === 0){
      return <>No Intervention data</>
   }
   function formatPreAuthText(preAuth:boolean){
     if(preAuth){
        return 'YES';
     }
     return 'NO';
   }
   return <>
   <Table>
          <TableHead>
            <TableRow>
              <TableHeader>No</TableHeader>
              <TableHeader>Code</TableHeader>
              <TableHeader>Payment Mechanism</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Documents required</TableHeader>
              <TableHeader>Keph Level Tarrif</TableHeader>
              <TableHeader>Accrued Per Diem</TableHeader>
              <TableHeader>Accrued Per Diem Days</TableHeader>
              <TableHeader>State</TableHeader>
              <TableHeader>Scheme</TableHeader>
              <TableHeader>Sub Benefit Code</TableHeader>
              <TableHeader>Active For UHC</TableHeader>
              <TableHeader>Fund</TableHeader>
              <TableHeader>Surgical Preauth</TableHeader>
              <TableHeader>Renal Preauth</TableHeader>
              <TableHeader>Oncology Preauth</TableHeader>
              <TableHeader>Radiology Preauth</TableHeader>
              <TableHeader>Optical Preauth</TableHeader>
              <TableHeader>Needs Preauth</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {claimInterventions &&
              claimInterventions.map((ci, index) => {
                return (
                  <>
                    <TableRow key={ci.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{ci.intervention_code}</TableCell>
                      <TableCell>{ci.intervention_payment_mechanism}</TableCell>
                      <TableCell>{ci.intervention_name}</TableCell>
                      <TableCell>{
                        ci.applicable_document_types.map((dt)=>{
                          return<>
                          <Tag
                              size="md"
                              title="Clear filter"
                              type="green"
                            >
                              {dt}
                            </Tag>
                            </>
                        })
                        }</TableCell>
                      <TableCell>{ci.keph_level_tarrif}</TableCell>
                      <TableCell>{ci.accrued_per_diem_amount}</TableCell>
                      <TableCell>{ci.accrued_per_diem_days}</TableCell>
                      <TableCell>{ci.workflow_state}</TableCell>
                      <TableCell>{ci.supported_scheme}</TableCell>
                      <TableCell>{ci.sub_benefit_code}</TableCell>
                      <TableCell>{ci.active_for_uhc}</TableCell>
                      <TableCell>{ci.intervention_fund}</TableCell>
                      <TableCell>{formatPreAuthText(ci.requires_surgical_preauth)}</TableCell>
                      <TableCell>{formatPreAuthText(ci.requires_renal_preauth)}</TableCell>
                      <TableCell>{formatPreAuthText(ci.requires_oncology_preauth)}</TableCell>
                      <TableCell>{formatPreAuthText(ci.requires_radiology_preauth)}</TableCell>
                      <TableCell>{formatPreAuthText(ci.requires_optical_preauth)}</TableCell>
                      <TableCell>{formatPreAuthText(ci.needs_preauth)}</TableCell>
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>
   </>
};

export default ClaimInterventionDetails;