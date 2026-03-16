import React, { useMemo, useState } from 'react';
import {
  Modal,
  ModalBody,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
} from '@carbon/react';
import styles from './daily-report-patient-list.scss';
import { type ServiceQueueReportPatientList } from '../../../shared/types';

interface DailyReportPatientListModalProps {
  open: boolean;
  onModalClose: () => void;
  patientList: ServiceQueueReportPatientList[];
}

const DailyReportPatientListModal: React.FC<DailyReportPatientListModalProps> = ({
  open,
  onModalClose,
  patientList,
}) => {
  const [searchString, setSearchString] = useState<string>();
  const filteredPatientList = useMemo(() => filterQueueBySearchString(), [patientList, searchString]);

  function filterQueueBySearchString(): ServiceQueueReportPatientList[] {
    if (!searchString) {
      return patientList;
    }
    return patientList.filter((p) => {
      return p.person_name.trim().toLowerCase().includes(searchString.trim().toLowerCase());
    });
  }

  const handlePatientListSearch = (searchTerm: string) => {
    setSearchString(searchTerm);
  };
  return (
    <>
      <Modal
        modalHeading="Checked In Patient List"
        open={open}
        size="lg"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={onModalClose}
        primaryButtonText="Close"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.checkedInlLayout}>
            <div className={styles.actionHeaderSection}>
              <div className={styles.searchInput}>
                <TextInput
                  id="queue-search"
                  labelText=""
                  onChange={(e) => handlePatientListSearch(e.target.value)}
                  placeholder="Enter patient name to filter"
                />
              </div>
            </div>
            <div className={styles.serveModalContentSection}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>No</TableHeader>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Age</TableHeader>
                    <TableHeader>Gender</TableHeader>
                    <TableHeader>Phone Number</TableHeader>
                    <TableHeader>Identifiers</TableHeader>
                    <TableHeader>Queue Room</TableHeader>
                    <TableHeader>Status</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPatientList.map((val, index) => (
                    <TableRow id={`${val.queue_entry_id}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{val.person_name}</TableCell>
                      <TableCell>{val.age}</TableCell>
                      <TableCell>{val.gender}</TableCell>
                      <TableCell>{val.phone_number}</TableCell>
                      <TableCell>{val.identifiers}</TableCell>
                      <TableCell>{val.queue_room_name}</TableCell>
                      <TableCell>
                        <Tag size="md" type={val.served_status === 'SERVED' ? 'blue' : 'gray'}>
                          {val.served_status}
                        </Tag>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default DailyReportPatientListModal;
