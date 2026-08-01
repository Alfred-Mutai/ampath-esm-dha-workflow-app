import React, { useEffect, useMemo, useState } from 'react';
import {
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  type FacilityAdmissionRequest,
  type BedLayout,
  CLAIM_VISIT_START_SERVICE_POINTS_UUID,
  SERVICE_POINT_NAME,
  type LocationAttribute,
} from '../types';
import AdmitPatientModal from '../modal/admit-patient/admit-patient.modal';
import { formatDate, showSnackbar, useSession, type Visit } from '@openmrs/esm-framework';
import CancelAdmissionRequestModal from '../modal/cancel-admission-request/cancel-admission-request';
import { fetchLocationDetails } from '../admissions.resource';
import SendToQueueModal from '../../registry/modal/send-to-triage/send-to-queue.modal';
import { createVisit } from '../../resources/visit.resource';
import { type VisitAttribute, type CreateVisitDto } from '../../registry/types';
import { VisitTypeUuids } from '../../shared/constants/visit-types';
import { type PaymentMode } from '../../shared/types';
import { fetchPaymentModes } from '../../shared/services/billing.resource';

interface AdmissionListProps {
  admissionRequests: FacilityAdmissionRequest[];
  bedLayouts: BedLayout[];
  refresh: () => void;
}

const AdmissionsRequestList: React.FC<AdmissionListProps> = ({ admissionRequests, bedLayouts, refresh }) => {
  const [selectedAdmissionRequest, setSelectedAdmissionRequest] = useState<FacilityAdmissionRequest>();
  const [showAdmitModal, setShowAdmitModal] = useState<boolean>(false);
  const [showCancelAdmissionModal, setShowCancelAdmissionModal] = useState<boolean>(false);
  const [startClaimVisit, setStartClaimVisit] = useState<boolean>(false);
  const [showStartClaimModal, setShowStartClaimModal] = useState<boolean>(false);
  const [admissionInpatientVisit, setAdmissionInpatientVisit] = useState<Visit>();
  // const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode>();
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const selectedPaymentMode = useMemo(() => {
    return paymentModes.find((p) => {
      return p.name === 'SHA';
    });
  }, [paymentModes]);
  useEffect(() => {
    if (locationUuid) {
      getLocationDetails();
    }
    getPaymentMethods();
  }, [locationUuid]);
  if (!admissionRequests || admissionRequests.length === 0) {
    return <>No Data</>;
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
    refresh();
  };
  const handleCancelAdmissionClose = () => {
    setShowCancelAdmissionModal(false);
    refresh();
  };
  const handleCancelAdmissionSuccess = () => {
    handleCancelAdmissionClose();
  };
  const handleStartClaimAndAdmit = (admissionRequest: FacilityAdmissionRequest) => {
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
  const onCreateClaimVisitModalClose = () => {
    setShowStartClaimModal(false);
  };
  return (
    <>
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
                  <>
                    <OverflowMenu aria-label="overflow-menu">
                      <OverflowMenuItem itemText="Cancel" onClick={() => handleCancelRequest(val)} />
                        {
                           startClaimVisit &&  <OverflowMenuItem itemText="Start Claim and Admit" onClick={() => handleStartClaimAndAdmit(val)} />
                        }
                      <OverflowMenuItem itemText="Admit" onClick={() => handleAdmitPatient(val)} />
                    </OverflowMenu>
                  </>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      {showAdmitModal && selectedAdmissionRequest ? (
        <>
          <AdmitPatientModal
            onModalClose={handleAdmitModalClose}
            open={showAdmitModal}
            onSuccessfullAdmission={handeSuccessfullAdmission}
            facilityAdmissionRequest={selectedAdmissionRequest}
            bedLayouts={bedLayouts}
          />
        </>
      ) : (
        <></>
      )}
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

export default AdmissionsRequestList;
