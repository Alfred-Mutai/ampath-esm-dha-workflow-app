import React, { useEffect, useMemo, useState, useCallback } from 'react';
import styles from './admissions-dashboard.component.scss';
import StatCard from '../shared/ui/stat-card/stat-card.component';
import { InlineLoading, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { type Patient, useConfig, useSession } from '@openmrs/esm-framework';
import {
  fetchFacilityEncounterBills,
  getAdmissionLoactionData,
  getAdmissionRequests,
  getAdmittedPatientsData,
  getDichargedEncounters,
  fetchFacilityAdmissionRequests,
  useActiveVisitEncounterUuids,
} from './admissions.resource';
import {
  type Disposition,
  type AdmissionLocationData,
  type BedLayout,
  type FhirEncounter,
  type FhirEncounterBundle,
  type FacilityEncounterBill,
  type FacilityAdmissionRequest,
} from './types';
import AdmittedPatientsList from './admitted-list/admitted-patients-list';
import AdmissionsRequestList from './admission-request-list/admission-request-list';
import { AdmissionEncounterTypeUuids } from './constants';
import DischargedList from './discharged-list/discharged-list';
import AwaitingDischargeList from './awaiting-discharge-list/awaiting-discharge-list';
import { type ConfigObject } from '../config-schema';
import dayjs from 'dayjs';
import FacilityAndWorkerSlot from '../shared/ui/facility-worker-slot/facility-worker.component-slot.component';

const AdmissionsDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<AdmissionLocationData>(null);
  const [admissionRequests,setAdmissionRequests] = useState<FacilityAdmissionRequest[]>([]);
  const [admissionListData, setAdmissionListData] = useState<Disposition[]>([]);
  const [admittedPatientsData, setAdmittedPatientsData] = useState<BedLayout[]>([]);
  const [facilityBills, setFacilityBills] = useState<FacilityEncounterBill[]>([]);
  const [dischargeEncounterBundle, setDischargeEncounterBundle] = useState<FhirEncounterBundle>();
  const [awaitingDischargeEncounterBundle, setAwaitingDischargeEncounterBundle] = useState<FhirEncounterBundle>();
  const [loading, setLoading] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const { maternityDischargeEncounterTypeUuid } = useConfig<ConfigObject>();
  const { activeVisitEncounterUuids } = useActiveVisitEncounterUuids(locationUuid);
  const sortedDischargeEncounters = useMemo(() => generateDischargeEncounters(), [dischargeEncounterBundle]);

  const getPatient = (patients: Patient[]) => {
    if (patients) {
      return patients[0];
    }
  }

  const { awaiting, admitted } = useMemo(() => {
    if (admittedPatientsData && awaitingDischargeEncounterBundle) {
      const fhirEntries = awaitingDischargeEncounterBundle.entry;
      let patientUuids = [];
      fhirEntries?.forEach((fe) => {
        const resource = fe.resource;
        if (resource && resource.resourceType === 'Encounter') {
          const subject = resource.subject.reference.split("/");
          const patientUuid = subject[1];
          patientUuids.push(patientUuid);
        }
      });

      const awaiting = admittedPatientsData.filter(p => patientUuids.includes(getPatient(p.patients)?.uuid));
      const admitted = admittedPatientsData.filter(p => !patientUuids.includes(getPatient(p.patients)?.uuid));

      return {
        awaiting, admitted
      }
    }
    return {
      awaiting: [],
      admitted: []
    }
  }, [admittedPatientsData, awaitingDischargeEncounterBundle]);

  useEffect(() => {
    fetchData();
  }, [locationUuid]);

  useEffect(() => {
    if (activeVisitEncounterUuids.length > 0) {
      getAwaitingDischargeEncounters();
      getDisachargedEncounters();
    }
  }, [activeVisitEncounterUuids]);

  const fetchData = () => {
    setLoading(true);
    getDashboardData();
    getAdmissionRequests(),
    getFacilityEncounterBills();
    // getAdmissionListData();
    getAwaitingDischargeEncounters();
    getAdmittedPatients();
    getDisachargedEncounters();
  };
  const getDashboardData = async () => {
    const res = await getAdmissionLoactionData(locationUuid);
    setDashboardData(res);
    setLoading(false);
  };
  const getFreeBeds = (dashboardData: AdmissionLocationData): number => {
    return (dashboardData?.totalBeds ?? 0) - (dashboardData.occupiedBeds ?? 0);
  };
  const getBedOccupancy = (dashboardData: AdmissionLocationData): number => {
    return parseFloat(((dashboardData?.occupiedBeds / dashboardData.totalBeds) * 100).toFixed(2));
  };
  const getAdmittedPatients = async () => {
    const res = await getAdmittedPatientsData(locationUuid);
    setAdmittedPatientsData(res);
    setLoading(false);
  };
  const getAwaitingDischargeEncounters = useCallback(async () => {
    const res = await getDichargedEncounters(maternityDischargeEncounterTypeUuid, locationUuid);
    
    if (res && res.entry) {
      const filteredEntries = res.entry.filter(entry => {
        const resource = entry.resource;
        return resource && resource.resourceType === 'Encounter' && activeVisitEncounterUuids.includes(resource.id);
      });
      setAwaitingDischargeEncounterBundle({
        ...res,
        entry: filteredEntries,
        total: filteredEntries.length
      });
    } else {
      setAwaitingDischargeEncounterBundle(res);
    }
  }, [maternityDischargeEncounterTypeUuid, locationUuid, activeVisitEncounterUuids]);
  
  const getDisachargedEncounters = useCallback(async () => {
    const res = await getDichargedEncounters(AdmissionEncounterTypeUuids.DISCHARGE_ENCOUNTER_TYPE_UUID, locationUuid);
    setDischargeEncounterBundle(res);
  }, [locationUuid, activeVisitEncounterUuids]);
  function generateDischargeEncounters(): FhirEncounter[] {
    if (dischargeEncounterBundle && dischargeEncounterBundle.entry) {
      const fhirEntries = dischargeEncounterBundle.entry ?? [];
      let dischargeEncounters: FhirEncounter[] = [];
      fhirEntries?.forEach((fe) => {
        const resource = fe.resource;
        if (resource && resource.resourceType === 'Encounter') {
          dischargeEncounters.push(resource);
        }
      });
      // order encounters in desc order
      const sortedEnc = dischargeEncounters.sort((a, b) => {
        return new Date(b.period.start).getTime() - new Date(a.period.start).getTime();
      });
      return sortedEnc;
    } else {
      return [];
    }
  }
  const getFacilityEncounterBills = async () => {
    const billingFrom = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const res = await fetchFacilityEncounterBills(locationUuid, maternityDischargeEncounterTypeUuid, billingFrom);
    setFacilityBills(res);
    setLoading(false);
  };
  const getAdmissionRequests = async()=>{
     const admissionRequests = await fetchFacilityAdmissionRequests(locationUuid);
     if(admissionRequests){
        setAdmissionRequests(admissionRequests);
     }else{
        setAdmissionRequests([]);
     }
  }
  const handleRefresh = () => {
    fetchData();
  };
  return (
    <>
      <div className={styles.admissionsLayout}>
      <div className={styles.hwrSection}>
        <FacilityAndWorkerSlot />
      </div>
        <div className={styles.headerSection}>
          <h4>Admissions</h4>
        </div>
        <div className={styles.statsSection}>
          <>
            {dashboardData ? (
              <>
                <StatCard title="Number of beds" count={dashboardData.totalBeds} />
                <StatCard title="Admitted Patients" count={dashboardData.occupiedBeds} />
                <StatCard title="Free Beds" count={getFreeBeds(dashboardData)} />
                <StatCard title="Bed Occupancy" count={getBedOccupancy(dashboardData)} other="%" />
              </>
            ) : (
              <></>
            )}
          </>
        </div>
        <div className={styles.contentSection}>
          {loading ? (
            <>
              <InlineLoading description="Fetching Data...please wait...." />
            </>
          ) : (
            <>
              <Tabs>
                <TabList contained>
                  <Tab>Admission Requests</Tab>
                  <Tab>Admitted</Tab>
                  <Tab>Awaiting Discharge</Tab>
                  <Tab>Discharged</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    {admissionRequests ? (
                      <AdmissionsRequestList
                        admissionRequests={admissionRequests}
                        bedLayouts={admittedPatientsData}
                        refresh={handleRefresh}
                      />
                    ) : (
                      <></>
                    )}
                  </TabPanel>
                  <TabPanel>
                    {admittedPatientsData ? (
                      <AdmittedPatientsList admittedPatientsData={admitted} refresh={handleRefresh} />
                    ) : (
                      <></>
                    )}
                  </TabPanel>
                  <TabPanel>
                    {admittedPatientsData ? (
                      <AwaitingDischargeList admittedPatientsData={awaiting} refresh={handleRefresh} facilityBills={facilityBills}/>
                    ) : (
                      <></>
                    )}
                  </TabPanel>
                  <TabPanel>
                    {sortedDischargeEncounters ? (
                      <>
                        <DischargedList dischargedEncounters={sortedDischargeEncounters} refresh={handleRefresh} />
                      </>
                    ) : (
                      <></>
                    )}
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </>
  );
};
export default AdmissionsDashboard;
