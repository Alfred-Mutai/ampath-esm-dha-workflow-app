import React, { useEffect, useMemo, useState } from 'react';
import { Button, ComboBox, Select, SelectItem, Tag, TextInput } from '@carbon/react';
import { Close } from '@carbon/react/icons';
import styles from './send-to-triage.modal.scss';
import {
  useSession,
  showSnackbar,
  type Visit,
  useConfig,
  ExtensionSlot,
  Encounter,
  usePatient,
  useVisit,
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
import { ClientSubBenefit, type ClaimResult, type Intervention, type VisitType } from '../../../claims';
import { getServiceType } from '../../../shared/services/claims.resource';
import PaymentMethodComponent from './payment-method.component';
import ClaimsConsentExtension from '../otp-verification-modal/extension/claims-consent.extension';

interface SendToQueueModalProps {
  patientUuid: string;
  visitUuid: string;
  visitTypeUuid: string;
  onModalClose?: (modalCloseResp?: { success: boolean }) => void;
}

// Select the field's text on focus so typing replaces the (preselected) value.
const selectInputText = (e: React.FocusEvent<HTMLElement>) => {
  const input = e.target as HTMLInputElement;
  if (input?.tagName === 'INPUT') {
    input.select();
  }
};

const SendToQueueModal: React.FC<SendToQueueModalProps> = ({ patientUuid, visitUuid, visitTypeUuid, onModalClose }) => {
  const { patient } = usePatient(patientUuid);
  const [selectedPatientType, setSelectedPatientType] = useState<string>();
  const [cashPoints, setCashPoints] = useState<CashPoint[]>([]);
  const [selectedCashPoint, setSelectedCashPoint] = useState<CashPoint>(null);
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [filteredBillableServices, setFilteredBillableServices] = useState<ServicePrice[]>(null);
  const [selectedBillableService, setSelectedBillableService] = useState<ServicePrice | null>(null);
  const [selectedPatientCategory, setSelectedPatientCategory] = useState<string>('');
  const [patientBills, setPatientBills] = useState<Bill[]>([]);
  const [billCreated, setBillCreated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [claimResult, setClaimResult] = useState<ClaimResult>();
  const [intervention, setIntervention] = useState<Intervention>();
  const [selectedSubBenefit, setSelectedSubBenefit] = useState<ClientSubBenefit>();
  const [triggerCreateVisit, setTriggerCreateVisit] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [authGuid, setAuthGuid] = useState('');
  const { activeVisit } = useVisit(patientUuid);

  const {
    registrationBillableServices,
    cashConsulationConceptUuid,
    shaConsulationConceptUuid,
    outPatientCareSettingUuid,
    orderEncounterTypeUuid,
    registrationServicequeues,
    shaPaymentModeUuid
  } = useConfig<ConfigObject>();

  const facilityCashPoints = useMemo(() => getfacilityCashpoints(), [cashPoints, locationUuid]);

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
        crIdentifierId: patient.identifier.find((i) => i.type.coding[0].code === 'e88dc246-3614-4ee3-8141-1f2a83054e72')
          ?.value,
        nationalId: patient.identifier.find((i) => i.type.coding[0].code === '58a47054-1359-11df-a1f1-0026b9348838')
          ?.value,
      };
    }
  }, [patient]);

  const consentPatient = useMemo<HieClient>(() => {
    if (patient && patientIdentifiers) {
      return {
        id: String(patientIdentifiers.crIdentifierId),
        first_name: patient.name[0].text,
        identification_type: HieIdentificationType.NationalID,
        identification_number: String(patientIdentifiers.nationalId),
      } as unknown as HieClient;
    }
  }, [patient, patientIdentifiers]);

  const selectedPaymentMode = useMemo(() => {
    if (activeVisit) {
      const paymentMode =
        activeVisit.attributes?.find((atr) => atr?.attributeType?.uuid === '8553afa0-bdb9-4d3c-8a98-05fa9350aa85')
          ?.value ?? '';
      return paymentMode;
    }
    return '';
  }, [activeVisit]);

  const selectedPaymentDetail: PaymentDetail = useMemo(() => {
    if (activeVisit) {
      const paymentDetail =
        activeVisit.attributes?.find((atr) => atr?.attributeType?.uuid === 'df0362f9-782e-4d92-8bb2-3112e9e9eb3c')
          ?.value ?? '';
      if (paymentDetail) {
        return PaymentDetail.NonPaying;
      }
    }
    return PaymentDetail.Paying;
  }, [activeVisit]);

  useEffect(() => {
    getBillableServices();
    getCashPoints();
    getPatientBills();
  }, []);

  useEffect(() => {
    if (selectedPaymentMode && servicePrices) {
      const paymentModeBillableServices = getBillableServiceByPaymentMode(selectedPaymentMode, servicePrices);
      setFilteredBillableServices(paymentModeBillableServices);
    }
  }, [selectedPaymentMode, servicePrices]);

  // Preselect the first cash point for the logged-in location (default index 0).
  useEffect(() => {
    if (!selectedCashPoint && facilityCashPoints?.length) {
      setSelectedCashPoint(facilityCashPoints[0]);
    }
  }, [facilityCashPoints, selectedCashPoint]);

  // Preselect the first billable service for the payment mode (default index 0).
  useEffect(() => {
    if (!selectedBillableService && filteredBillableServices?.length) {
      setSelectedBillableService(filteredBillableServices[0]);
    }
  }, [filteredBillableServices, selectedBillableService]);

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

  function onClaimsVisitStart(payload: ClaimResult, selectedIntervention: Intervention, subBenefit: ClientSubBenefit, usePreselectedIntervention: boolean) {
    if(usePreselectedIntervention) {
      setBillCreated(true);
      showAlert('success', 'Bill succesfully updated', '');
      onModalClose({ success: true });
    }
    setClaimResult(payload);
    setIntervention(selectedIntervention);
    setSelectedSubBenefit(subBenefit);
  }

  function onInterventionChange(selectedIntervention: Intervention) {
    setIntervention(selectedIntervention);
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
        // const addToTriageQueueDto: QueueEntryDto = generateAddToTriageDto(newVisit);
        // const queueEntryResp = await createQueueEntry(addToTriageQueueDto);

        // if (queueEntryResp) {
        //   showAlert('success', 'Patient has succesfully been moved to the Triage queue', '');
        // }

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

        if ((PaymentDetail.Paying && (createBillResp || billCreated)) || PaymentDetail.NonPaying) {
          onModalClose({ success: true });
        }
      }
    } catch (error) {
      showAlert('error', error.message ?? 'Error creating visit', '');
    } finally {
      setLoading(false);
    }
  };
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
          uuid: '', //selectedServiceQueue,
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

  function getBillableServiceByPaymentMode(
    paymentModeUuid: string,
    servicePrices: ServicePrice[],
  ): PayableBillableService[] {
    const paymentBillableServices: ServicePrice[] = [];
    servicePrices.forEach((sp) => {
      if (sp.paymentMode) {
        if (sp.paymentMode.uuid === paymentModeUuid && registrationBillableServices.includes(sp.billableService.uuid)) {
          paymentBillableServices.push(sp);
        }
      }
    });
    return paymentBillableServices;
  }
  const billableServicesHandler = (selectedBillableServiceUuid: string) => {
    const sB = servicePrices.find((sp) => {
      return sp.uuid === selectedBillableServiceUuid;
    });
    if (isValidBillableService(sB)) {
      setSelectedBillableService(sB);
    } else {
      setSelectedBillableService(sB);
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
    if (selectedPatientType) {
      attributes.push({
        attributeType: 'fbc0702d-b4c9-4968-be63-af8ad3ad6239',
        value: selectedPatientType,
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
          status: 'PENDING',
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
    if (paymentMode.trim().toUpperCase() === 'SHA') {
      return selectedPaymentMode === shaPaymentModeUuid;
    }
    return false;
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
          concept: getOrderConcept(),
          accessionNumber: null,
          urgency: 'ROUTINE',
          scheduledDate: null,
        },
      ],
    };
  }
  function getOrderConcept() {
    if (hasSelectedPaymentMode('SHA')) {
      return shaConsulationConceptUuid;
    }
    return cashConsulationConceptUuid;
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
            sub_benefit_code: selectedSubBenefit ? selectedSubBenefit.code : "",
            intervention_code: interventionResult.code,
            consent_token: claimResult.authorization_code,
            service_type: getServiceType(interventionResult, visitType),
            requires_preauth: requiresPreauth,
            normal_preauth: requiresPreauth && !electivePreauth,
            elective_preauth: interventionResult.needsManualPreauthApproval && electivePreauth,
          };

          if (patientUuid) {
            intervention["patient_uuid"] = patientUuid;
          }

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
    } catch (error) {}
  }

  const handleSecondaryAction = () => {
    onModalClose({ success: false });
  };

  const handleprimaryAction = async () => {
    await handleSendClientToTriage();
  };

  const handleSendClientToTriage = async () => {
    if (isSha) {
      if (claimResult) {
        await sendToTriage();
      } else {
        setTriggerCreateVisit(true);
      }
      return;
    }
    await sendToTriage();
  };

  function onClientConsent({ otp, authGuid }: { otp?: string; authGuid?: string }) {
    // eslint-disable-next-line no-console
    console.log('AUTH GUID: ', authGuid);
    if (otp) {
      setOtp(otp);
      setOtpVerified(true);
    }
    if (authGuid) {
      // eslint-disable-next-line no-console
      console.log('AUTH GUID: ', authGuid);
      setAuthGuid(authGuid);
    }
  }

  // eslint-disable-next-line no-console
  console.log('PARENT PARENT: ', authGuid);

  const isSha = hasSelectedPaymentMode('SHA');
  const patientName = patient?.name?.[0]?.text ?? '';
  const crNumber = patientIdentifiers?.crIdentifierId ?? '';
  const consentSatisfied = otpVerified || !!authGuid;

  return (
    <>
      {/* The drawer does not close on overlay click — use Cancel/Close to avoid losing progress. */}
      <div className={styles.overlay} />
      <aside className={styles.drawer} role="dialog" aria-label="Initiate SHA claim">
        <header className={styles.drawerHeader}>
          <div className={styles.drawerHeaderText}>
            <h4 className={styles.drawerTitle}>Initiate SHA claim</h4>
            {patientName ? (
              <p className={styles.drawerSubtitle}>
                <span className={styles.drawerPatient}>{patientName}</span>
                {crNumber ? (
                  <span className={styles.drawerCr}>{/^cr/i.test(crNumber) ? crNumber : `CR ${crNumber}`}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Close"
            renderIcon={Close}
            onClick={handleSecondaryAction}
          />
        </header>

        <div className={styles.drawerBody}>
          {patient && (
            <>
              <section className={styles.drawerSection}>
                <h5 className={styles.drawerSectionTitle}>
                  Billing details
                  {isSha ? (
                    <Tag size="sm" type="teal">
                      SHA
                    </Tag>
                  ) : null}
                </h5>
                <div className={styles.formRow}>
                  {/* Selecting all on focus makes typing replace the value (search); Backspace
                      on the untouched label clears the whole selection — no partial deletion. */}
                  <div
                    className={styles.formControl}
                    onFocusCapture={selectInputText}
                    onKeyDownCapture={(e) => {
                      if (!selectedCashPoint || e.ctrlKey || e.metaKey || e.altKey) {
                        return;
                      }
                      const showingLabel = (e.target as HTMLInputElement)?.value === (selectedCashPoint.name ?? '');
                      if (showingLabel && (e.key === 'Backspace' || e.key === 'Delete')) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedCashPoint(null);
                      }
                    }}
                  >
                    <ComboBox
                      id="cash-point"
                      titleText="Cash point"
                      placeholder="Search cash point"
                      items={facilityCashPoints ?? []}
                      itemToString={(item) => item?.name ?? ''}
                      shouldFilterItem={({ item, inputValue }) => {
                        const selectedLabel = selectedCashPoint?.name ?? '';
                        if (!inputValue || inputValue === selectedLabel) {
                          return true;
                        }
                        return (item?.name ?? '').toLowerCase().includes(inputValue.toLowerCase());
                      }}
                      selectedItem={selectedCashPoint ?? null}
                      onChange={({ selectedItem }) => setSelectedCashPoint(selectedItem ?? null)}
                    />
                  </div>
                  <div
                    className={styles.formControl}
                    onFocusCapture={selectInputText}
                    onKeyDownCapture={(e) => {
                      if (!selectedBillableService || e.ctrlKey || e.metaKey || e.altKey) {
                        return;
                      }
                      const label = `${selectedBillableService.billableService.display} (${selectedBillableService.name}: ${selectedBillableService.price})`;
                      const showingLabel = (e.target as HTMLInputElement)?.value === label;
                      if (showingLabel && (e.key === 'Backspace' || e.key === 'Delete')) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedBillableService(null);
                      }
                    }}
                  >
                    <ComboBox
                      id="billable-service"
                      titleText="Billable service"
                      placeholder="Search billable service"
                      items={filteredBillableServices ?? []}
                      itemToString={(item) =>
                        item ? `${item.billableService.display} (${item.name}: ${item.price})` : ''
                      }
                      shouldFilterItem={({ item, inputValue }) => {
                        const selectedLabel = selectedBillableService
                          ? `${selectedBillableService.billableService.display} (${selectedBillableService.name}: ${selectedBillableService.price})`
                          : '';
                        if (!inputValue || inputValue === selectedLabel) {
                          return true;
                        }
                        const text = item
                          ? `${item.billableService.display} ${item.name} ${item.price}`.toLowerCase()
                          : '';
                        return text.includes(inputValue.toLowerCase());
                      }}
                      selectedItem={selectedBillableService ?? null}
                      onChange={({ selectedItem }) =>
                        selectedItem ? billableServicesHandler(selectedItem.uuid) : setSelectedBillableService(null)
                      }
                    />
                  </div>
                </div>

                {selectedPaymentDetail === PaymentDetail.NonPaying && (
                  <div className={styles.formRow} style={{ marginTop: '1rem' }}>
                    <div className={styles.formControl}>
                      <Select
                        id="patient-category"
                        labelText="Patient category"
                        onChange={(e) => patientCategoryHandler(e.target.value)}
                      >
                        <SelectItem value="" text="Select" />
                        <SelectItem value={PatientCategories.CCC_PATIENT_UUID} text="CCC" />
                        <SelectItem value={PatientCategories.MCH_PATIENT_UUID} text="MCH" />
                      </Select>
                    </div>
                  </div>
                )}
              </section>

              {selectedPaymentDetail === PaymentDetail.Paying && isSha && (
                <section className={styles.drawerSection}>
                  <h5 className={styles.drawerSectionTitle}>SHA claim details</h5>
                  <p className={styles.drawerSectionHint}>Select the sub-benefit and intervention for this consultation.</p>
                  <ExtensionSlot
                    name="billing-claims-slot"
                    state={{
                      clientRegistryId: patientIdentifiers?.crIdentifierId,
                      patientUuid: patientUuid,
                      triggerCreateVisit,
                      otp,
                      authGuid,
                      visitType,
                      onSelectChange: () => {},
                      onClaimsVisitStart,
                      onInterventionChange,
                    }}
                  />
                </section>
              )}

              {selectedPaymentDetail === PaymentDetail.Paying && consentPatient && intervention && (
                <section className={styles.consentSection}>
                  <h5 className={styles.drawerSectionTitle}>Client consent</h5>
                  <ClaimsConsentExtension
                    patient={consentPatient}
                    intervention={intervention}
                    crIdentifierId={patientIdentifiers.crIdentifierId}
                    visitType={visitType}
                    onClientConsent={onClientConsent}
                    onAuthGuidReceived={setAuthGuid}
                  />
                </section>
              )}
            </>
          )}
        </div>

        <footer className={styles.drawerFooter}>
          <Button kind="secondary" size="sm" onClick={handleSecondaryAction} disabled={loading}>
            Cancel
          </Button>
          <Button
            kind="primary"
            size="sm"
            onClick={handleprimaryAction}
            disabled={loading || (isSha && !consentSatisfied)}
          >
            {loading ? 'Starting…' : 'Start claim visit'}
          </Button>
        </footer>
      </aside>
    </>
  );
};

export default SendToQueueModal;
