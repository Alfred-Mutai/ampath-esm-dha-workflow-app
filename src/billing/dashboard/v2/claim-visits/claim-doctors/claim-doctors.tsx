import React from "react";
import { type ClaimDoctor } from "../../types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import styles from './claim-doctors.scss';

interface claimDoctorsProps {
    claimDoctors: ClaimDoctor[]
}
const ClaimDoctors: React.FC<claimDoctorsProps> = ({claimDoctors})=>{
   if(!claimDoctors || claimDoctors.length === 0){
      return <>No Claim Doctors</>
   }
   return <>
   <div className={styles.claimDoctorsLayout}>
   <Table>
          <TableHead>
            <TableRow>
              <TableHeader>No</TableHeader>
              <TableHeader>Claim</TableHeader>
              <TableHeader>Doctor Name</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {claimDoctors &&
              claimDoctors.map((cd, index) => {
                return (
                  <>
                    <TableRow key={cd.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{cd.claim}</TableCell>
                      <TableCell>{cd.doctor_name}</TableCell>
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>
        </div>
   </>
};

export default ClaimDoctors;