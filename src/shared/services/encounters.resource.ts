import { type Encounter, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type CreateOrderEncounterDto } from '../types';

export async function fetchPatientEncountersByType(patientUuid: string, encounterTypeUuid: string) {
  const res = await openmrsFetch(
    `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=full`,
  );

  return res.data.results ?? [];
}
export async function getPatientEncounters(patientUuid: string) {
  const res = await openmrsFetch(`${restBaseUrl}/encounter?patient=${patientUuid}&v=full`);

  return res.data.results ?? [];
}
export async function createOrderEncounter(createOrderEncounterDto: CreateOrderEncounterDto): Promise<Encounter> {
  const encounterUrl = `${restBaseUrl}/encounter`;
  const response = await openmrsFetch(encounterUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createOrderEncounterDto),
  });
  const result = await response.json();
  return result ?? null;
}
