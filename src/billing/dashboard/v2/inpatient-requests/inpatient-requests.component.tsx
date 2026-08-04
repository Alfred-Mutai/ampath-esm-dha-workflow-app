import React, { useEffect, useMemo, useState } from 'react';
import { type Encounter, formatDate, showSnackbar, type Visit } from '@openmrs/esm-framework';
import {
  CLAIM_VISIT_START_SERVICE_POINTS_UUID,
  type LocationAttribute,
  SERVICE_POINT_NAME,
  type FacilityAdmissionRequest,
  type AdmitPatientDto,
  type BedLayout,
  type AssignBedToPatientDto,
} from '../../../../admissions/types';
import { type PaymentMode } from '../../../../shared/types';
import { fetchPaymentModes } from '../../../../shared/services/billing.resource';
import {
  admitPatientToWard,
  assignBedToPatient,
  fetchFacilityAdmissionRequests,
  fetchLocationDetails,
  getAdmittedPatientsData,
} from '../../../../admissions/admissions.resource';
import { createVisit } from '../../../../resources/visit.resource';
import { type CreateVisitDto, type VisitAttribute } from '../../../../registry/types';
import { VisitTypeUuids } from '../../../../shared/constants/visit-types';
import {
  Button,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import AdmitPatientModal from '../../../../admissions/modal/admit-patient/admit-patient.modal';
import CancelAdmissionRequestModal from '../../../../admissions/modal/cancel-admission-request/cancel-admission-request';
import SendToQueueModal from '../../../../registry/modal/send-to-triage/send-to-queue.modal';
import { fetchFacilityBedOccupancy } from '../../../billing-claims.resource';
import { type BedOccupancy } from '../../../types';
import styles from './inpatient-requests.component.scss';
import DashboardCard from '../shared/dash-board-card/dash-board-card.component';
import { AdmissionEncounterTypeUuids } from '../../../../admissions/constants';

interface inpatientRequestsProps {
  locationUuid: string;
  requestDate: string;
}
const InpatientRequests: React.FC<inpatientRequestsProps> = ({ locationUuid, requestDate }) => {
  const [selectedAdmissionRequest, setSelectedAdmissionRequest] = useState<FacilityAdmissionRequest>();
  const [showAdmitModal, setShowAdmitModal] = useState<boolean>(false);
  const [showCancelAdmissionModal, setShowCancelAdmissionModal] = useState<boolean>(false);
  const [startClaimVisit, setStartClaimVisit] = useState<boolean>(false);
  const [showStartClaimModal, setShowStartClaimModal] = useState<boolean>(false);
  const [admissionInpatientVisit, setAdmissionInpatientVisit] = useState<Visit>();
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [admissionRequests, setAdmissionRequests] = useState<FacilityAdmissionRequest[]>([]);
  const [bedOccupancy, setBedOccupancy] = useState<BedOccupancy | null>(null);
  const [bedStats, setBedStats] = useState<{ name: string; value: number }[]>([]);
  const [bedLayouts, setBedLayouts] = useState<BedLayout[]>([]);

  const freeBeds = useMemo(() => {
    return bedLayouts.filter((bl) => {
      return bl.status === 'AVAILABLE';
    });
  }, [bedLayouts]);

  const selectedPaymentMode = useMemo(() => {
    return paymentModes.find((p) => {
      return p.name === 'SHA';
    });
  }, [paymentModes]);
  useEffect(() => {
    if (locationUuid) {
      getLocationDetails();
      getAdmissionRequests();
      getFacilityBedOccupancy();
      getbedLayouts();
    }
    getPaymentMethods();
  }, [locationUuid]);
  if (!admissionRequests || admissionRequests.length === 0) {
    return <>No Data</>;
  }
  async function getAdmissionRequests() {
    const admissionRequests = await fetchFacilityAdmissionRequests(locationUuid);
    if (admissionRequests) {
      setAdmissionRequests(admissionRequests);
    } else {
      setAdmissionRequests([]);
    }
  }
  async function getbedLayouts() {
    const res = await getAdmittedPatientsData(locationUuid);
    setBedLayouts(res);
  }
  async function getPaymentMethods() {
    const methods = await fetchPaymentModes();
    setPaymentModes(methods);
  }
  const handleCancelRequest = (admissionRequest: FacilityAdmissionRequest) => {
    setSelectedAdmissionRequest(admissionRequest);
    setShowCancelAdmissionModal(true);
  };
  const handleAdmitPatient = (admissionRequest: FacilityAdmissionRequest) => {
    setShowAdmitModal(true);
    setSelectedAdmissionRequest(admissionRequest);
  };
  const handleAdmitModalClose = () => {
    setShowAdmitModal(false);
  };
  const handeSuccessfullAdmission = () => {
    handleAdmitModalClose();
  };
  const handleCancelAdmissionClose = () => {
    setShowCancelAdmissionModal(false);
  };
  const handleCancelAdmissionSuccess = () => {
    handleCancelAdmissionClose();
  };
  const handleStartClaimAndAdmit = (admissionRequest: FacilityAdmissionRequest) => {
     //check if beds are free
    setSelectedAdmissionRequest(admissionRequest);
    createInpatientVisit(admissionRequest);
  };
  async function createInpatientVisit(admissionRequest: FacilityAdmissionRequest) {
    const resp = await createPatientVisit(admissionRequest);
    if (resp) {
      setAdmissionInpatientVisit(resp);
      setShowStartClaimModal(true);
    }
  }
  async function getLocationDetails() {
    const resp = await fetchLocationDetails(locationUuid);
    if (resp) {
      const locationAttributes: LocationAttribute[] = resp?.attributes ?? [];
      const startClaimVisitAttr = getLocationAttribute(locationAttributes, CLAIM_VISIT_START_SERVICE_POINTS_UUID);
      if (startClaimVisitAttr) {
        const val = canStartClaimVisit(startClaimVisitAttr);
        setStartClaimVisit(val);
      } else {
        setStartClaimVisit(false);
      }
    }
  }
  function getLocationAttribute(attributes: LocationAttribute[], attributeTypeUuid: string) {
    return attributes.find((a) => {
      return a.attributeType.uuid === attributeTypeUuid;
    });
  }
  function canStartClaimVisit(startClaimVisitAttr: LocationAttribute): boolean {
    if (!startClaimVisitAttr) {
      return false;
    }
    const attrValue: string = startClaimVisitAttr?.value ?? '';
    return attrValue.toLowerCase().trim().includes(SERVICE_POINT_NAME.toLowerCase());
  }
  const createPatientVisit = async (admissionRequest: FacilityAdmissionRequest) => {
    const visitDto = getCreateVisitDto(admissionRequest);
    if (!isValidCreateVisitDto(visitDto)) {
      return false;
    }
    const result = await createVisit(visitDto);
    if (result) {
      showAlert('success', 'Inpatient Visit has been created succesfully', '');
      return result;
    } else {
      showAlert('error', 'Error creating patient visit', '');
      throw new Error('Error creating patient visit');
    }
  };
  const isValidCreateVisitDto = (createVisitDto: CreateVisitDto): boolean => {
    if (!createVisitDto.location) {
      showAlert('error', 'Missing location in create visits', '');
      return false;
    }
    if (!createVisitDto.patient) {
      showAlert('error', 'Please select a patient', '');
      return false;
    }

    if (!createVisitDto.visitType) {
      showAlert('error', 'Please select a visit', '');
      return false;
    }
    return true;
  };
  const getCreateVisitDto = (admissionRequest: FacilityAdmissionRequest): CreateVisitDto => {
    const visitAttributes = getVisitAttributes();
    const visitDto: CreateVisitDto = {
      visitType: VisitTypeUuids.INPATIENT_VISIT_TYPE_UUID,
      location: locationUuid,
      startDatetime: null,
      stopDatetime: null,
      patient: admissionRequest?.patient_uuid ?? '',
    };
    if (visitAttributes.length > 0) {
      visitDto['attributes'] = visitAttributes;
    }
    return visitDto;
  };
  function getVisitAttributes(): VisitAttribute[] {
    const attributes: VisitAttribute[] = [];
    if (selectedPaymentMode) {
      attributes.push({
        attributeType: '8553afa0-bdb9-4d3c-8a98-05fa9350aa85',
        value: selectedPaymentMode.uuid,
      });
    }
    return attributes;
  }
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };
  const onCreateClaimVisitModalClose = (closeParams: { success: boolean }) => {
    setShowStartClaimModal(false);
    if (closeParams.success) {
      admitPatient();
    }
  };
  function generateBedData(bedOccupancy: BedOccupancy) {
    const bedrate = bedOccupancy?.bed_occupancy_rate ?? null;
    const bedValues: { name: string; value: number }[] = [];
    if (bedrate) {
      Object.keys(bedrate).forEach((k: string) => {
        const val = bedrate[k];
        if (val > 0) {
          bedValues.push({
            name: formatToTitleCase(k),
            value: val,
          });
        }
      });
      setBedStats(bedValues);
    }
  }
  async function getFacilityBedOccupancy() {
    const resp = await fetchFacilityBedOccupancy(locationUuid);
    if (resp) {
      setBedOccupancy(resp);
      generateBedData(resp);
    } else {
      setBedOccupancy(null);
      setBedStats([]);
    }
  }
  function formatToTitleCase(str: string) {
    if (!str) return '';
    return str
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  const generateAdmitPatientPayload = (): AdmitPatientDto => {
    return {
      patient: selectedAdmissionRequest?.patient_uuid ?? '',
      encounterType: {
        uuid: AdmissionEncounterTypeUuids.ADMIT_ENCOUNTER_TYPE_UUID,
      },
      location: locationUuid ?? '',
      obs: [],
      visit: admissionInpatientVisit?.uuid,
    };
  };
  const admitPatient = async () => {
    if(freeBeds.length === 0){
        return;
    }
    try {
      const admitPatientDto = generateAdmitPatientPayload();
      const resp = await admitPatientToWard(admitPatientDto);

      showSnackbar({
        kind: 'success',
        title: 'Admission Successfull',
        subtitle: 'Patient Successfully Admitted',
      });

        //assign bed to patient
        const assignBedDto = generateAssignBedPayload(resp);
        const selectedFreeBed = freeBeds[0];
        const selectedBedId = selectedFreeBed.bedId ?? '';
        if(selectedBedId){
                     await assignBedToPatient(selectedBedId,assignBedDto);
          }
                  
          showSnackbar({
                      kind: 'success',
                      title: 'Bed Assignment Successfull',
                      subtitle: `Patient Successfully assigned bed ${selectedFreeBed.bedNumber}`,
          });
    } catch (error: any) {
      showSnackbar({
        kind: 'error',
        title: 'Bed Assignment failed',
        subtitle: error.message ?? 'Bed Assignment failed',
      });
    }
  };
   const generateAssignBedPayload = (admissionEncounter: Encounter): AssignBedToPatientDto=>{
          return {
              patientUuid: selectedAdmissionRequest?.patient_uuid ?? '',
              encounterUuid: admissionEncounter.uuid
          }
  }
  return (
    <>
      <div className={styles.inpatientRequestsLayout}>
        <div className={styles.inpatientRequestsHeader}>
          {bedOccupancy &&
            bedStats.map((s) => {
              return (
                <div className={styles.headerCol}>
                  <DashboardCard title={s.name} value={s.value} />
                </div>
              );
            })}
        </div>
        <div className={styles.inpatientRequestsContent}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader>Visit Type</TableHeader>
                <TableHeader>Identifiers</TableHeader>
                <TableHeader>Gender</TableHeader>
                <TableHeader>Age</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>

            <TableBody>
              {admissionRequests &&
                admissionRequests.map((val, index) => (
                  <TableRow key={val.patient_uuid ?? index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{formatDate(new Date(val.admission_request_date))}</TableCell>
                    <TableCell>{val.patient_name}</TableCell>
                    <TableCell>{val.visit_type}</TableCell>
                    <TableCell>{val.identifiers}</TableCell>
                    <TableCell>{val.gender}</TableCell>
                    <TableCell>{val.age}</TableCell>
                    <TableCell>
                      <div className={styles.btnContainer}>
                        <Button kind="primary" onClick={() => handleStartClaimAndAdmit(val)} size="sm" disabled={freeBeds.length === 0}>
                          Raise SHA Claim
                        </Button>
                        <Button kind="secondary" onClick={() => handleCancelRequest(val)} size="sm">
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {showCancelAdmissionModal && selectedAdmissionRequest ? (
        <>
          <CancelAdmissionRequestModal
            open={showCancelAdmissionModal}
            onModalClose={handleCancelAdmissionClose}
            onCancelAdmission={handleCancelAdmissionSuccess}
            facilityAdmissionRequest={selectedAdmissionRequest}
          />
        </>
      ) : (
        <></>
      )}

      {selectedAdmissionRequest && admissionInpatientVisit && showStartClaimModal && (
        <SendToQueueModal
          patientUuid={selectedAdmissionRequest?.patient_uuid}
          visitUuid={admissionInpatientVisit?.uuid}
          visitTypeUuid={VisitTypeUuids.INPATIENT_VISIT_TYPE_UUID}
          onModalClose={onCreateClaimVisitModalClose}
        />
      )}
    </>
  );
};
export default InpatientRequests;
