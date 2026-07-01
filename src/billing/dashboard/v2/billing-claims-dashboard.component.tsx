import React, { useState } from 'react';
import styles from './billing-claims-dashboard.component.scss';
import { DatePicker, DatePickerInput, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityBills from './facility-bills/facility-bills.component';
import ClaimVisits from './claim-visits/claim-visits.component';
import { useSession } from '@openmrs/esm-framework';
interface billingClaimsDashboardProps {}
const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const [billingDate, setBillingDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const handleDateChange = (dateSelected: Date[]) => {
    const selectedDate = new Date(dateSelected[0]).toLocaleDateString('en-CA');
    setBillingDate(selectedDate);
  };
  return (
    <>
      <div className={styles.bcLayout}>
        <div className={styles.bcHeader}>
          <div className={styles.bcHeaderTitle}>
            <h4>Billing and Claims Dashboard</h4>
          </div>
          <div className={styles.bcHeaderStats}></div>
        </div>
        <div className={styles.bcContent}>
          <div className={styles.bcContentFilters}>
            <DatePicker
              datePickerType="single"
              locale="en"
              onChange={handleDateChange}
              onClose={() => {}}
              onOpen={() => {}}
            >
              <DatePickerInput id="date-picker-single" labelText="Date" placeholder="mm/dd/yyyy" />
            </DatePicker>
          </div>
          <div className={styles.bcContentTabs}>
            <Tabs>
              <TabList scrollDebounceWait={200}>
                <Tab>Bills</Tab>
                <Tab>Claims</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <FacilityBills locationUuid={locationUuid} billingDate={billingDate} />
                </TabPanel>
                <TabPanel>
                  <ClaimVisits locationUuid={locationUuid} billingDate={billingDate} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
};

export default BillingClaimsDashboard;
