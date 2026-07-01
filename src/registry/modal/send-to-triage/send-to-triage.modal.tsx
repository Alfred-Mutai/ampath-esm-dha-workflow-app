import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  ComboBox,
  Modal,
  ModalBody,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from '@carbon/react';
import styles from './send-to-triage.modal.scss';
import { type Patient, useSession, showSnackbar, type Visit, useConfig, ExtensionSlot } from '@openmrs/esm-framework';
import {
  type HieClient,
  type CreateVisitDto,
  type QueueEntryDto,
  type ServiceQueue,
  PaymentDetail,
  type VisitAttribute,
} from '../../types';
import { createQueueEntry, getFacilityServiceQueues } from '../../../resources/queue.resource';
import { QUEUE_PRIORITIES_UUIDS, QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { createVisit } from '../../../resources/visit.resource';
import {
  createBill,
  fetchBillableServices,
  fetchCashPoints,
  fetchPaymentModes,
} from '../../../shared/services/billing.resource';
import {
  type PayableBillableService,
  type ServicePrice,
  type BillableService,
  type PaymentMode,
  type CreateBillDto,
  type CashPoint,
  type CreateOrderEncounterDto,
} from '../../../shared/types';
import { PatientCategories } from '../../../shared/constants/patient-category';
import { VisitTypeUuids } from '../../../shared/constants/visit-types';
import { type Bill } from '../../../billing/types';
import { fetchPatientBills } from '../../../billing/invoice/bill.resource';
import { type QueueEntry } from '../../../types/types';
import { getActiveQueueEntryByPatientUuid } from '../../../service-queues/service-queues.resource';
import { createOrderEncounter } from '../../../shared/services/encounters.resource';
import { type ConfigObject } from '../../../config-schema';
import { PatientTypes } from '../../../shared/constants/patient-type';
import ClaimsConsentModal from '../otp-verification-modal/claims-consent';
import { OtpFormData, type OTPWhitelistRequest } from '../../hie.types';
import { createOTPWhitelisting, sendClaimsOTP } from '../../hie.resource';
import { usePatient } from '../../../context/patient-context';
import ClaimsComponent from '../../../claims/claims.component';
import { type ClaimResult, type Intervention } from '../../../claims';

interface SendToTriageModalProps {
  patients: Patient[];
  open: boolean;
  onModalClose: (modalCloseResp?: { success: boolean }) => void;
  onSubmit: () => void;
  client: HieClient;
  onCreateAmrsPatient: (client: HieClient) => void;
  onManualRegistration: () => void;
}

const SendToTriageModal: React.FC<SendToTriageModalProps> = ({
  patients,
  open,
  onModalClose,
  onSubmit,
  client,
  onCreateAmrsPatient,
  onManualRegistration,
}) => {
  const [selectedPatient, setSelectedPatient] = useState<Patient>();
  const [selectedVisitType, setSelectedVisitType] = useState<string>();
  const [selectedPatientType, setSelectedPatientType] = useState<string>();
  const [serviceQueues, setServiceQueues] = useState<ServiceQueue[]>();
  const [selectedServiceQueue, setSelectedServiceQueue] = useState<string>();
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [cashPoints, setCashPoints] = useState<CashPoint[]>([]);
  const [selectedCashPoint, setSelectedCashPoint] = useState<CashPoint>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode>(null);
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<string>();
  const [billableServices, setBillableServices] = useState<BillableService[]>([]);
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [filteredBillableServices, setFilteredBillableServices] = useState<ServicePrice[]>(null);
  const [selectedBillableService, setSelectedBillableService] = useState<ServicePrice | null>(null);
  const [selectedInsuranceScheme, setSelectedInsuranceScheme] = useState<string>('');
  const [selectedInsurancePolicy, setSelectedInsurancePolicy] = useState<string>('');
  const [selectedPatientCategory, setSelectedPatientCategory] = useState<string>('');
  const [currentQueueEntry, setCurrentQueueEntry] = useState<QueueEntry>();
  const [patientBills, setPatientBills] = useState<Bill[]>([]);
  const [billCreated, setBillCreated] = useState<boolean>(false);
  const [disableSubmission, setDisableSubmission] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [claimResult, setClaimResult] = useState<ClaimResult>();
  const [triggerCreateVisit, setTriggerCreateVisit] = useState<boolean>(false);
  const [showConsent, setShowSoncent] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [whitelistRequest, setWhitelistRequest] = useState(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState(null);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | undefined>();
  const {
    registrationBillableServices,
    cashConsulationConceptUuid,
    shaConsulationConceptUuid,
    outPatientCareSettingUuid,
    orderEncounterTypeUuid,
    registrationServicequeues,
  } = useConfig<ConfigObject>();

  const { patient } = usePatient();

  const facilityCashPoints = useMemo(() => getfacilityCashpoints(), [cashPoints, locationUuid]);

  const visitTypeOptions = useMemo(
    () => [
      {
        text: 'OPD',
        id: VisitTypeUuids.OPD_VISIT_TYPE_UUID,
      },
      {
        text: 'Inpatient',
        id: VisitTypeUuids.INPATIENT_VISIT_TYPE_UUID,
      },
    ],
    [client],
  );

  const patientTypeOptions = useMemo(
    () => [
      {
        text: 'Walk-In',
        id: PatientTypes.WALK_IN_UUID,
      },
      {
        text: 'Self-Referral',
        id: PatientTypes.SELF_RERERRAL_UUID,
      },
      {
        text: 'Referral from another Facility',
        id: PatientTypes.REFERRAL_FROM_ANOTHER_FACILITY_UUID,
      },
      {
        text: 'Referral from Community',
        id: PatientTypes.REFERRED_BY_COMMUNITY_HEALTH_WORKER_UUID,
      },
    ],
    [client],
  );

  const patientIdentifiers = useMemo(() => {
    if (selectedPatient) {
      const identifiers = selectedPatient.identifiers;
      return {
        crIdentifierId: identifiers?.find((i) => i.identifierType.uuid == 'e88dc246-3614-4ee3-8141-1f2a83054e72')
          .identifier,
      };
    }
  }, [selectedPatient]);

  const paymentDetails = Object.values(PaymentDetail).map((value) => {
    return {
      id: value,
      label: value,
    };
  });
  useEffect(() => {
    getServiceQueues();
    getPaymentMethods();
    getBillableServices();
    getCashPoints();
    getPatientBills();
    getPatientActiveQueue();
  }, [patients]);
  if (!patients) {
    return <>No Client data</>;
  }

  function onClaimsVisitStart(payload: ClaimResult) {
    setClaimResult(payload);
  }

  async function getPatientActiveQueue() {
    if (patients && patients.length > 0) {
      const activePatient = patients[0];
      try {
        const resp = await getActiveQueueEntryByPatientUuid(activePatient.uuid);
        setCurrentQueueEntry(resp.length > 0 ? resp[0] : null);
      } catch (error) {
        showAlert('error', 'Error getting patient active queue', '');
      }
    }
  }

  async function getPatientBills() {
    if (patients) {
      let bills: Bill[] = [];
      setPatientBills([]);
      for (let i = 0; i < patients.length; i++) {
        const resp = await fetchPatientBills(patients[i].uuid);
        const todaysBills = getTodaysBills(resp);
        setPatientBills(todaysBills);
      }
    }
  }
  function getTodaysBills(bills: Bill[]) {
    const today = new Date();
    return bills.filter((b) => {
      const billDate = new Date(b.dateCreated);
      return (
        billDate.getFullYear() === today.getFullYear() &&
        billDate.getMonth() === today.getMonth() &&
        billDate.getDate() === today.getDate()
      );
    });
  }
  const handleSendToTriage = async () => {
    if (hasSelectedPaymentMode('SHIF')) {
      if (claimResult) {
        await sendToTriage();
      } else {
        setTriggerCreateVisit(true);
      }
      return;
    }
    await sendToTriage();
  };

  useEffect(() => {
    if (triggerCreateVisit && claimResult) {
      const fn = async () => {
        await sendToTriage();
        setTriggerCreateVisit(false);
      };
      void fn();
    }
  }, [triggerCreateVisit, claimResult]);

  const sendToTriage = async () => {
    if (disableSubmission) {
      showAlert(
        'error',
        'Form already Submitted',
        'Form has already been submitted, please wait for the visit,queue and bill to be created',
      );
      return;
    }
    setDisableSubmission(true);
    if (!validateVisitQueueBill()) {
      setDisableSubmission(false);
      return;
    }
    setLoading(true);
    try {
      const newVisit: Visit = await createPatientVisit();
      if (newVisit) {
        const addToTriageQueueDto: QueueEntryDto = generateAddToTriageDto(newVisit);
        const queueEntryResp = await createQueueEntry(addToTriageQueueDto);

        if (queueEntryResp) {
          showAlert('success', 'Patient has succesfully been moved to the Triage queue', '');
        }

        // add bill if it was a paying client
        let createBillResp = null;
        if (selectedPaymentDetail === PaymentDetail.Paying) {
          const createBillDto = generateCreateBillDto();
          if (isValidCreateBillDto(createBillDto) && !billCreated) {
            createBillResp = await createBill(createBillDto);
            if (createBillResp) {
              setBillCreated(true);
              showAlert('success', 'Bill succesfully created', '');
            }
            // create consulation order
            await createOrder(selectedPatient.uuid, newVisit.uuid);
          } else {
            return false;
          }
        }

        if (
          (queueEntryResp && PaymentDetail.Paying && (createBillResp || billCreated)) ||
          (queueEntryResp && PaymentDetail.NonPaying)
        ) {
          onModalClose({ success: true });
        }
      }
    } catch (error) {
      setDisableSubmission(false);
      showAlert('error', error.message ?? 'Error creating visit', '');
    } finally {
      setLoading(false);
    }
  };
  function validateVisitQueueBill(): boolean {
    if (!selectedPatient) {
      showAlert('error', 'Please select a patient', '');
      return false;
    }
    if (!selectedPaymentDetail) {
      showAlert('error', 'Please select a paying or non paying option', '');
      return false;
    }

    if (!isValidServiceQueueSelected()) {
      return false;
    }

    if (selectedPaymentDetail === PaymentDetail.Paying) {
      if (!selectedPaymentMode) {
        showAlert('error', 'Please select a payment method', '');
        return false;
      }
      if (!selectedBillableService) {
        showAlert('error', 'Please select a billable service', '');
        return false;
      }
      if (!selectedCashPoint) {
        showAlert('error', 'Please select a cashpoint', '');
        return false;
      }
    }
    if (selectedPaymentDetail === PaymentDetail.NonPaying) {
      if (!selectedPatientCategory) {
        showAlert('error', 'Please select a patient category', '');
        return false;
      }
    }
    if (!selectedVisitType) {
      showAlert('error', 'Please select a visit type', '');
      return false;
    }
    if (!selectedServiceQueue) {
      showAlert('error', 'Please select a service queue', '');
      return false;
    }
    if (!selectedPriority) {
      showAlert('error', 'Please select a service queue priority', '');
      return false;
    }
    return true;
  }
  const generateAddToTriageDto = (newVisit: Visit): QueueEntryDto => {
    const payload: QueueEntryDto = {
      visit: {
        uuid: newVisit.uuid,
      },
      queueEntry: {
        status: {
          uuid: QUEUE_STATUS_UUIDS.WAITING_UUID,
        },
        priority: {
          uuid: selectedPriority ?? QUEUE_PRIORITIES_UUIDS.NORMAL_PRIORITY_UUID,
        },
        queue: {
          uuid: selectedServiceQueue,
        },
        patient: {
          uuid: selectedPatient.uuid,
        },
        startedAt: newVisit.startDatetime,
        sortWeight: 0,
      },
    };
    return payload;
  };
  const onPatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
  };
  const visitTypeChangeHandler = (selectedVisitType: { selectedItem: { id: string; text: string } }) => {
    const vt = selectedVisitType.selectedItem.id;
    setSelectedVisitType(vt);
    setShowSoncent(true);
  };
  const isValidServiceQueueSelected = () => {
    if (!currentQueueEntry) {
      return true;
    }
    if (currentQueueEntry.queue.uuid) {
      showAlert(
        'error',
        'Patient already in queue',
        `Patient is already in the ${currentQueueEntry.queue.display} queue, remove them first or contact support`,
      );
      return false;
    }
    return true;
  };
  const serviceChangeHandler = ($event: any) => {
    if (isValidServiceQueueSelected()) {
      const sq = $event.target.value as unknown as string;
      setSelectedServiceQueue(sq);
    }
  };
  const priorityChangeHandler = (priorityUuid: string) => {
    setSelectedPriority(priorityUuid);
  };
  const paymentDetailsHandler = (paymentDetailSelected: string) => {
    setSelectedPaymentDetail(paymentDetailSelected);
  };
  const paymentMethodHandler = (selectedPaymentModeUuid: string) => {
    const selectedPaymentMode = paymentModes.find((pm) => {
      return pm.uuid === selectedPaymentModeUuid;
    });
    setSelectedPaymentMode(selectedPaymentMode);
    const paymentModeBillableServices = getBillableServiceByPaymentMode(selectedPaymentMode);
    setFilteredBillableServices(paymentModeBillableServices);
    setSelectedInsuranceScheme('');
    setSelectedInsurancePolicy('');
    setSelectedPriority('');
  };
  const getBillableServiceByPaymentMode = (paymentMode: PaymentMode): PayableBillableService[] => {
    const paymentBillableServices: ServicePrice[] = [];
    servicePrices.forEach((sp) => {
      if (sp.paymentMode) {
        if (
          sp.paymentMode.uuid === paymentMode.uuid &&
          registrationBillableServices.includes(sp.billableService.uuid)
        ) {
          paymentBillableServices.push(sp);
        }
      }
    });
    return paymentBillableServices;
  };
  const billableServicesHandler = (selectedBillableServiceUuid: string) => {
    const selectedBillableService = servicePrices.find((sp) => {
      return sp.uuid === selectedBillableServiceUuid;
    });
    if (isValidBillableService(selectedBillableService)) {
      setSelectedBillableService(selectedBillableService);
    } else {
      setSelectedBillableService(null);
      showAlert('error', 'Existing bill', 'Patient has a similar bill');
    }
  };
  const isValidBillableService = (selectedService: ServicePrice) => {
    // check if patient has been billed for similar service
    let isValid = true;
    patientBills.forEach((b) => {
      const lineItems = b.lineItems;
      lineItems.forEach((l) => {
        if (l.billableService === selectedService.billableService.display) {
          isValid = false;
        }
      });
    });
    return isValid;
  };
  const cashPointsHandler = (selectedCashPointUuid: string) => {
    const selectedCashPoint = cashPoints.find((cp) => {
      return cp.uuid === selectedCashPointUuid;
    });
    setSelectedCashPoint(selectedCashPoint);
  };
  const patientTypeHandler = (selectedPatientType: { selectedItem: { id: string; text: string } }) => {
    const pt = selectedPatientType.selectedItem.id;
    setSelectedPatientType(pt);
  };
  const insuranceSchemeHandler = (selectedInsuranceScheme: string) => {
    setSelectedInsuranceScheme(selectedInsuranceScheme);
  };
  const insurancePolicyHandler = (selectedInsurancePolicy: string) => {
    setSelectedInsurancePolicy(selectedInsurancePolicy);
  };
  const patientCategoryHandler = (categoryUuid: string) => {
    setSelectedPatientCategory(categoryUuid);
  };
  const createPatientVisit = async () => {
    const visitDto = getCreateVisitDto();
    if (!isValidCreateVisitDto(visitDto)) {
      return false;
    }

    const result = await createVisit(visitDto);
    if (result) {
      showAlert('success', 'Visit has been created succesfully', '');
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
    if (!selectedPatientType) {
      showAlert('error', 'Please select a patient type', '');
      return false;
    }
    return true;
  };
  const getCreateVisitDto = (): CreateVisitDto => {
    const visitAttributes = getVisitAttributes();
    const visitDto: CreateVisitDto = {
      visitType: selectedVisitType,
      location: locationUuid,
      startDatetime: null,
      stopDatetime: null,
      patient: selectedPatient?.uuid,
    };
    if (visitAttributes.length > 0) {
      visitDto['attributes'] = visitAttributes;
    }
    return visitDto;
  };
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };

  function getVisitAttributes(): VisitAttribute[] {
    const attributes: VisitAttribute[] = [];
    if (selectedInsuranceScheme) {
      attributes.push({
        attributeType: '3a988e33-a6c0-4b76-b924-01abb998944b',
        value: selectedInsuranceScheme,
      });
    }
    if (selectedInsurancePolicy) {
      attributes.push({
        attributeType: 'aac48226-d143-4274-80e0-264db4e368ee',
        value: selectedInsurancePolicy,
      });
    }
    if (selectedPaymentMode) {
      attributes.push({
        attributeType: '8553afa0-bdb9-4d3c-8a98-05fa9350aa85',
        value: selectedPaymentMode.uuid,
      });
    }
    if (selectedPatientType) {
      attributes.push({
        attributeType: 'fbc0702d-b4c9-4968-be63-af8ad3ad6239',
        value: selectedPatientType,
      });
    }
    if (selectedPaymentDetail === PaymentDetail.NonPaying) {
      attributes.push({
        attributeType: 'df0362f9-782e-4d92-8bb2-3112e9e9eb3c',
        value: 'true',
      });
    }

    // Claims
    if (claimResult) {
      attributes.push({
        attributeType: '4962a633-c4f8-474c-857c-5c68c72fbbe3',
        value: claimResult.authorization_code,
      });
    }
    return attributes;
  }
  async function getServiceQueues() {
    try {
      const sqs = await getFacilityServiceQueues(locationUuid);
      if (sqs && sqs.length > 0) {
        const triageServiceQueues = getTriageServiceQueues(sqs);
        setServiceQueues(triageServiceQueues);
      }
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: 'An error occurred while fetching service queues',
        subtitle: e.message ?? 'An error occurred while fetching service queues, please try agin',
      });
    }
  }
  function getTriageServiceQueues(serviceQueues: ServiceQueue[]) {
    return serviceQueues.filter((sq) => {
      return registrationServicequeues.includes(sq.uuid ?? '');
    });
  }

  async function getPaymentMethods() {
    const methods = await fetchPaymentModes();
    setPaymentModes(methods);
  }

  async function getBillableServices() {
    const billableServices = await fetchBillableServices();
    setBillableServices(billableServices);
    generateServiceTypesList(billableServices);
  }

  async function getCashPoints() {
    const cp = await fetchCashPoints();
    setCashPoints(cp);
  }

  function getfacilityCashpoints() {
    return cashPoints.filter((cp) => {
      return cp && cp.location?.uuid === locationUuid;
    });
  }

  function generateServiceTypesList(billableServices: BillableService[]) {
    const sp: ServicePrice[] = [];
    for (let bs of billableServices) {
      if (bs.servicePrices) {
        const servicePrices = bs.servicePrices;
        for (let servicePrice of servicePrices) {
          sp.push(servicePrice);
        }
      }
    }
    setServicePrices(sp);
  }

  function generateCreateBillDto(): CreateBillDto {
    const payload: CreateBillDto = {
      lineItems: [
        {
          billableService: selectedBillableService.billableService.uuid,
          quantity: 1,
          price: selectedBillableService.price,
          priceName: selectedBillableService.name,
          priceUuid: selectedBillableService.uuid,
          lineItemOrder: 0,
          paymentStatus: 'PENDING',
        },
      ],
      cashPoint: selectedCashPoint.uuid,
      patient: selectedPatient.uuid,
      status: 'PENDING',
      payments: [],
    };
    return payload;
  }
  function isValidCreateBillDto(createBillDto: CreateBillDto): boolean {
    if (!createBillDto.patient) {
      showAlert('error', 'Please select a patient', '');
      return false;
    }
    if (!createBillDto.status) {
      showAlert('error', 'Bill does not have a status', '');
      return false;
    }
    if (!createBillDto.cashPoint) {
      showAlert('error', 'Please select a valid cashpoint', '');
      return false;
    }
    if (!createBillDto.lineItems || createBillDto.lineItems.length === 0) {
      showAlert('error', 'Please select a valid billable service', '');
      return false;
    }
    return true;
  }

  function hasSelectedPaymentMode(paymentMode: string): boolean {
    if (!selectedPaymentMode) {
      return false;
    }
    console.log(selectedPaymentMode);
    return selectedPaymentMode.name.trim().toLowerCase().includes(paymentMode.trim().toLowerCase());
  }

  function generateOrderEncounterPayload(patientUuid: string, visitUuid: string): CreateOrderEncounterDto {
    return {
      patient: patientUuid,
      location: locationUuid,
      encounterType: orderEncounterTypeUuid,
      visit: visitUuid,
      obs: [],
      orders: [
        {
          action: 'NEW',
          type: 'order',
          patient: patientUuid,
          careSetting: outPatientCareSettingUuid,
          orderer: session.currentProvider.uuid ?? 'pd25871c-1359-11df-a1f1-0026b9348838',
          encounter: null,
          concept: getOrderConcept(selectedPaymentMode),
          accessionNumber: null,
          urgency: 'ROUTINE',
          scheduledDate: null,
        },
      ],
    };
  }
  function getOrderConcept(paymentMode: PaymentMode) {
    const paymentModeName = paymentMode.name.toLowerCase().trim();
    if (paymentModeName.includes('cash')) {
      return cashConsulationConceptUuid;
    } else if (paymentModeName.includes('sha')) {
      return shaConsulationConceptUuid;
    } else {
      return '';
    }
  }
  async function createOrder(patientUuid: string, visitUuid: string) {
    const createOrderPayload = generateOrderEncounterPayload(patientUuid, visitUuid);
    try {
      const resp = await createOrderEncounter(createOrderPayload);
      if (resp) {
        showAlert('success', 'Consultation order created', 'Consultation order has been succesfully created');
      }
    } catch (error) {
      showAlert(
        'error',
        'Error creating consulation order',
        'An error occurred while generating the consultation order. Please contact support',
      );
    }
  }

  const handleWhitelistSubmit = async (payload: OTPWhitelistRequest) => {
    return await createOTPWhitelisting(payload);
  };

  const handleSendClaimsOtp = async () => {
    try {
      setSubmitting(true);

      const response = await sendClaimsOTP(patient!.id, locationUuid!, selectedIntervention?.code);

      if (response?.message?.includes('OTP')) {
        setOtpSent(true);

        showSnackbar({
          kind: 'success',
          title: 'OTP Sent',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    try {
      setSubmitting(true);

      setOtpVerified(true);

      setOtp(otp);

      showSnackbar({
        kind: 'success',
        title: 'OTP Verified',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose({ success: false })}
        onRequestClose={() => onModalClose({ success: false })}
        onRequestSubmit={handleSendToTriage}
        primaryButtonText={loading ? 'Sending...please wait' : 'Send to Triage'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!otpVerified || loading}
      >
        <ModalBody>
          <div className={styles.clientDetailsLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Send To Triage</h4>
            </div>
            {patients.length > 0 ? (
              <div className={styles.sectionContent}>
                <div className={styles.patientSelect}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>No</TableHeader>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Gender</TableHeader>
                        <TableHeader>Select Patient</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patients.map((p, index) => (
                        <TableRow key={p.uuid}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{p.person.preferredName.display}</TableCell>
                          <TableCell>{p.person.gender}</TableCell>
                          <TableCell>
                            <Checkbox id={p.uuid} labelText="" onChange={() => onPatientSelect(p)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className={styles.formSection}>
                  <div className={styles.formRow}>
                    <div className={styles.formControl}>
                      <ComboBox
                        onChange={patientTypeHandler}
                        id="patient-type-combobox"
                        items={patientTypeOptions}
                        itemToString={(item) => (item ? item.text : '')}
                        titleText="Patient Type"
                      />
                    </div>
                    <div className={styles.formControl}>
                      <Select
                        id="payment-details"
                        labelText="Payment Details"
                        onChange={($event) => paymentDetailsHandler($event.target.value)}
                      >
                        <SelectItem value="" text="Select" />;
                        {paymentDetails.map((pd) => {
                          return <SelectItem value={pd.id} text={pd.label} />;
                        })}
                      </Select>
                    </div>
                  </div>
                </div>
                <div className={styles.formSection}>
                  {selectedPaymentDetail === PaymentDetail.Paying ? (
                    <>
                      <div className={styles.formRow}>
                        <div className={styles.formControl}>
                          <Select
                            id="payment-method"
                            labelText="Payment Method"
                            onChange={($event) => paymentMethodHandler($event.target.value)}
                          >
                            <SelectItem value="" text="Select" />;
                            {paymentModes &&
                              paymentModes.map((pm) => {
                                return <SelectItem value={pm.uuid} text={pm.name} />;
                              })}
                          </Select>
                        </div>
                        <div className={styles.formControl}>
                          <Select
                            id="billable-service"
                            labelText="Billable Services"
                            onChange={($event) => billableServicesHandler($event.target.value)}
                          >
                            <SelectItem value="" text="Select" />;
                            {filteredBillableServices &&
                              filteredBillableServices.map((sp) => {
                                return (
                                  <SelectItem
                                    value={sp.uuid}
                                    text={`${sp.billableService.display}(${sp.name}:${sp.price})`}
                                  />
                                );
                              })}
                          </Select>
                        </div>
                      </div>
                      {/* If using SHA claim */}
                      {hasSelectedPaymentMode('SHIF') ? (
                        <>
                          {/* <ClaimsComponent clientRegistryId={patientIdentifiers.crIdentifierId} onSelectChange={() => { }} /> */}
                          <ExtensionSlot
                            name="billing-claims-slot"
                            state={{
                              clientRegistryId: patientIdentifiers?.crIdentifierId,
                              patientUuid: selectedPatient!.uuid,
                              triggerCreateVisit,
                              otp,
                              onSelectChange: () => {},
                              onClaimsVisitStart,
                              onInterventionChange: setSelectedIntervention,
                            }}
                          />
                        </>
                      ) : (
                        <></>
                      )}
                      {hasSelectedPaymentMode('insurance') ? (
                        <>
                          <div className={styles.formRow}>
                            <div className={styles.formControl}>
                              <TextInput
                                id="insurance-scheme"
                                labelText="Insurance scheme"
                                onChange={(e) => insuranceSchemeHandler(e.target.value)}
                              />
                            </div>
                            <div className={styles.formControl}>
                              <TextInput
                                id="policy-number"
                                labelText="Policy number"
                                onChange={(e) => insurancePolicyHandler(e.target.value)}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <></>
                      )}
                      <div className={styles.formRow}>
                        <div className={styles.formControl}>
                          <Select
                            id="cash-point"
                            labelText="Cash Point"
                            onChange={($event) => cashPointsHandler($event.target.value)}
                          >
                            <SelectItem value="" text="Select" />;
                            {facilityCashPoints &&
                              facilityCashPoints.map((cp) => {
                                return <SelectItem value={cp.uuid} text={cp.name} />;
                              })}
                          </Select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <></>
                  )}

                  {selectedPaymentDetail === PaymentDetail.NonPaying ? (
                    <>
                      <div className={styles.formRow}>
                        <div className={styles.formControl}>
                          <Select
                            id="patient-category"
                            labelText="Patient Category"
                            onChange={($event) => patientCategoryHandler($event.target.value)}
                          >
                            <SelectItem value="" text="Select" />;
                            <SelectItem value={PatientCategories.CCC_PATIENT_UUID} text="CCC" />;
                            <SelectItem value={PatientCategories.MCH_PATIENT_UUID} text="MCH" />;
                          </Select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <></>
                  )}
                </div>
                <div className={styles.formSection}>
                  <div className={styles.formRow}>
                    <div className={styles.formControl}>
                      <ComboBox
                        onChange={visitTypeChangeHandler}
                        id="visit-type-combobox"
                        items={visitTypeOptions}
                        itemToString={(item) => (item ? item.text : '')}
                        titleText="Visit Type"
                      />
                    </div>
                    <div className={styles.formControl}>
                      <Select id="service" labelText="Select a Queue Service" onChange={serviceChangeHandler}>
                        <SelectItem value="" text="Select" />;
                        {serviceQueues &&
                          serviceQueues.map((sq) => {
                            return <SelectItem value={sq.uuid} text={`${sq.display}`} />;
                          })}
                      </Select>
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formControl}>
                      <Select
                        id="priority"
                        labelText="Select Priority"
                        onChange={($event) => priorityChangeHandler($event.target.value)}
                      >
                        <SelectItem value="" text="Select" />;
                        <SelectItem value={QUEUE_PRIORITIES_UUIDS.NORMAL_PRIORITY_UUID} text="PRIORITY" />;
                        <SelectItem value={QUEUE_PRIORITIES_UUIDS.NOT_URGENT_PRIORITY_UUID} text="NON URGENT" />;
                        <SelectItem value={QUEUE_PRIORITIES_UUIDS.EMERGENCY_PRIORITY_UUID} text="EMERGENCY" />;
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <></>
            )}
            <div className={styles.actionSection}>
              {patients.length === 0 ? (
                <>
                  <div className={styles.patientAction}>
                    <div className={styles.btnContainer}>
                      <Button kind="primary" onClick={() => onCreateAmrsPatient(client)}>
                        Automatically Register in AMRS
                      </Button>
                    </div>
                    <div className={styles.btnContainer}>
                      <Button kind="secondary" onClick={onManualRegistration}>
                        Manually Register
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <></>
              )}
            </div>
            {showConsent && (
              // <ClaimsConsentModal
              //   onSendClaimsOtp={handleSendClaimsOtp}
              //   onWhitelistSubmit={handleWhitelistSubmit}
              //   onWhitelistStatusChange={setIsWhitelisted}
              //   onOtpVerified={() => setOtpVerified(true)}
              // />
              <ClaimsConsentModal
                submitting={submitting}
                otpSent={otpSent}
                whitelistRequest={whitelistRequest}
                onWhitelistSubmit={handleWhitelistSubmit}
                onSendClaimsOtp={handleSendClaimsOtp}
                onOtpVerified={handleVerifyOtp}
                onOtpVerificationStatusChange={setOtpVerified}
              />
            )}
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default SendToTriageModal;
