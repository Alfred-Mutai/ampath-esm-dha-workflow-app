import {
  type Visit,
  type Location,
  type Concept,
  type Patient,
  type OpenmrsResource,
  type Obs,
  type FetchResponse,
} from '@openmrs/esm-framework';

export interface QueueEntry {
  uuid: string;
  display: string;
  endedAt: string;
  locationWaitingFor: Location;
  patient: Patient;
  priority: Concept;
  priorityComment: string | null;
  providerWaitingFor: Provider;
  queue: Queue;
  startedAt: string;
  status: Concept;
  visit: Visit;
  sortWeight: number;
  queueComingFrom: Queue;
  previousQueueEntry: QueueEntry;
}

export interface Provider {
  uuid: string;
  display: string;
  comments: string;
  response?: string;
  person: OpenmrsResource;
  location: string;
  serviceType: string;
}

export type QueueService = {
  uuid: string;
  display: string;
  name: string;
  description: string;
  location: Location;
  service: QueueService;
};

export interface Queue {
  uuid: string;
  display: string;
  name: string;
  description: string;
  location: Location;
  service: Concept;
  allowedPriorities: Array<Concept>;
  allowedStatuses: Array<Concept>;
}

export interface Identifer {
  identifier: string;
  display: string;
  uuid: string;
  identifierType: {
    uuid: string;
    display: string;
  };
}

interface Encounter {
  diagnoses?: Array<any>;
  encounterDatetime?: string;
  encounterProviders?: Array<{ provider?: { person?: { display?: string } } }>;
  encounterType?: { display: string; uuid: string };
  obs?: Array<Obs>;
  uuid: string;
  voided?: boolean;
}

export interface MappedEncounter extends Omit<Encounter, 'encounterType' | 'provider'> {
  encounterType: string;
  provider: string;
}

export interface MappedVisitQueueEntry {
  id: string;
  encounters: Array<MappedEncounter>;
  name: string;
  patientAge: string;
  patientDob: string;
  patientGender: string;
  patientUuid: string;
  queue: Queue;
  priority: Concept;
  priorityComment: string;
  status: Concept;
  startedAt: Date;
  endedAt: Date;
  visitType: string;
  visitUuid: string;
  visitTypeUuid: string;
  queueUuid: string;
  queueEntryUuid: string;
  queueLocation: string;
  sortWeight: number;
  visitQueueNumber: string;
  identifiers: Array<Identifer>;
  queueComingFrom: string;
}

export type QueueEntryResponse = FetchResponse<{
  results: Array<QueueEntry>;
  links: Array<{
    rel: 'prev' | 'next';
    uri: string;
  }>;
  totalCount: number;
}>;

export type TransitionQueueEntryDto = {
  queueEntryToTransition: string;
  newQueue?: string;
  newStatus?: string;
  newPriority?: string;
  newPriorityComment?: string;
};

export type TagColor = 'green' | 'gray' | 'blue' | 'red';

export enum QueueEntryStatus {
  Completed = 'COMPLETED',
  Waiting = 'WAITING',
  InService = 'IN SERVICE',
}

export enum QueueEntryPriority {
  Emergency = 'EMERGENCY',
  Priority = 'PRIORITY',
  NonUrgent = 'NON-URGENT',
}

export type CreateQueueDto = {
  name: string;
  description: string;
  service: {
    uuid: string;
  };
  location: {
    uuid: string;
  };
};

export type QueueRoom = {
  uuid: string;
  display: string;
  name: string;
  description: string;
  queue: Queue;
};

export type CreateQueueRoomDto = {
  name: string;
  description: string;
  queue: {
    uuid: string;
  };
};

export type TagType =
  | 'red'
  | 'magenta'
  | 'purple'
  | 'blue'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'gray'
  | 'cool-gray'
  | 'warm-gray'
  | 'high-contrast'
  | 'outline';
