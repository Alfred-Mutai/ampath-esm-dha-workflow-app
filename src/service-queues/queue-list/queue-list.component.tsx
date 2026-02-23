import {
  Button,
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
import { getTagTypeByPriority } from '../../shared/utils/get-tag-type';
import { useSession } from '@openmrs/esm-framework';
import { checkInRoom, checkOutRoom, isCheckedIn } from './check-in.service';

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

  const [searchString, setSearchString] = useState<string>();
  const urgentEntries = useMemo(
    () => sortQueueByPriorityAndWaitTime(queueEntries, QueueEntryPriority.Emergency),
    [queueEntries],
  );
  const normalEntries = useMemo(
    () => sortQueueByPriorityAndWaitTime(queueEntries, QueueEntryPriority.Normal),
    [queueEntries],
  );
  const sortedQueueEntries = useMemo(() => generatePatientWaitingList(), [queueEntries]);
  const filteredQueueEntries = useMemo(() => filterQueueBySearchString(), [queueEntries, searchString]);
  function generatePatientWaitingList() {
    return [...urgentEntries, ...normalEntries];
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
  return (
    <>
      <div className={styles.queueListLayout}>
        <div className={styles.actionHeader}>
          <>
            <div className={styles.searchInput}>
              <TextInput
                id="queue-search"
                labelText=""
                onChange={(e) => handlQueueSearch(e.target.value)}
                placeholder="Enter patient name to filter"
              />
            </div>
            {checkIn ? (
              <>
                <Button kind="secondary" onClick={handleCheckout}>
                  Check Out
                </Button>
                {sortedQueueEntries.length > 0 ? (
                  <>
                    <Button kind="danger" onClick={clearQueue}>
                      Clear Queue
                    </Button>
                  </>
                ) : (
                  <></>
                )}
              </>
            ) : (
              <>
                <Button kind="primary" onClick={handleCheckin}>
                  Check In
                </Button>
              </>
            )}
          </>
        </div>
        <div className={styles.tableSection}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Name</TableHeader>
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
                    {checkIn && val.status !== QueueEntryStatus.Waiting ? (
                      <Link href={`${window.spaBase}/patient/${val.patient_uuid}/chart/`}>
                        {formatPatientName(val)}
                      </Link>
                    ) : (
                      <>{formatPatientName(val)}</>
                    )}
                  </TableCell>
                  <TableCell>{showComingFromCol ? val.queue_coming_from : ''}</TableCell>
                  <TableCell>{val.queue_entry_id}</TableCell>
                  <TableCell>
                    <Tag size="md" type={getTagTypeByStatus(val.status)}>
                      {val.status}
                    </Tag>
                  </TableCell>
                  <TableCell>
                    <Tag size="md" type={getTagTypeByPriority(val.priority)}>
                      {val.priority}
                    </Tag>
                  </TableCell>
                  <TableCell>{`${val.wait_time_in_min} minute(s)`}</TableCell>
                  <TableCell>
                    {val.status === QueueEntryStatus.Waiting ? (
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
