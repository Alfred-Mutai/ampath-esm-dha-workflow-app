import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type EndVisitDto, type CreateVisitDto, UpdateVisitDto } from '../registry/types';

export async function createVisit(createVisitDto: CreateVisitDto) {
  const url = `${restBaseUrl}/visit`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createVisitDto),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function endVisit(visitUuid: string, endVisitDto: EndVisitDto) {
  const url = `${restBaseUrl}/visit/${visitUuid}`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(endVisitDto),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function updateVisit(visitUuid: string, updateVisitDto: UpdateVisitDto) {
  const url = `${restBaseUrl}/visit/${visitUuid}`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(updateVisitDto),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}
