import React, { useEffect, useMemo, useState } from 'react';
import { type QueueEntryResult } from '../../registry/types';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import {
  closeQueueEntry,
  getServiceQueueByLocationUuid,
  getServiceQueueDailyPatientListReport,
  getServiceQueueDailyReport,
} from '../service-queues.resource';
import { Button, InlineLoading, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import QueueList from '../queue-list/queue-list.component';
import styles from './service-queue.component.scss';
import MovePatientModal from '../modals/move/move-patient.component';
import TransitionPatientModal from '../modals/transition/transition-patient.component';
import ServePatientModal from '../modals/serve/serve-patient.comppnent';
import StatDetails from './stats/stat-details/stat-details.component';
import SignOffEntryModal from '../modals/sign-off/sign-off.modal';
import { endVisit } from '../../resources/visit.resource';
import { QUEUE_SERVICE_UUIDS } from '../../shared/constants/concepts';
import ConfirmModal from '../../shared/ui/confirm-modal/confirm.modal';
import { type ServiceQueueReportPatientList, type ServiceQueueDailyReport } from '../../shared/types';
import DailyReportPatientListModal from '../modals/daily-report-patient-list/daily-report-patient-list';

interface ServiceQueueComponentProps {
  serviceTypeUuid: string;
  title: string;
}

const ServiceQueueComponent: React.FC<ServiceQueueComponentProps> = ({ serviceTypeUuid, title }) => {
  const [queueEntries, setQueueEntries] = useState<QueueEntryResult[]>([]);
  const [queueEntryDailyReport, setQueueEntryDailyReport] = useState<ServiceQueueDailyReport[]>([]);
  const [queueEntryDailyReportPatientList, setQueueEntryDailyReportPatientList] = useState<
    ServiceQueueReportPatientList[]
  >([]);
  const [selectedQueueEntry, setSelectedQueueEntry] = useState<QueueEntryResult>();
  const [displayMoveModal, setDisplayMoveModal] = useState<boolean>(false);
  const [displayTransitionModal, setDisplayTransitionModal] = useState<boolean>(false);
  const [displayServeModal, setDisplayServeModal] = useState<boolean>(false);
  const [displaySignOffModal, setDisplaySignOffModal] = useState<boolean>(false);
  const [displayConfirmClearQueueModal, setDisplayConfirmClearQueueModal] = useState<boolean>(false);
  const [queueEntryToClear, setQueueEntryToClear] = useState<QueueEntryResult[]>();
  const [displayDailyReportPatientListModal, setDisplayDailyReportPatientListModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;

  const groupEntriesByRooms = () => {
    const roomEntries = {};
    if (!queueEntries || queueEntries.length === 0) return {};
    queueEntries.forEach((qe) => {
      const room = qe.queue_room;
      if (!roomEntries[room]) {
        roomEntries[room] = [qe];
      } else {
        roomEntries[room].push(qe);
      }
    });
    return roomEntries;
  };

  const groupedByRoom: { [key: string]: QueueEntryResult[] } = useMemo(() => groupEntriesByRooms(), [queueEntries]);

  useEffect(() => {
    if (serviceTypeUuid && locationUuid) {
      getEntryQueues();
      getEntryQueueDailyReport();
      fetchStatsPatientList();
    }
  }, [serviceTypeUuid, locationUuid]);



  const getEntryQueues = async () => {
    setLoading(true);
    try {
      const res = await getServiceQueueByLocationUuid(serviceTypeUuid, locationUuid);
      setQueueEntries(res);
      setLoading(false);
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching queue',
        subtitle: 'An error occurred while fetching the queue. Please reload or contact support',
      });
    }
  };

  const getEntryQueueDailyReport = async () => {
    setLoading(true);
    try {
      const res = await getServiceQueueDailyReport(serviceTypeUuid, locationUuid);
      setQueueEntryDailyReport(res);
      setLoading(false);
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching queue daily report',
        subtitle: 'An error occurred while fetching the queue daily report. Please reload or contact support',
      });
    }
  };

  if (!groupedByRoom) {
    return <>No Data to Display</>;
  }
  const handleMovePatient = (queueEntry: QueueEntryResult) => {
    setDisplayMoveModal(true);
    setSelectedQueueEntry(queueEntry);
  };
  const handleModalCloes = () => {
    setDisplayMoveModal(false);
    setDisplayTransitionModal(false);
    setDisplayServeModal(false);
    handleRefresh();
  };

  const handleTransitionPatient = (queueEntry: QueueEntryResult) => {
    setDisplayTransitionModal(true);
    setSelectedQueueEntry(queueEntry);
  };

  const handleServePatient = (queueEntry: QueueEntryResult) => {
    setDisplayServeModal(true);
    setSelectedQueueEntry(queueEntry);
  };

  const navigateToPatientChart = () => {
    if (selectedQueueEntry && selectedQueueEntry.patient_uuid) {
      window.location.href = `${window.spaBase}/patient/${selectedQueueEntry.patient_uuid}/chart`;
    }
  };

  const handleSuccessfullServe = () => {
    handleModalCloes();
    navigateToPatientChart();
  };

  const handleSignOff = (queueEntry: QueueEntryResult) => {
    setDisplaySignOffModal(true);
    setSelectedQueueEntry(queueEntry);
  };

  const onSuccessfullSignOff = () => {
    setDisplaySignOffModal(false);
    handleRefresh();
  };

  const handleRefresh = () => {
    getEntryQueues();
  };

  const handleRemovePatient = async (queueEntryResult: QueueEntryResult) => {
    try {
      await closeQueueEntry(queueEntryResult.queue_entry_uuid);
      showSnackbar({
        kind: 'success',
        title: 'Patient removal from queue successfully!',
        subtitle: '',
      });
      await endVisit(queueEntryResult.visit_uuid, {
        stopDatetime: new Date().toISOString(),
      });
      showSnackbar({
        kind: 'success',
        title: 'Visit Ended successfully!',
        subtitle: '',
      });
      handleRefresh();
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: 'Patient removal from queue failed!',
        subtitle: e.message ?? '',
      });
    }
  };
  const handleClearQueue = async (queueEntries: QueueEntryResult[]) => {
    setQueueEntryToClear(queueEntries);
    setDisplayConfirmClearQueueModal(true);
  };

  const clearQueue = async () => {
    for (let i = 0; i < queueEntryToClear.length; i++) {
      const queueEntryResult = queueEntries[i];
      await closeQueue(queueEntryResult);
    }
  };

  const closeQueue = async (queueEntryResult: QueueEntryResult) => {
    try {
      await closeQueueEntry(queueEntryResult.queue_entry_uuid);
      await endVisit(queueEntryResult.visit_uuid, {
        stopDatetime: new Date().toISOString(),
      });
      showSnackbar({
        kind: 'success',
        title: 'Queue entry successfully closed',
        subtitle: `Queue entry ${queueEntryResult.queue_id} successfully closed`,
      });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Queue entry close failrure',
        subtitle: `Queue entry ${queueEntryResult.queue_id} could not be closed. Please retry of contact support`,
      });
    }
  };

  const handleConfirmClearQueue = () => {
    setDisplayConfirmClearQueueModal(false);
    clearQueue();
    setQueueEntryToClear([]);
    handleRefresh();
  };

  const handleCloseConfirmClearQueueModal = () => {
    setDisplayConfirmClearQueueModal(false);
    setQueueEntryToClear([]);
  };

  const fetchStatsPatientList = async () => {
    try {
      const resp = await getServiceQueueDailyPatientListReport(serviceTypeUuid, locationUuid);
      setQueueEntryDailyReportPatientList(resp);
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching patient list',
        subtitle: 'An error ocuured while fetching the service queue checked in patient list',
      });
    }
  };

  const getStatsPatientList = () => {
    showDailiyReportPatientListModal();
  };
  const handleCloseDailiyReportPatientListModal = () => {
    setDisplayDailyReportPatientListModal(false);
  };
  const showDailiyReportPatientListModal = () => {
    setDisplayDailyReportPatientListModal(true);
  };

  if (!serviceTypeUuid) {
    return <>No service type defined</>;
  }

  return (
    <>
      <div className={styles.consultationLayout}>
        <div className={styles.headerSection}>
          <h4>{title}</h4>
        </div>
        <div>
          {queueEntries ? (
            <>
              <StatDetails
                queueEntries={queueEntries}
                report={queueEntryDailyReport}
                onStatDetailsRequest={getStatsPatientList}
              />
            </>
          ) : (
            <></>
          )}
        </div>
        <div className={styles.headerAction}>
          <Button kind="tertiary" onClick={handleRefresh} disabled={loading}>
            {loading ? <InlineLoading description="Refreshing..." /> : 'Refresh'}
          </Button>
        </div>

        <div className={styles.contentSection}>
          <Tabs>
            <TabList contained>
              {groupedByRoom &&
                Object.keys(groupedByRoom).map((key) => {
                  return <Tab>{key}</Tab>;
                })}
            </TabList>
            <TabPanels>
              {groupedByRoom &&
                Object.keys(groupedByRoom).map((key) => {
                  return (
                    <TabPanel>
                      {
                        <QueueList
                          queueRoom={key}
                          queueEntries={groupedByRoom[key]}
                          handleMovePatient={handleMovePatient}
                          handleTransitionPatient={handleTransitionPatient}
                          handleServePatient={handleServePatient}
                          handleSignOff={handleSignOff}
                          handleRemovePatient={handleRemovePatient}
                          showComingFromCol={serviceTypeUuid !== QUEUE_SERVICE_UUIDS.TRIAGE_SERVICE_UUID}
                          handleClearQueue={handleClearQueue}
                        />
                      }
                    </TabPanel>
                  );
                })}
            </TabPanels>
          </Tabs>
        </div>
      </div>
      {displayMoveModal && selectedQueueEntry ? (
        <>
          <MovePatientModal
            open={displayMoveModal}
            locationUuid={locationUuid}
            onModalClose={handleModalCloes}
            currentQueueEntryUuid={selectedQueueEntry.queue_entry_uuid}
            onTransferSuccess={handleModalCloes}
          />
        </>
      ) : (
        <></>
      )}

      {displayTransitionModal ? (
        <>
          <TransitionPatientModal
            open={displayTransitionModal}
            onModalClose={handleModalCloes}
            currentQueueEntry={selectedQueueEntry}
          />
        </>
      ) : (
        <></>
      )}

      {displayServeModal ? (
        <>
          <ServePatientModal
            open={displayServeModal}
            onModalClose={handleModalCloes}
            currentQueueEntry={selectedQueueEntry}
            onSuccessfullServe={handleSuccessfullServe}
          />
        </>
      ) : (
        <></>
      )}

      {displaySignOffModal ? (
        <>
          <SignOffEntryModal
            open={displaySignOffModal}
            onModalClose={handleModalCloes}
            currentQueueEntry={selectedQueueEntry}
            onSuccessfullSignOff={onSuccessfullSignOff}
          />
        </>
      ) : (
        <></>
      )}

      {displayConfirmClearQueueModal ? (
        <>
          <ConfirmModal
            open={displayConfirmClearQueueModal}
            onConfirm={handleConfirmClearQueue}
            onModalClose={handleCloseConfirmClearQueueModal}
            title="Clear Queue"
            subtitle="You are about to clear the patient queue and their respective visits. Are you sure?"
          />
        </>
      ) : (
        <></>
      )}

      {displayDailyReportPatientListModal && queueEntryDailyReportPatientList ? (
        <>
          <DailyReportPatientListModal
            open={displayDailyReportPatientListModal}
            onModalClose={handleCloseDailiyReportPatientListModal}
            patientList={queueEntryDailyReportPatientList}
          />
        </>
      ) : (
        <></>
      )}
    </>
  );
};

export default ServiceQueueComponent;
