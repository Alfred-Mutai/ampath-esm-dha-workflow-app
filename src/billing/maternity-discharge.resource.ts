import { getEtlBaseUrl } from '../shared/utils/get-base-url';

import { openmrsFetch } from '@openmrs/esm-framework';

export async function getDischargeSummary(crId: string, amrsId: string): Promise<any> {
  const hieBaseUrl = await getEtlBaseUrl();

  try {
    const response = await openmrsFetch(`${hieBaseUrl}/discharge-summary?crId=${crId}&amrsId=${amrsId}`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}: ${data.message ?? 'Failed to fetch discharge summary'}`);
    }

    return data.results[0];
  } catch (error) {
    console.error('Failed to fetch discharge summary:', error);
  }
}
