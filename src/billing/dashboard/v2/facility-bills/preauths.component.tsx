import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { claimVisitToken, useFacilityClaimVisits } from '../../../billing-claims.resource';
import { fetchPreauthPreviewRowsForTokens, type PreauthPreviewRow } from '../../../../claims/claims.resource';
import { PREAUTH_BUCKETS, preauthBucketKeyForStatus, type StatusBucket } from './claim-status';
import PreauthPreviewTable from './preauths-datatables/preauth-preview-table.component';
import styles from './facility-bills.component.scss';

const defaultBucketKey = (buckets: StatusBucket[]): string =>
  (buckets.find((b) => b.key === 'pending') ?? buckets[0])?.key ?? '';

interface PreauthsProps {
  locationUuid: string;
  billingDate: string;
}

/**
 * Preauthorisations tab — lists HIE preauths from GET /pre-auth/preview
 * (one call per claim-visit consent token for the selected date).
 * Pending rows that need doctor SMS approval can resend doctor consent.
 */
const Preauths: React.FC<PreauthsProps> = ({ locationUuid, billingDate }) => {
  const [statusFilter, setStatusFilter] = useState<string>(() => defaultBucketKey(PREAUTH_BUCKETS));
  const [rows, setRows] = useState<PreauthPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const {
    claimVisits,
    loading: visitsLoading,
    reload: reloadVisits,
  } = useFacilityClaimVisits(locationUuid, billingDate);

  const loadPreviews = useCallback(async () => {
    if (!locationUuid) return;
    const tokens = (claimVisits ?? []).map(claimVisitToken).filter(Boolean);
    if (!tokens.length) {
      setRows([]);
      return;
    }
    setLoadingPreview(true);
    try {
      const previewRows = await fetchPreauthPreviewRowsForTokens(tokens, locationUuid);
      setRows(previewRows);
    } finally {
      setLoadingPreview(false);
    }
  }, [claimVisits, locationUuid]);

  useEffect(() => {
    if (visitsLoading) return;
    loadPreviews();
  }, [visitsLoading, loadPreviews]);

  const handleRefresh = useCallback(() => {
    reloadVisits();
    loadPreviews();
  }, [reloadVisits, loadPreviews]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const bucket of PREAUTH_BUCKETS) {
      map[bucket.key] = 0;
    }
    for (const row of rows) {
      const key = preauthBucketKeyForStatus(row.status);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => preauthBucketKeyForStatus(r.status) === statusFilter);
  }, [rows, statusFilter]);

  const statusTabItems: StatusBucket[] = [...PREAUTH_BUCKETS, { key: '', label: 'All', statuses: [] }];
  const statusTabIndex = Math.max(
    0,
    statusTabItems.findIndex((b) => b.key === statusFilter),
  );
  const countPill = (key: string) => <span className={styles.pill}>{key ? (counts[key] ?? 0) : rows.length}</span>;

  const loading = visitsLoading || loadingPreview;

  return (
    // Not `.panel`: the Preauthorizations tab that renders this has already drawn the box,
    // and a second one around the same table put a border inside a border. No heading or
    // blurb either — the dashboard tab names this, and its hint says what the two views
    // are for, including the doctor-consent resend that paragraph used to explain.
    <div className={styles.subPanel}>
      <Tabs
        selectedIndex={statusTabIndex}
        onChange={({ selectedIndex }) => setStatusFilter(statusTabItems[selectedIndex]?.key ?? '')}
      >
        <TabList aria-label="Preauth statuses" className={styles.statusTabs} scrollDebounceWait={200}>
          {statusTabItems.map((bucket) => (
            <Tab key={bucket.key || 'all'}>
              {bucket.label}
              {countPill(bucket.key)}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {statusTabItems.map((bucket) => (
            <TabPanel key={bucket.key || 'all'}>
              {statusFilter === bucket.key ? (
                <div className={styles.tableCard}>
                  <PreauthPreviewTable
                    rows={filteredRows}
                    locationUuid={locationUuid}
                    loading={loading}
                    onRefresh={handleRefresh}
                  />
                </div>
              ) : null}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default Preauths;
