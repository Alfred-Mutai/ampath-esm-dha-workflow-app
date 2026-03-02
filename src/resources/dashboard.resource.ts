import { openmrsFetch } from '@openmrs/esm-framework';
import { getEtlBaseUrl } from '../shared/utils/get-base-url';

export async function getDashBoardSummary(locationUuid: string): Promise<any> {
  const etlBaseUrl = await getEtlBaseUrl();
  const dashboardSummaryUrl = `${etlBaseUrl}/dashboard-summary`;
  const params = {
    locationUuid: locationUuid,
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${dashboardSummaryUrl}?${queryString}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch dashboard summary: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data;
}
