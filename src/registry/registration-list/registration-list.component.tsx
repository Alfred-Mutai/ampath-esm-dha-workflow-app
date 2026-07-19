import React, { useEffect, useState } from 'react';
import styles from './registration-list.component.scss';
import {
  DatePicker,
  DatePickerInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { type RegistrationQueueList } from '../types';
import { getRegistrationQueueList } from '../../service-queues/service-queues.resource';
import { useSession } from '@openmrs/esm-framework';
const RegistrationList: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [endDate, setEndDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [registrationQueueList, setRegistrationQueueList] = useState<RegistrationQueueList[]>([]);
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  useEffect(() => {
    if (startDate && endDate) {
      getRegistrationList();
    }
  }, [startDate, endDate]);
  function handleStartDateChange(dateSelected: Date[]) {
    setStartDate(new Date(dateSelected[0]).toLocaleDateString('en-CA'));
  }
  function handleEndDateChange(dateSelected: Date[]) {
    setEndDate(new Date(dateSelected[0]).toLocaleDateString('en-CA'));
  }
  async function getRegistrationList() {
    const res = await getRegistrationQueueList(locationUuid, startDate, endDate);
    if (res) {
      setRegistrationQueueList(res);
    } else {
      setRegistrationQueueList([]);
    }
  }
  return (
    <>
      <div className={styles.regListLayout}>
        <div className={styles.regListHeaderSection}>
          <div className={styles.regListHeaderTitle}>
            <h4>Registered Patients</h4>
          </div>
          <div className={styles.regListFiltersSection}>
            <div className={styles.filterInput}>
              <DatePicker datePickerType="single" locale="en" onChange={handleStartDateChange}>
                <DatePickerInput
                  id="start-date"
                  labelText="Start Date"
                  onChange={handleStartDateChange}
                  placeholder="mm/dd/yyyy"
                />
              </DatePicker>
            </div>
            <div className={styles.filterInput}>
              <DatePicker datePickerType="single" locale="en" onChange={handleEndDateChange}>
                <DatePickerInput
                  id="end-date"
                  labelText="End Date"
                  onChange={handleEndDateChange}
                  placeholder="mm/dd/yyyy"
                />
              </DatePicker>
            </div>
          </div>
        </div>
        <div className={styles.regListContentSection}>
          <div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Age(Years)</TableHeader>
                  <TableHeader>Phone No</TableHeader>
                  <TableHeader>Reg Date</TableHeader>
                  <TableHeader>Identifiers</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {registrationQueueList.map((l, index) => {
                  return (
                    <TableRow key={l.visit_uuid}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{l.age}</TableCell>
                      <TableCell>{l.phone_number}</TableCell>
                      <TableCell>{l.reg_date}</TableCell>
                      <TableCell>{l.identifiers}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};
export default RegistrationList;
