import React, { useCallback, useEffect, useState } from 'react';
import { DataTableSkeleton } from '@carbon/react';
import { type BedLayout, type FacilityAdmissionRequest } from '../../../../admissions/types';
import { fetchFacilityAdmissionRequests, getAdmittedPatientsData } from '../../../../admissions/admissions.resource';
import AdmissionsRequestList from '../../../../admissions/admission-request-list/admission-request-list';
import EmptyState from '../shared/empty-state.component';
import styles from '../facility-bills/facility-bills.component.scss';

interface AdmissionRequestsTabProps {
  locationUuid: string;
}

/**
 * The admission requests list, as a tab of the billing dashboard.
 *
 * The list itself is the admissions module's — the same component its own dashboard
 * renders — so the two can't drift. What this adds is the fetching, which that component
 * does not do for itself: it takes the requests and the bed layouts as props, because on
 * the admissions dashboard they are already loaded for the other tabs sharing them.
 *
 * The bed layouts are fetched alongside the requests rather than left empty. They are what
 * the Admit modal offers a bed from, so without them the row's main action opens onto an
 * empty picker.
 */
const AdmissionRequestsTab: React.FC<AdmissionRequestsTabProps> = ({ locationUuid }) => {
  const [admissionRequests, setAdmissionRequests] = useState<FacilityAdmissionRequest[]>([]);
  const [bedLayouts, setBedLayouts] = useState<BedLayout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    if (!locationUuid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Together: the list is not usable until both have arrived, and they are independent
      // requests, so waiting on them in sequence would only be slower.
      const [requests, beds] = await Promise.all([
        fetchFacilityAdmissionRequests(locationUuid),
        getAdmittedPatientsData(locationUuid),
      ]);
      setAdmissionRequests(requests ?? []);
      setBedLayouts(beds ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [locationUuid]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.tableCard}>
          <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {admissionRequests.length ? (
        // `refresh` is how the list reloads after admitting or cancelling one, so it is
        // wired to the same fetch rather than to a no-op.
        <AdmissionsRequestList admissionRequests={admissionRequests} bedLayouts={bedLayouts} refresh={load} />
      ) : (
        <EmptyState message="No admission requests at this facility." />
      )}
    </div>
  );
};

export default AdmissionRequestsTab;
