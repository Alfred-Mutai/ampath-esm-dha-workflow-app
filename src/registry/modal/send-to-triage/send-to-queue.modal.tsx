import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ModalBody,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import styles from './send-to-triage.modal.scss';
import {
  useSession,
  showSnackbar,
  type Visit,
  useConfig,
  ExtensionSlot,
  Encounter,
  usePatient,
} from '@openmrs/esm-framework';
import {
  type HieClient,
  type CreateVisitDto,
  type QueueEntryDto,
  type ServiceQueue,
  PaymentDetail,
  type VisitAttribute,
  HieIdentificationType,
  UpdateVisitDto,
} from '../../types';
import { createQueueEntry, getFacilityServiceQueues } from '../../../resources/queue.resource';
import { QUEUE_PRIORITIES_UUIDS, QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { updateVisit } from '../../../resources/visit.resource';
import {
  createBill,
  createOrderBillInHie,
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
import { createOrderEncounter, getOrder } from '../../../shared/services/encounters.resource';
import { type ConfigObject } from '../../../config-schema';
import { type ClaimResult, type Intervention, type VisitType } from '../../../claims';
import { getServiceType } from '../../../shared/services/claims.resource';
import PaymentMethodComponent from './payment-method.component';
import ClaimsConsentExtension from '../otp-verification-modal/extension/claims-consent.extension';

interface SendToQueueModalProps {
  patientUuid: string;
  visitUuid: string;
  visitTypeUuid: string;
  onModalClose?: (modalCloseResp?: { success: boolean }) => void;
}

const SendToQueueModal: React.FC<SendToQueueModalProps> = ({
  patientUuid,
  visitUuid,
  visitTypeUuid,
  onModalClose
}) => {
  const { patient } = usePatient(patientUuid);

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
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [filteredBillableServices, setFilteredBillableServices] = useState<ServicePrice[]>(null);
  const [selectedBillableService, setSelectedBillableService] = useState<ServicePrice | null>(null);
  const [selectedInsuranceScheme, setSelectedInsuranceScheme] = useState<string>('');
  const [selectedInsurancePolicy, setSelectedInsurancePolicy] = useState<string>('');
  const [selectedPatientCategory, setSelectedPatientCategory] = useState<string>('');
  const [currentQueueEntry, setCurrentQueueEntry] = useState<QueueEntry>();
  const [patientBills, setPatientBills] = useState<Bill[]>([]);
  const [billCreated, setBillCreated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [claimResult, setClaimResult] = useState<ClaimResult>();
  const [intervention, setIntervention] = useState<Intervention>();
  const [triggerCreateVisit, setTriggerCreateVisit] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [authGuid, setAuthGuid] = useState("");

  const {
    registrationBillableServices,
    cashConsulationConceptUuid,
    shaConsulationConceptUuid,
    outPatientCareSettingUuid,
    orderEncounterTypeUuid,
    registrationServicequeues,
  } = useConfig<ConfigObject>();

  const facilityCashPoints = useMemo(() => getfacilityCashpoints(), [cashPoints, locationUuid]);

  const paymentDetails = Object.values(PaymentDetail).map((value) => {
    return {
      id: value,
      label: value,
    };
  });

  const visitType: VisitType = useMemo(() => {
    if (visitTypeUuid) {
      if (visitTypeUuid === VisitTypeUuids.OPD_VISIT_TYPE_UUID) {
        return 'OUTPATIENT';
      }
      if (visitTypeUuid === VisitTypeUuids.INPATIENT_VISIT_TYPE_UUID) {
        return 'INPATIENT';
      }
    }
  }, [visitTypeUuid, VisitTypeUuids]);


  const patientIdentifiers = useMemo(() => {
    if (patient) {
      return {
        crIdentifierId: patient.identifier.find(i => i.type.coding[0].code === 'e88dc246-3614-4ee3-8141-1f2a83054e72').value,
        nationalId: patient.identifier.find(i => i.type.coding[0].code === '58a47054-1359-11df-a1f1-0026b9348838').value,
      };
    }
  }, [patient]);

  const consentPatient = useMemo<HieClient>(() => {
    if (patient && patientIdentifiers) {
      return {
        id: String(patientIdentifiers.crIdentifierId),
        first_name: patient.name[0].text,
        identification_type: HieIdentificationType.NationalID,
        identification_number: String(patientIdentifiers.nationalId)
      } as unknown as HieClient;
    }
  }, [patient, patientIdentifiers]);

  useEffect(() => {
    getServiceQueues();
    getPaymentMethods();
    getBillableServices();
    getCashPoints();
    getPatientBills();
    getPatientActiveQueue();
  }, []);

  useEffect(() => {
    if (triggerCreateVisit && claimResult) {
      const fn = async () => {
        await sendToTriage();
        setTriggerCreateVisit(false);
      };
      void fn();
    }
  }, [triggerCreateVisit, claimResult]);

  if (!patient) {
    return <>No Client data</>;
  }

  function onClaimsVisitStart(payload: ClaimResult, selectedIntervention: Intervention) {
    setClaimResult(payload);
    setIntervention(selectedIntervention);
  }

  function onInterventionChange(selectedIntervention: Intervention) {
    setIntervention(selectedIntervention);
  }

  async function getPatientActiveQueue() {
    if (patientUuid) {
      try {
        const resp = await getActiveQueueEntryByPatientUuid(patientUuid);
        setCurrentQueueEntry(resp.length > 0 ? resp[0] : null);
      } catch (error) {
        showAlert('error', 'Error getting patient active queue', '');
      }
    }
  }

  async function getPatientBills() {
    if (patientUuid) {
      const resp = await fetchPatientBills(patientUuid);
      const todaysBills = getTodaysBills(resp);
      setPatientBills(todaysBills);
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

  const sendToTriage = async () => {
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
            const encounter = await createOrder(patientUuid, newVisit.uuid);
            // Add to bill order
            const billOrderDto = await generateBillOrderDto(encounter, createBillResp);
            await createOrderBillInHie(billOrderDto);
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
      showAlert('error', error.message ?? 'Error creating visit', '');
    } finally {
      setLoading(false);
    }
  };
  function validateVisitQueueBill(): boolean {
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
          uuid: QUEUE_PRIORITIES_UUIDS.NORMAL_PRIORITY_UUID,
        },
        queue: {
          uuid: selectedServiceQueue,
        },
        patient: {
          uuid: patientUuid,
        },
        startedAt: newVisit.startDatetime,
        sortWeight: 0,
      },
    };
    return payload;
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
    const sB = servicePrices.find((sp) => {
      return sp.uuid === selectedBillableServiceUuid;
    });
    if (isValidBillableService(sB)) {
      setSelectedBillableService(sB);
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
    const visitDto = getUpdateVisitDto();
    const result = await updateVisit(visitUuid, visitDto);
    if (result) {
      showAlert('success', 'Visit has been updated succesfully', '');
      return result;
    } else {
      showAlert('error', 'Error updating patient visit', '');
      throw new Error('Error updating patient visit');
    }
  };
  const getUpdateVisitDto = (): UpdateVisitDto => {
    const visitAttributes = getVisitAttributes();
    const visitDto: UpdateVisitDto = {};
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
      patient: patientUuid,
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
    if (paymentModeName.includes('cash') || paymentModeName.includes('mpesa')) {
      return cashConsulationConceptUuid;
    }
    return shaConsulationConceptUuid;
  }
  async function createOrder(patientUuid: string, visitUuid: string) {
    const createOrderPayload = generateOrderEncounterPayload(patientUuid, visitUuid);
    try {
      const resp = await createOrderEncounter(createOrderPayload);
      if (resp) {
        showAlert('success', 'Consultation order created', 'Consultation order has been succesfully created');
      }
      return resp;
    } catch (error) {
      showAlert(
        'error',
        'Error creating consulation order',
        'An error occurred while generating the consultation order. Please contact support',
      );
    }
  }

  async function generateBillOrderDto(encounter: Encounter, createdBillResp: any) {
    try {
      const orders = encounter?.orders;

      if (orders && orders.length && createdBillResp) {
        let order1 = orders[0];
        let order = await getOrder(order1?.uuid);
        const orderNumber = order?.orderNumber;
        const billUuid = createdBillResp?.uuid;
        const lineItemUuid = (() => {
          if (createdBillResp?.lineItems && createdBillResp?.lineItems?.length) {
            const lineItem = createdBillResp?.lineItems?.[0];

            return lineItem?.uuid as string;
          }
          return '';
        })();

        let payload = {
          bill_uuid: billUuid,
          order_no: orderNumber,
          line_item_uuid: lineItemUuid,
        };

        if (claimResult && intervention) {
          const interventionResult = intervention;
          const electivePreauth =
            interventionResult.requiresOncologyPreauth ||
            interventionResult.requiresOpticalPreauth ||
            interventionResult.requiresRadiologyPreauth ||
            interventionResult.requiresRenalPreauth ||
            interventionResult.requiresSurgicalPreauth;
          const requiresPreauth = interventionResult.needsPreauth;
          const requiredPreauthDocumentTypes = interventionResult.requiredPreauthDocumentTypes;
          const applicableDocumentTypes = interventionResult.applicableDocumentTypes;

          let interventionPayload = {
            intervention_code: interventionResult.code,
            consent_token: claimResult.authorization_code,
            service_type: getServiceType(interventionResult, visitType),
            requires_preauth: requiresPreauth,
            normal_preauth: requiresPreauth && !electivePreauth,
            elective_preauth: interventionResult.needsManualPreauthApproval && electivePreauth,
          };

          if (applicableDocumentTypes && applicableDocumentTypes.length) {
            interventionPayload['applicable_document_types'] = applicableDocumentTypes.join(',');
          }

          if (requiredPreauthDocumentTypes && requiredPreauthDocumentTypes.length) {
            interventionPayload['required_preauth_document_types'] = requiredPreauthDocumentTypes.join(',');
          }

          payload = {
            ...payload,
            ...interventionPayload,
          };
        }

        return payload;
      }
    } catch (error) { }
  }


  const handleSecondaryAction = () => {
    onModalClose({ success: false });
  };

  const handleprimaryAction = async () => {
    await handleSendClientToTriage();
  };

  const handleSendClientToTriage = async () => {
    if (hasSelectedPaymentMode('SHA')) {
      if (claimResult) {
        await sendToTriage();
      } else {
        setTriggerCreateVisit(true);
      }
      return;
    }
    await sendToTriage();
  };


  function onClientConsent({ otp, authGuid }: { otp?: string, authGuid?: string }) {
    if (otp) {
      setOtp(otp);
      setOtpVerified(true);
    }
    if (authGuid) {
      setAuthGuid(authGuid);
    }
  }

  return (
    <>
      <>
        <Modal
          open={true}
          size="md"
          onSecondarySubmit={handleSecondaryAction}
          onRequestClose={() => onModalClose({ success: false })}
          onRequestSubmit={handleprimaryAction}
          primaryButtonText={loading ? 'Sending...please wait' : 'Save'}
          secondaryButtonText={'Cancel'}
          primaryButtonDisabled={loading || !otpVerified}
        >
          <ModalBody>
            <div className={styles.clientDetailsLayout}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Add Billing Details</h4>
              </div>

              {patient && (
                <div className={styles.sectionContent}>
                  <>
                    <div className={styles.formSection}>
                      <div className={styles.formRow}>
                        <div className={styles.formControl}>
                          <Select id="service" labelText="Select a Queue Service" onChange={serviceChangeHandler}>
                            <SelectItem value="" text="Select" />
                            {serviceQueues?.map((sq) => (
                              <SelectItem key={sq.uuid} value={sq.uuid} text={sq.display} />
                            ))}
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className={styles.formSection}>
                      <div className={styles.formRow}>
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
                        <div className={styles.formControl}>
                          <Select
                            id="cash-point"
                            labelText="Cash Point"
                            onChange={(e) => cashPointsHandler(e.target.value)}
                          >
                            <SelectItem value="" text="Select" />
                            {facilityCashPoints?.map((cp) => (
                              <SelectItem key={cp.uuid} value={cp.uuid} text={cp.name} />
                            ))}
                          </Select>
                        </div>
                      </div>
                    </div>

                    <>
                      {selectedPaymentDetail === PaymentDetail.Paying && (
                        <PaymentMethodComponent
                          paymentMethodHandler={paymentMethodHandler}
                          paymentModes={paymentModes}
                          billableServicesHandler={billableServicesHandler}
                          filteredBillableServices={filteredBillableServices}
                        />
                      )}
                    </>

                    {selectedPaymentDetail === PaymentDetail.Paying && (
                      <>
                        {hasSelectedPaymentMode('insurance') && (
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
                        )}
                      </>
                    )}

                    {selectedPaymentDetail === PaymentDetail.NonPaying && (
                      <div className={styles.formRow}>
                        <div className={styles.formControl}>
                          <Select
                            id="patient-category"
                            labelText="Patient Category"
                            onChange={(e) => patientCategoryHandler(e.target.value)}
                          >
                            <SelectItem value="" text="Select" />
                            <SelectItem value={PatientCategories.CCC_PATIENT_UUID} text="CCC" />
                            <SelectItem value={PatientCategories.MCH_PATIENT_UUID} text="MCH" />
                          </Select>
                        </div>
                      </div>
                    )}

                  </>

                  {selectedPaymentDetail === PaymentDetail.Paying && (
                    <>
                      {hasSelectedPaymentMode('SHA') && (
                        <ExtensionSlot
                          name="billing-claims-slot"
                          state={{
                            clientRegistryId: patientIdentifiers?.crIdentifierId,
                            patientUuid: patientUuid,
                            triggerCreateVisit,
                            otp,
                            authGuid,
                            visitType,
                            onSelectChange: () => { },
                            onClaimsVisitStart,
                            onInterventionChange,
                          }}
                        />
                      )}
                      {
                        (consentPatient && intervention) &&
                        <ClaimsConsentExtension patient={consentPatient}
                          intervention={intervention}
                          crIdentifierId={patientIdentifiers.crIdentifierId}
                          visitType={visitType}
                          onClientConsent={onClientConsent} />
                      }
                    </>
                  )}
                </div>
              )}
            </div>
          </ModalBody>
        </Modal>
      </>
    </>
  );
};

export default SendToQueueModal;
