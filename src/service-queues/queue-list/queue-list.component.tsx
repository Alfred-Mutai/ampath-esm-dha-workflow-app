import {
  Button,
  ComboBox,
  Link,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
} from '@carbon/react';
import { type QueueEntryResult } from '../../registry/types';
import React, { useMemo, useState } from 'react';
import styles from './queue-list.component.scss';
import { QueueEntryPriority, QueueEntryStatus, type TagColor } from '../../types/types';
import { getTagClassByPriority } from '../../shared/utils/get-tag-type';
import { useSession } from '@openmrs/esm-framework';
import { checkInRoom, checkOutRoom, isCheckedIn } from './check-in.service';
import { userHasAccess } from '@openmrs/esm-framework';

interface QueueListProps {
  queueRoom: string;
  queueEntries: QueueEntryResult[];
  handleMovePatient: (queueEntryResult: QueueEntryResult) => void;
  handleTransitionPatient: (queueEntryResult: QueueEntryResult) => void;
  handleServePatient: (queueEntryResult: QueueEntryResult) => void;
  handleSignOff: (queueEntryResult: QueueEntryResult) => void;
  handleRemovePatient: (queueEntryResult: QueueEntryResult) => void;
  showComingFromCol: boolean;
  handleClearQueue: (queueEntryResults: QueueEntryResult[]) => void;
}

