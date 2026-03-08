import React, { useEffect, useMemo, useState } from 'react';
import styles from './visit-billing.extension.scss';
import { Select, SelectItem, TextInput } from '@carbon/react';
import {
  createBill,
  fetchBillableServices,
  fetchCashPoints,
  fetchPaymentModes,
} from '../../../shared/services/billing.resource';
import {
  type ServicePrice,
  type PaymentMode,
  type PayableBillableService,
  type CashPoint,
  type BillableService,
  type CreateBillDto,
} from '../../../shared/types';
import { PaymentDetail, type QueueEntryDto, type ServiceQueue } from '../../../registry/types';
import { PatientCategories } from '../../../shared/constants/patient-category';
import { QUEUE_PRIORITIES_UUIDS, QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { showSnackbar, useSession, useVisit, type Visit } from '@openmrs/esm-framework';

interface VisitBillingFormProps {
  patientUuid: string;
  setExtraVisitInfo: (state) => void;
}
const VisitBillingForm: React.FC<VisitBillingFormProps> = ({ patientUuid, setExtraVisitInfo }) => {
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<string>();
  const [selectedBillableService, setSelectedBillableService] = useState<ServicePrice>(null);
  const [filteredBillableServices, setFilteredBillableServices] = useState<ServicePrice[]>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode>(null);
  const [selectedInsuranceScheme, setSelectedInsuranceScheme] = useState<string>('');
  const [selectedInsurancePolicy, setSelectedInsurancePolicy] = useState<string>('');
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [selectedCashPoint, setSelectedCashPoint] = useState<CashPoint>(null);
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedPatientCategory, setSelectedPatientCategory] = useState<string>('');
  const [selectedServiceQueue, setSelectedServiceQueue] = useState<string>();
  const [serviceQueues, setServiceQueues] = useState<ServiceQueue[]>();
  const [cashPoints, setCashPoints] = useState<CashPoint[]>([]);
  const [billableServices, setBillableServices] = useState<BillableService[]>([]);
  const { currentVisit } = useVisit(patientUuid);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const facilityCashPoints = useMemo(() => getfacilityCashpoints(), [cashPoints, locationUuid]);

  useEffect(() => {
    getPaymentMethods();
    getBillableServices();
    getCashPoints();
  }, []);

  useEffect(() => {
    if (selectedBillableService && selectedCashPoint) {
      setExtraVisitInfo({
        handleCreateExtraVisitInfo: createPatientBill,
        attributes: [],
      });
    }
  }, [selectedBillableService, selectedCashPoint]);

  async function getCashPoints() {
    const cp = await fetchCashPoints();
    setCashPoints(cp);
  }

  async function getBillableServices() {
    const billableServices = await fetchBillableServices();
    setBillableServices(billableServices);
    generateServiceTypesList(billableServices);
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

  async function getPaymentMethods() {
    const methods = await fetchPaymentModes();
    setPaymentModes(methods);
  }
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

  const paymentDetailsHandler = (paymentDetailSelected: string) => {
    setSelectedPaymentDetail(paymentDetailSelected);
  };
  const paymentDetails = Object.values(PaymentDetail).map((value) => {
    return {
      id: value,
      label: value,
    };
  });

  const billableServicesHandler = (selectedBillableServiceUuid: string) => {
    const selectedBillableService = servicePrices.find((sp) => {
      return sp.uuid === selectedBillableServiceUuid;
    });
    setSelectedBillableService(selectedBillableService);
  };

  function hasSelectedPaymentMode(paymentMode: string): boolean {
    if (!selectedPaymentMode) {
      return false;
    }
    return selectedPaymentMode.name.trim().toLowerCase().includes(paymentMode.trim().toLowerCase());
  }
  const insuranceSchemeHandler = (selectedInsuranceScheme: string) => {
    setSelectedInsuranceScheme(selectedInsuranceScheme);
  };

  const insurancePolicyHandler = (selectedInsurancePolicy: string) => {
    setSelectedInsurancePolicy(selectedInsurancePolicy);
  };

  const cashPointsHandler = (selectedCashPointUuid: string) => {
    const selectedCashPoint = cashPoints.find((cp) => {
      return cp.uuid === selectedCashPointUuid;
    });
    setSelectedCashPoint(selectedCashPoint);
  };

  function getfacilityCashpoints() {
    return cashPoints.filter((cp) => {
      return cp && cp.location?.uuid === locationUuid;
    });
  }

  const patientCategoryHandler = (categoryUuid: string) => {
    setSelectedPatientCategory(categoryUuid);
  };

  function validateVisitQueueBill(): boolean {
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
    return true;
  }

  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };

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

  async function createPatientBill() {
    if (!validateVisitQueueBill()) return;
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
    } catch (error) {
      console.log({ error });
    }
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
          uuid: patientUuid,
        },
        startedAt: newVisit.startDatetime,
        sortWeight: 0,
      },
    };
    return payload;
  };

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

  return (
    <>
      <div className={styles.visitLayout}>
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
                          <SelectItem value={sp.uuid} text={`${sp.billableService.display}(${sp.name}:${sp.price})`} />
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
      </div>
    </>
  );
};
export default VisitBillingForm;
