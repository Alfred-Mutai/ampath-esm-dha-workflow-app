import { type HieClient } from '../types';
import { maskExceptFirstAndLast } from './mask-data';

export function formatDependantDisplayData(dependant: HieClient, relationship: string): string {
  const stringData = `${maskExceptFirstAndLast(dependant.first_name)} ${maskExceptFirstAndLast(dependant.middle_name)} (${dependant.gender}) (DOB: ${dependant.date_of_birth}) (${relationship}) (CR: ${dependant.id})`;

  return stringData;
}
