import { type Encounter, formatDate, openmrsFetch, parseDate, restBaseUrl, useSession } from '@openmrs/esm-framework';
import {
  type QueueEntryResponse,
  type Identifer,
  type MappedEncounter,
  type MappedVisitQueueEntry,
  type QueueEntry,
  type Queue,
  type CreateQueueDto,
  type QueueRoom,
  type CreateQueueRoomDto,
} from '../types/types';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { useMemo } from 'react';
import { type QueueEntryResult, type RegistrationQueueList } from '../registry/types';
import { getEtlBaseUrl } from '../shared/utils/get-base-url';
import {
  type ServiceQueueDailyPatientListReportResp,
  type ServiceQueueDailyReport,
  type ServiceQueueDailyReportResp,
  type ServiceQueueReportPatientList,
} from '../shared/types';

export function serveQueueEntry(servicePointName: string, ticketNumber: string, status: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/queueutil/assignticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      servicePointName,
      ticketNumber,
      status,
    },
  });
}

const mapEncounterProperties = (encounter: Encounter): MappedEncounter => ({
  diagnoses: encounter.diagnoses,
  encounterDatetime: encounter.encounterDatetime,
  encounterType: encounter.encounterType.display,
  obs: encounter.obs,
  provider: encounter.encounterProviders[0]?.provider?.person?.display,
  uuid: encounter.uuid,
  voided: encounter.voided,
});

export const mapVisitQueueEntryProperties = (
  queueEntry: QueueEntry,
  visitQueueNumberAttributeUuid: string,
): MappedVisitQueueEntry => ({
  id: queueEntry.uuid,
  encounters: queueEntry.visit?.encounters?.map(mapEncounterProperties),
  name: queueEntry.display,
  patientUuid: queueEntry.patient.uuid,
  patientAge: queueEntry.patient.person?.age + '',
  patientDob: queueEntry?.patient?.person?.birthdate
    ? formatDate(parseDate(queueEntry.patient.person.birthdate), { time: false })
    : '--',
  patientGender: queueEntry.patient.person.gender,
  queue: queueEntry.queue,
  priority: queueEntry.priority,
  priorityComment: queueEntry.priorityComment,
  status: queueEntry.status,
  startedAt: dayjs(queueEntry.startedAt).toDate(),
  endedAt: queueEntry.endedAt ? dayjs(queueEntry.endedAt).toDate() : null,
  visitType: queueEntry.visit?.visitType?.display,
  queueLocation: (queueEntry?.queue as any)?.location?.uuid,
  visitTypeUuid: queueEntry.visit?.visitType?.uuid,
  visitUuid: queueEntry.visit?.uuid,
  queueUuid: queueEntry.queue.uuid,
  queueEntryUuid: queueEntry.uuid,
  sortWeight: queueEntry.sortWeight,
  visitQueueNumber: queueEntry.visit?.attributes?.find((e) => e?.attributeType?.uuid === visitQueueNumberAttributeUuid)
    ?.value,
  identifiers: queueEntry.patient?.identifiers as Identifer[],
  queueComingFrom: queueEntry?.queueComingFrom?.name,
});

export function useQueueEntries(queue: string) {
  // const queueEntryBaseUrl = `${restBaseUrl}/queue-entry?` +
  // `isEnded=false&service=7f7ec7ad-cdd7-4ed9-bc2e-5c5bd9f065b2&location=18c343eb-b353-462a-9139-b16606e6b6c2`;
  const queueEntryBaseUrl = `${restBaseUrl}/queue-entry?` + `isEnded=false&queue=${queue}`;
  const {
    data,
    isValidating,
    isLoading,
    error: pageError,
  } = useSWR<QueueEntryResponse, Error>(queueEntryBaseUrl, openmrsFetch);

  const queueEntries = useMemo(() => data, [data]);

  return {
    queueEntries,
    isLoading,
  };
}

