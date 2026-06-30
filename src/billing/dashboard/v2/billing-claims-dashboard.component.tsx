import React from "react";
import styles from './billing-claims-dashboard.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@carbon/react";
import FacilityBills from "./facility-bills/facility-bills.component";
interface billingClaimsDashboardProps {}
const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = ()=>{
  return <>
    <div className={styles.bcLayout}>
       <div className={styles.bcHeader}>
          <div className={styles.bcHeaderTitle}>
              <h4>Billing and Claims Dashboard</h4>
          </div>
          <div className={styles.bcHeaderStats}>

          </div>
       </div>
       <div className={styles.bcContent}>
           <div className={styles.bcContentFilters}>

           </div>
           <div className={styles.bcContentTabs}>
               <Tabs onTabCloseRequest={function Kbe(){}}>
                  <TabList
                    scrollDebounceWait={200}
                  >
                    <Tab>
                     Bills
                    </Tab>
                    <Tab>
                      Claims
                    </Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <FacilityBills/>
                    </TabPanel>
                    <TabPanel>
                      Claims
                    </TabPanel>
                  </TabPanels>
                </Tabs>
           </div>
       </div>
    </div>
  </>
}

export default BillingClaimsDashboard;