const QueueList: React.FC<QueueListProps> = ({
  queueRoom,
  queueEntries,
  handleMovePatient,
  handleTransitionPatient,
  handleServePatient,
  handleSignOff,
  handleRemovePatient,
  showComingFromCol,
  handleClearQueue,
}) => {
  const session = useSession();
  const provider = session.currentProvider;
  const [checkIn, setCheckin] = useState<boolean>(isProviderCheckedIn());
  const [selectedStatus,setSelectedStatus] = useState<string>('');

  const [searchString, setSearchString] = useState<string>();
  const urgentEntries = useMemo(
    () => sortQueueByPriorityAndWaitTime(queueEntries, QueueEntryPriority.Emergency),
    [queueEntries],
  );
  const priorityEntries = useMemo(
    () => sortQueueByPriorityAndWaitTime(queueEntries, QueueEntryPriority.Priority),
    [queueEntries],
  );

  const nonUrgentEntries = useMemo(
    () => sortQueueByPriorityAndWaitTime(queueEntries, QueueEntryPriority.NonUrgent),
    [queueEntries],
  );
  const sortedQueueEntries = useMemo(() => generatePatientWaitingList(), [queueEntries,selectedStatus]);
  const filteredQueueEntries = useMemo(() => filterQueueBySearchString(), [queueEntries, searchString,selectedStatus]);
  const canClearQueue = userHasAccess('O3 Clear Triage Queue',{
    privileges: session.user?.privileges ?? [],
    roles: session.user?.roles ?? []
  });
  const statusOptions = [
        {
          text: 'ALL',
          id: '',
        },
        {
          text: 'IN SERVICE',
          id: 'IN SERVICE',
        },
        {
          text: 'WAITING',
          id: 'WAITING',
        },
  ];
  function generatePatientWaitingList() {
    return [...urgentEntries, ...priorityEntries, ...nonUrgentEntries].filter((qe)=>{
       if(!selectedStatus){
          return true;
       }
       return qe.status === selectedStatus;
    });
  }

  function sortQueueByPriorityAndWaitTime(queueEntries: QueueEntryResult[], priority: QueueEntryPriority) {
    return queueEntries
      .filter((q) => {
        return q.priority === priority;
      })
      .sort((a, b) => {
        return b.wait_time_in_min - a.wait_time_in_min;
      });
  }
  function isProviderCheckedIn() {
    return isCheckedIn(provider.uuid, queueRoom);
  }
  const handleCheckin = () => {
    checkInRoom(provider.uuid, queueRoom);
    setCheckin(isProviderCheckedIn());
  };
  const handleCheckout = () => {
    checkOutRoom();
    setCheckin(isProviderCheckedIn());
  };
  const getTagTypeByStatus = (status: string): TagColor => {
    let type: TagColor;
    switch (status) {
      case QueueEntryStatus.Completed:
        type = 'green';
        break;
      case QueueEntryStatus.Waiting:
        type = 'gray';
        break;
      case QueueEntryStatus.InService:
        type = 'blue';
        break;
      default:
        type = 'gray';
    }
    return type;
  };
  const clearQueue = () => {
    handleClearQueue(sortedQueueEntries);
  };
  const handlQueueSearch = (searchTerm: string) => {
    setSearchString(searchTerm);
  };
  function filterQueueBySearchString(): QueueEntryResult[] {
    if (!searchString) {
      return sortedQueueEntries;
    }
    return sortedQueueEntries.filter((qe) => {
      const fullName = `${qe.family_name} ${qe.middle_name} ${qe.given_name}`;
      return fullName.trim().toLowerCase().includes(searchString.trim().toLowerCase());
    });
  }
  function formatPatientName(qe: QueueEntryResult) {
    return `${formatName(qe.family_name)} ${formatName(qe.middle_name)} ${formatName(qe.given_name)}`;
  }
  function formatName(name: string) {
    if (name === 'NULL' || !name) {
      return '';
    } else {
      return name;
    }
  }
  function statusChangeHandler(selectedStatus: { selectedItem: { id: string; text: string } }){
    let status = '';
    if(selectedStatus && selectedStatus.selectedItem){
        status = selectedStatus.selectedItem.id;
    }
    
    setSelectedStatus(status);
  }
  return (
    <>
      <div className={styles.queueListLayout}>
        <div className={styles.actionHeader}>
          <div className={styles.filters}>
           <div className={styles.filter}>
              <ComboBox
                        onChange={statusChangeHandler}
                        id="queue-status-combobox"
                        items={statusOptions}
                        itemToString={(item) => (item ? item.text : '')}
                        titleText="Status"
                />
            </div>
           <div className={styles.filter}>
              <TextInput
                id="queue-search"
                labelText="Name"
                onChange={(e) => handlQueueSearch(e.target.value)}
                placeholder="Enter patient name to filter"
              />
            </div>
           
          </div>
          <div className={styles.actionBtns}>
            
            {checkIn ? (
              <>
                <div>
                <Button kind="secondary" onClick={handleCheckout}>
                  Check Out
                </Button>
                </div>
                {sortedQueueEntries.length > 0 ? (
                  <>
                  <div>
                    <Button kind="danger" onClick={clearQueue} disabled={!canClearQueue}>
                      Clear Queue
                    </Button>
                  </div>
                  </>
                ) : (
                  <></>
                )}
              </>
            ) : (
              <>
              <div>
                <Button kind="primary" onClick={handleCheckin}>
                  Check In
                </Button>
              </div>
              </>
            )}
          </div>
        </div>
        <div className={styles.tableSection}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader>Age</TableHeader>
                <TableHeader>Phone Number</TableHeader>
                <TableHeader>Identifiers</TableHeader>
                <TableHeader>Coming From</TableHeader>
                <TableHeader>Ticket</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Priority</TableHeader>
                <TableHeader>Wait Time</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredQueueEntries.map((val, index) => (
                <TableRow id={val.queue_entry_uuid}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <div className={val.hide_in_queue === 1? styles.flaggedPatient: styles.unflaggedPatient}>
                    {checkIn && val.status !== QueueEntryStatus.Waiting ? (
                      <Link href={`${window.spaBase}/patient/${val.patient_uuid}/chart/`}>
                        {formatPatientName(val)}
                      </Link>
                    ) : (
                      <>{formatPatientName(val)}</>
                    )}
                    </div>
                  </TableCell>
                  <TableCell>{val.age ?? ''}</TableCell>
                  <TableCell>{val.phone_number ?? ''}</TableCell>
                  <TableCell>{val.identifiers ?? ''}</TableCell>
                  <TableCell>{showComingFromCol ? val.queue_coming_from : ''}</TableCell>
                  <TableCell>{val.queue_entry_id}</TableCell>
                  <TableCell>
                    <Tag size="md" type={getTagTypeByStatus(val.status)}>
                      {val.status}
                    </Tag>
                  </TableCell>
                  <TableCell>
                    <Tag size="md" className={styles[getTagClassByPriority(val.priority)]}>
                      {val.priority}
                    </Tag>
                  </TableCell>
                  <TableCell>{`${val.wait_time_in_min} minute(s)`}</TableCell>
                  {
                     val.hide_in_queue === 0 ? (<>
                      <TableCell>
                    {val.status === QueueEntryStatus.Waiting && val.hide_in_queue === 0 ? (
                      <>
                        <Button kind="ghost" disabled={!checkIn} onClick={() => handleServePatient(val)}>
                          Serve
                        </Button>
                      </>
                    ) : (
                      <>
                        {checkIn ? (
                          <>
                            <OverflowMenu aria-label="overflow-menu">
                              <OverflowMenuItem itemText="Transfer" onClick={() => handleMovePatient(val)} />
                              <OverflowMenuItem itemText="Transition" onClick={() => handleTransitionPatient(val)} />
                              <OverflowMenuItem itemText="Sign Off" onClick={() => handleSignOff(val)} />
                              <OverflowMenuItem itemText="Remove Patient" onClick={() => handleRemovePatient(val)} />
                            </OverflowMenu>
                          </>
                        ) : (
                          <></>
                        )}
                      </>
                    )}
                  </TableCell>
                     </>): (<>
                      <TableCell></TableCell>
                     </>)
                  }
                 
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
};

export default QueueList;