export function useQueues(service: string = '7f7ec7ad-cdd7-4ed9-bc2e-5c5bd9f065b2') {
  const currentUserSession = useSession();
  const location = currentUserSession?.sessionLocation?.uuid;

  const customRepresentation = 'custom:(uuid,display,name)';

  const apiUrl =
    `${restBaseUrl}/queue?&service=${service}` +
    (location ? `&location=${location}` : '') +
    `&v=${customRepresentation}`;

  const { data, isLoading } = useSWR<
    {
      data: {
        results: Array<{
          uuid: string;
          display: string;
          name: string;
        }>;
      };
    },
    Error
  >(service ? apiUrl : null, openmrsFetch);

  return { data, isLoading };
}

export function useQueue(service: string = '7f7ec7ad-cdd7-4ed9-bc2e-5c5bd9f065b2') {
  const currentUserSession = useSession();
  const location = currentUserSession?.sessionLocation?.uuid;

  const customRepresentation = 'custom:(uuid,display,name)';

  const apiUrl =
    `${restBaseUrl}/queue?&service=${service}` +
    (location ? `&location=${location}` : '') +
    `&v=${customRepresentation}`;

  const { data, isLoading } = useSWR<
    {
      data: {
        results: Array<{
          uuid: string;
          display: string;
          name: string;
        }>;
      };
    },
    Error
  >(service ? apiUrl : null, openmrsFetch);

  return { data, isLoading };
}

export async function getServiceQueueByLocationUuid(
  serviceUuid: string,
  locationUuid: string,
): Promise<QueueEntryResult[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const queueEntryUrl = `${etlBaseUrl}/queue-entry`;
  const params = {
    locationUuid: locationUuid,
    serviceUuid: serviceUuid,
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${queueEntryUrl}?${queryString}`);
  const result = await response.json();
  return result.data;
}

export async function closeQueueEntry(entryQueueUuid: string): Promise<QueueEntryResult[]> {
  const queueEntryUrl = `${restBaseUrl}/queue-entry/${entryQueueUuid}`;
  const params = {
    endedAt: new Date().toISOString(),
  };
  const response = await openmrsFetch(queueEntryUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const result = await response.json();
  return result.data;
}

export async function getQueuesByLocationUuid(locationUuid: string): Promise<Queue[]> {
  const queueUrl = `${restBaseUrl}/queue`;
  const params = {
    location: locationUuid,
    v: 'full',
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${queueUrl}?${queryString}`);
  const result = await response.json();
  return result.results;
}

export async function deleteQueue(queueUuid: string): Promise<any> {
  const queueUrl = `${restBaseUrl}/queue/${queueUuid}?!purge`;
  const response = await openmrsFetch(queueUrl, {
    method: 'DELETE',
  });
  return response;
}

export async function createQueue(createQueueDto: CreateQueueDto): Promise<Queue> {
  const createQueueUrl = `${restBaseUrl}/queue/`;
  const response = await openmrsFetch(createQueueUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createQueueDto),
  });
  const result = await response.json();
  return result;
}

export async function editQueue(queueUuid: string, editQueueDto: CreateQueueDto): Promise<Queue> {
  const editQueueUrl = `${restBaseUrl}/queue/${queueUuid}`;
  const response = await openmrsFetch(editQueueUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(editQueueDto),
  });
  const result = await response.json();
  return result;
}

