import { openmrsFetch } from '@openmrs/esm-framework';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import { getVisitCaseSummary } from './case-summary.resource';
import { type CaseSummaryResponse } from './types/case-summary.types';

// A factory mock, not a bare `jest.mock(path)` automock: the real
// `get-base-url.ts` imports `moduleName` from `../..` (the app's root
// `src/index.ts`), which pulls in the entire module registration graph —
// including an ESM-only transitive dependency Jest can't transform. A
// factory substitutes the mock directly without ever loading the real file.
jest.mock('../shared/utils/get-base-url', () => ({
  getHieBaseUrl: jest.fn(),
}));

const mockOpenmrsFetch = jest.mocked(openmrsFetch);
const mockGetHieBaseUrl = jest.mocked(getHieBaseUrl);

const BASE_URL = 'https://hie.example.org/api';

function mockResponse(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data } as any;
}

const summaryFixture: CaseSummaryResponse = {
  visit: { uuid: 'visit-1', visitType: 'OPD Visit' },
  visitUuids: ['visit-1'],
  demographics: { name: 'JANE DOE' },
  allergies: [],
  conditions: [],
  vitals: {},
  medications: [],
  clinicalNotes: [],
  labOrders: [],
  soapNote: {},
};

describe('getVisitCaseSummary', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetHieBaseUrl.mockResolvedValue(BASE_URL);
  });

  it('requests the endpoint with patientUuid and locationUuid, omitting visitUuid when not given', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(mockResponse(summaryFixture));

    const summary = await getVisitCaseSummary('patient-1', 'loc-1');

    const [url] = mockOpenmrsFetch.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/case-summary?patientUuid=patient-1&locationUuid=loc-1`);
    expect(summary).toEqual(summaryFixture);
  });

  it('includes visitUuid when a specific visit is requested', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(mockResponse(summaryFixture));

    await getVisitCaseSummary('patient-1', 'loc-1', 'visit-1');

    const [url] = mockOpenmrsFetch.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/case-summary?patientUuid=patient-1&locationUuid=loc-1&visitUuid=visit-1`);
  });

  it('surfaces a failed request as an Error carrying the status and upstream message', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(mockResponse({ message: 'No visit found for this patient.' }, false, 404));

    await expect(getVisitCaseSummary('patient-1', 'loc-1')).rejects.toThrow(
      'Request failed with 404: No visit found for this patient.',
    );
  });
});
