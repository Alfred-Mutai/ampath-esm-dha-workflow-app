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
import {
  type Patient,
  useVisitTypes,
  useSession,
  showSnackbar,
  type VisitType,
  type Visit,
} from '@openmrs/esm-framework';
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
  type PaymentStatus,
  type CashPoint,
} from '../../../shared/types';
import { PatientCategories } from '../../../shared/constants/patient-category';

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
  const [selectedBillableService, setSelectedBillableService] = useState<ServicePrice>(null);
  const [selectedInsuranceScheme, setSelectedInsuranceScheme] = useState<string>('');
  const [selectedInsurancePolicy, setSelectedInsurancePolicy] = useState<string>('');
  const [selectedPatientCategory, setSelectedPatientCategory] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const visitTypes = useVisitTypes();
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const visitTypeOptions = useMemo(() => generateVisitTypeOptions(), [visitTypes]);

  const facilityCashPoints = useMemo(() => getfacilityCashpoints(), [cashPoints, locationUuid]);

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
  }, [patients]);
  if (!patients) {
    return <>No Client data</>;
  }
  const registerOnAfyaYangu = () => {
    window.open('https://afyayangu.go.ke/', '_blank');
  };
  const sendToTriage = async () => {
    if (!validateVisitQueueBill()) return;
    setLoading(true);
    try {
      // add bill if it was a paying client
      let createBillResp = null;
      if (selectedPaymentDetail === PaymentDetail.Paying) {
        const createBillDto = generateCreateBillDto();
        if (isValidCreateBillDto(createBillDto)) {
          createBillResp = await createBill(createBillDto);
          if (createBillResp) {
            showAlert('success', 'Bill succesfully created', '');
          }
        } else {
          return false;
        }
      }

      const newVisit = await createPatientVisit();
      if (newVisit) {
        const addToTriageQueueDto: QueueEntryDto = generateAddToTriageDto(newVisit);
        const queueEntryResp = await createQueueEntry(addToTriageQueueDto);

        if (queueEntryResp) {
          showAlert('success', 'Patient has succesfully been moved to the Triage queue', '');
        }

        if ((queueEntryResp && PaymentDetail.Paying && createBillResp) || (queueEntryResp && PaymentDetail.NonPaying)) {
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
    if (!selectedPatient) {
      showAlert('error', 'Please select a patient', '');
      return false;
    }
    if (!selectedPaymentDetail) {
      showAlert('error', 'Please select a paying or non paying option', '');
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
  };
  const serviceChangeHandler = ($event: any) => {
    const sq = $event.target.value as unknown as string;
    setSelectedServiceQueue(sq);
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
        if (sp.paymentMode.uuid === paymentMode.uuid) {
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
    setSelectedBillableService(selectedBillableService);
  };
  const cashPointsHandler = (selectedCashPointUuid: string) => {
    const selectedCashPoint = cashPoints.find((cp) => {
      return cp.uuid === selectedCashPointUuid;
    });
    setSelectedCashPoint(selectedCashPoint);
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
    return attributes;
  }

  function generateVisitTypeOptions() {
    return visitTypes.map((vt: VisitType) => {
      return {
        id: vt.uuid,
        text: vt.display,
      };
    });
  }
  async function getServiceQueues() {
    try {
      const sqs = await getFacilityServiceQueues(locationUuid);
      if (sqs.length > 0) {
        setServiceQueues(sqs);
      }
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: 'An error occurred while fetching service queues',
        subtitle: e.message ?? 'An error occurred while fetching service queues, please try agin',
      });
    }
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
    return selectedPaymentMode.name.trim().toLowerCase().includes(paymentMode.trim().toLowerCase());
  }

  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose({ success: false })}
        onRequestClose={() => onModalClose({ success: false })}
        onRequestSubmit={sendToTriage}
        primaryButtonText="Send to Triage"
        secondaryButtonText="Cancel"
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
                        titleText="Select a Visit Type"
                      />
                    </div>
                    <div className={styles.formControl}>
                      <Select id="service" labelText="Select a Queue Service" onChange={serviceChangeHandler}>
                        <SelectItem value="" text="Select" />;
                        {serviceQueues &&
                          serviceQueues.map((sq) => {
                            return <SelectItem value={sq.uuid} text={`${sq.display} (${sq.location.display ?? ''})`} />;
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
                        <SelectItem value={QUEUE_PRIORITIES_UUIDS.NORMAL_PRIORITY_UUID} text="NORMAL" />;
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
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default SendToTriageModal;