export async function getQueueRoomsByLocationUuid(locationUuid: string): Promise<QueueRoom[]> {
  const queueUrl = `${restBaseUrl}/queue-room`;
  const v =
    'custom:(uuid,display,name,description,queue:(uuid,display,location:(uuid,display),service:(uuid,display)))';
  const params = {
    location: locationUuid,
    v: v,
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${queueUrl}?${queryString}`);
  const result = await response.json();
  return result.results;
}

export async function createQueueRoom(createQueueRoomDto: CreateQueueRoomDto): Promise<QueueRoom> {
  const createQueueUrl = `${restBaseUrl}/queue-room/`;
  const response = await openmrsFetch(createQueueUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createQueueRoomDto),
  });
  const result = await response.json();
  return result;
}

export async function deleteQueueRoom(queueRoomUuid: string): Promise<any> {
  const queueUrl = `${restBaseUrl}/queue-room/${queueRoomUuid}?!purge`;
  const response = await openmrsFetch(queueUrl, {
    method: 'DELETE',
  });
  return response;
}

export async function editQueueRoom(queueRoomUuid: string, editQueueRoomDto: CreateQueueRoomDto): Promise<QueueRoom> {
  const editQueueUrl = `${restBaseUrl}/queue-room/${queueRoomUuid}`;
  const response = await openmrsFetch(editQueueUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(editQueueRoomDto),
  });
  const result = await response.json();
  return result;
}
export async function getActiveQueueEntryByPatientUuid(patientUuid: string): Promise<QueueEntry[]> {
  const queueUrl = `${restBaseUrl}/queue-entry`;
  const v =
    'custom:(uuid,display,queue,status,patient:(uuid,display,person,identifiers:(uuid,display,identifier,identifierType)),visit:(uuid,display,startDatetime,encounters:(uuid,display,diagnoses,encounterDatetime,encounterType,obs,encounterProviders,voided),attributes:(uuid,display,value,attributeType)),priority,priorityComment,sortWeight,startedAt,endedAt,locationWaitingFor,queueComingFrom,providerWaitingFor,previousQueueEntry)';
  const params = {
    patient: patientUuid,
    v: v,
    isEnded: 'false',
    totalCount: 'true',
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${queueUrl}?${queryString}`);
  const result = await response.json();
  return result.results;
}

export async function getServiceQueueDailyReport(
  serviceUuid: string,
  locationUuid: string,
): Promise<ServiceQueueDailyReport[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const reportUrl = `${etlBaseUrl}/service-queue-daily-report?serviceUuid=${serviceUuid}&locationUuid=${locationUuid}`;
  const response = await openmrsFetch<ServiceQueueDailyReportResp>(reportUrl);
  const result = await response.json();
  return result.result;
}

export async function getServiceQueueDailyPatientListReport(
  serviceUuid: string,
  locationUuid: string,
): Promise<ServiceQueueReportPatientList[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const reportUrl = `${etlBaseUrl}/service-queue-daily-report/patient-list?serviceUuid=${serviceUuid}&locationUuid=${locationUuid}`;
  const response = await openmrsFetch<ServiceQueueDailyPatientListReportResp>(reportUrl);
  const result: ServiceQueueDailyPatientListReportResp = await response.json();
  if (result && result.results) {
    return result.results.results ?? [];
  } else {
    return [];
  }
}
export async function getQueueEntryByLocationUuid(locationUuid: string): Promise<QueueEntry[]> {
  const queueUrl = `${restBaseUrl}/queue-entry`;
  const v =
    'custom:(uuid,display,queue,status,patient:(uuid,display,person),visit:(uuid,display,startDatetime,stopDatetime),priority,priorityComment,sortWeight,startedAt,endedAt,locationWaitingFor,queueComingFrom,providerWaitingFor,previousQueueEntry)';
  const params = {
    location: locationUuid,
    v: v,
    isEnded: 'false',
    totalCount: 'true',
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${queueUrl}?${queryString}`);
  const result = await response.json();
  return result.results;
}

export async function deleteQueueEntry(queueEntryUuid: string): Promise<any> {
  const queueUrl = `${restBaseUrl}/queue-entry/${queueEntryUuid}?!purge`;
  const response = await openmrsFetch(queueUrl, {
    method: 'DELETE',
  });
  return response;
}

export async function endQueueEntry(entryQueueUuid: string, endedAt: string): Promise<QueueEntryResult[]> {
  const queueEntryUrl = `${restBaseUrl}/queue-entry/${entryQueueUuid}`;
  const params = {
    endedAt: endedAt,
  };
  const response = await openmrsFetch(queueEntryUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const result = await response.json();
  return result.data;
}

export async function getRegistrationQueueList(
  locationUuid: string,
  startDate: string,
  endDate: string
): Promise<RegistrationQueueList[]> {
  const etlBaseUrl = await getEtlBaseUrl();
  const reportUrl = `${etlBaseUrl}/queue-entry/registration?locationUuid=${locationUuid}&startDate=${startDate}&endDate=${endDate}`;
  const response = await openmrsFetch(reportUrl);
  const result: { data: RegistrationQueueList[] } = await response.json();
  return result.data ?? [];
}
