import React from "react";
import styles from './facility-worker.component-slot.component.scss';
import { ExtensionSlot } from "@openmrs/esm-framework";
interface facilityAndWorkerSlotProps {}
const FacilityAndWorkerSlot: React.FC<facilityAndWorkerSlotProps> = ()=>{
  return <>
  <div className={styles.fhwrSlotLayout}>
     <div className={styles.fhwrSlotContent}>
          <div className={styles.fhwrSlot}>
              <ExtensionSlot name="facility-hie-header-slot" />
          </div>
          <div className={styles.fhwrSlot}>
              <ExtensionSlot name="health-worker-hie-header-slot" />
          </div>
     </div>
  </div>
  </>
}
export default FacilityAndWorkerSlot;