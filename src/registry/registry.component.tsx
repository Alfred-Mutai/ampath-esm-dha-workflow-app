import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Dropdown,
  Layer,
  Loading,
  RadioButton,
  Tag,
  TextInput,
} from '@carbon/react';
import {
  Search,
  SearchLocate,
  WarningAlt,
  WarningAltFilled,
  UserMultiple,
  Identification,
  CheckmarkOutline,
  Close,
} from '@carbon/react/icons';
import React, { useState } from 'react';
import styles from './registry.component.scss';
import {
  type ClientRegistrySearchRequest,
  type CreateVisitDto,
  type HieClient,
  IDENTIFIER_TYPES,
  type IdentifierType,
  type RequestCustomOtpDto,
  type VisitAttribute,
} from './types';
import { createVisit } from '../resources/visit.resource';
import { VisitTypeUuids } from '../shared/constants/visit-types';
import {
  createConsultationClearance,
  findOpenPrepaidService,
  fulfillPrepaidService,
} from '../shared/services/consultation-clearance.resource';
import { fetchClientRegistryData } from './registry.resource';
import { type Patient, showSnackbar, useSession } from '@openmrs/esm-framework';
import OtpVerificationModal from './modal/otp-verification-modal/otp-verification-modal';
import { maskCrNumber, maskExceptFirstAndLast } from './utils/mask-data';
import ClientDetailsModal from './modal/client-details-modal/client-details-modal';
import { searchPatientByCrNumber } from '../resources/patient-search.resource';
import SendToTriageModal from './modal/send-to-triage/send-to-triage.modal';
import WorkflowDrawer from './drawer/workflow-drawer.component';
import { registerHieClientInAmrs } from '../resources/hie-amrs-automatic-registration.service';
import { getErrorMessages, getReadableErrorMessage } from './utils/error-handler';
import { IdentifierTypesUuids } from '../resources/identifier-types';
import { formatPhoneNumberForOTP } from './utils/phone-number-formatter';
import { usePatient } from '../context/patient-context';
import StartPatientVisitModal from './modal/start-patient-visit/start-patient-visit.modal';

interface RegistryComponentProps {}
const RegistryComponent: React.FC<RegistryComponentProps> = () => {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('National ID');
  const [identifierValue, setIdentifierValue] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [notFound, setNotFound] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [principal, setPrincipal] = useState<HieClient>();
  const [amrsPatients, setAmrsPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('principal');
  const [displayOtpModal, setDisplayOtpModal] = useState<boolean>(false);
  const [displayClientDetailsModal, setDisplayClientDetailsModal] = useState<boolean>(false);
  const [displaytStartVisitModal, setdisplaytStartVisitModal] = useState<boolean>(false);
  const [requestCustomOtpDto, setRequestCustomOtpDto] = useState<RequestCustomOtpDto>();
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  const { setPatient } = usePatient();

  const validateForm = (): string => {
    const value = identifierValue.trim();
    if (!value) {
      return `${identifierType} value is required`;
    }
    if (value.length < 4) {
      return `Enter a valid ${identifierType.toLowerCase()} (minimum 4 characters)`;
    }
    if (identifierType === 'National ID' && !/^\d+$/.test(value)) {
      return 'National ID must contain digits only';
    }
    if (!locationUuid) {
      return 'No default location selected. Please set your session location.';
    }
    return '';
  };

  const handleSearchPatient = async () => {
    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError('');
    setNotFound(false);
    setFetchError('');
    setLoading(true);
    try {
      const searchClientPayload = getSearchClientDto();

      if (!isValidSeatchClientPayload(searchClientPayload)) return false;

      const result = await fetchClientRegistryData(searchClientPayload);
      const patients = Array.isArray(result) ? result : [];

      if (patients.length === 0) {
        setPrincipal(null);
        setNotFound(true);
        return;
      }

      const patient = patients[0];
      setPatient(patient);
      setPrincipal(patient);
    } catch (err: any) {
      // Communicate the failure on the page (keep the worker's input so they can retry).
      const errorMessage = getReadableErrorMessage(err, 'We couldn’t reach the Client Registry.');
      setPrincipal(null);
      setFetchError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getSearchClientDto = (): ClientRegistrySearchRequest => {
    return {
      identificationNumber: identifierValue.trim(),
      identificationType: identifierType,
      locationUuid,
    };
  };

  const isValidSeatchClientPayload = (payload: ClientRegistrySearchRequest): boolean => {
    if (!payload.identificationNumber) {
      showAlert('error', 'Please enter a valid identification number', '');
      return false;
    }
    if (!payload.identificationType) {
      showAlert('error', 'Please enter a valid identification type', '');
      return false;
    }
    if (!payload.locationUuid) {
      showAlert('error', 'No default location selected', '');
      return false;
    }
    return true;
  };

  const generateCustomSmsPayload = (): RequestCustomOtpDto => {
    return {
      identificationNumber: identifierValue,
      identificationType: identifierType,
      locationUuid,
      phoneNumber: principal?.phone ? formatPhoneNumberForOTP(principal.phone ?? '') : '',
    };
  };

  const isValidCustomSmsPayload = (payload: RequestCustomOtpDto): boolean => {
    if (!payload.identificationNumber) {
      showAlert('error', 'Please enter a valid identification number', '');
      return false;
    }
    if (!payload.identificationType) {
      showAlert('error', 'Please enter a valid identification type', '');
      return false;
    }
    if (!payload.locationUuid) {
      showAlert('error', 'No default location selected', '');
      return false;
    }
    if (!payload.phoneNumber) {
      showAlert('error', 'No phone number selected', '');
      return false;
    }
    return true;
  };
  const showAlert = (alertType: 'error' | 'success' | 'info' | 'warning', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };
  const handleSelectedPatient = (sp: string) => {
    setSelectedPatient(sp);
  };
  const handleOtpVerification = () => {
    const smsPayload = generateCustomSmsPayload();
    if (isValidCustomSmsPayload(smsPayload)) {
      setRequestCustomOtpDto(smsPayload);
      setDisplayOtpModal(true);
    }
  };
  const handleClearIdentifier = () => {
    setIdentifierValue('');
    setValidationError('');
    setNotFound(false);
  };
  const handleModelClose = () => {
    setDisplayOtpModal(false);
  };
  const onClientDetailsModalClose = () => {
    onClientDetailsModalClose();
    setDisplayClientDetailsModal(false);
  };
  const handleClientDetailsSubmit = async (crId: string) => {
    setDisplayClientDetailsModal(false);
    await searchAmrsPatient(crId);
    setdisplaytStartVisitModal(true);
  };
  const handleEmergencyRegistration = () => {
    window.location.href = `${window.spaBase}/patient-registration`;
  };
  const handleManualRegistration = () => {
    setdisplaytStartVisitModal(false);
    handleEmergencyRegistration();
  };
  const searchAmrsPatient = async (crId: string) => {
    const resp = await searchPatientByCrNumber(crId);
    if (resp.totalCount > 0) {
      showAlert(
        'success',
        `Patient with ${crId} found`,
        '',
      );
      const validPatients = validateAmrsPatient(crId, resp.results ?? []);
      setAmrsPatients(validPatients);
    } else {
      showAlert('error', 'Patient not found in the system', '');
      setAmrsPatients([]);
    }
  };
  const validateAmrsPatient = (crNo: string, patients: Patient[]) => {
    return patients.filter((p) => {
      return p.identifiers.some((id) => {
        return id.identifier === crNo && id.identifierType.uuid === IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID;
      });
    });
  };
  const onSendToTriageModalClose = (modalCloseResp?: { success: boolean }) => {
    setdisplaytStartVisitModal(false);
    if (modalCloseResp && modalCloseResp.success) {
      window.location.href = `${window.spaBase}/home/triage`;
    }
  };
  const handleSendToTriageModalSubmit = () => {};
  const getPatient = (): HieClient => {
    if (!principal || selectedPatient === 'principal') {
      return principal;
    }
    const match = principal.dependants?.find((d) => d.result[0].id === selectedPatient);
    return match ? (match.result[0] as unknown as HieClient) : principal;
  };
  const createAmrsPatient = async () => {
    const patient = getPatient();
    if (!patient) {
      showAlert('error', 'Principal or dependant not selected', '');
      return;
    }
    try {
      const resp = await registerHieClientInAmrs(patient, locationUuid);
      if (resp) {
        showAlert('success', 'Patient created succesfully', '');
        setAmrsPatients([resp]);
      }
    } catch (e) {
      const errorResp = e['responseBody'] ?? e.message;
      showAlert('error', 'Error Creating Patient', '');
      const errors = getErrorMessages(errorResp);
      if (errors && errors.length > 0) {
        for (let error of errors) {
          showAlert('error', error, '');
        }
      }
    }
  };
  const handleCancel = () => {
    setPrincipal(null);
    setAmrsPatients([]);
    setSelectedPatient(null);
    setIdentifierValue('');
    setValidationError('');
    setNotFound(false);
    setFetchError('');
    setIdentifierType('National ID');
    setDisplayClientDetailsModal(false);
    setDisplayOtpModal(false);
    setdisplaytStartVisitModal(false);
    setSelectedPatient('principal');
  };
  const handleOtpSuccessfullVerification = () => {
    setDisplayOtpModal(false);
    setDisplayClientDetailsModal(true);
  };
  return (
    <>
      <div className={styles.registryLayout}>
        <div className={styles.mainContent}>
          <div className={styles.registryHeader}>
            <h4>Registration</h4>
            <p>Please enter identification number to begin</p>
          </div>
          <div className={styles.registryContent}>
            <Layer className={styles.card}>
              <div className={styles.sectionHeader}>
                <Identification size={20} className={styles.sectionIcon} />
                <h5 className={styles.sectionTitle}>Search client</h5>
              </div>
              <p className={styles.formIntro}>
                Search the national Client Registry by identification number to begin.
              </p>
              <div className={styles.formGrid}>
                <Dropdown
                  id="identifier-type-dropdown"
                  label="Select identifier type"
                  titleText={
                    <span className={styles.fieldLabel}>
                      Identifier type<span className={styles.required}>*</span>
                    </span>
                  }
                  items={IDENTIFIER_TYPES}
                  selectedItem={identifierType}
                  onChange={({ selectedItem }) => {
                    const nextType = selectedItem as IdentifierType;
                    setIdentifierType(nextType);
                    if (!identifierValue.trim()) {
                      setValidationError(`${nextType} number is required`);
                    } else {
                      setValidationError('');
                    }
                  }}
                />
                <div className={styles.clearableInput}>
                  <TextInput
                    id="identifier-value"
                    labelText={
                      <span className={styles.fieldLabel}>
                        {identifierType} number<span className={styles.required}>*</span>
                      </span>
                    }
                    value={identifierValue}
                    onChange={(e) => {
                      setIdentifierValue(e.target.value);
                      if (validationError) {
                        setValidationError('');
                      }
                      if (notFound) {
                        setNotFound(false);
                      }
                    }}
                    onBlur={() => {
                      if (!identifierValue.trim()) {
                        setValidationError(`${identifierType} number is required`);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchPatient();
                      }
                    }}
                    invalid={!!validationError}
                    invalidText={validationError}
                    placeholder={`e.g. enter ${identifierType.toLowerCase()} number`}
                  />
                  {identifierValue && !validationError ? (
                    <button
                      type="button"
                      className={styles.clearBtn}
                      onClick={handleClearIdentifier}
                      aria-label="Clear field"
                    >
                      <Close size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className={styles.formBtn}>
                <Button
                  className={styles.searchButton}
                  size="sm"
                  kind="primary"
                  renderIcon={loading ? undefined : Search}
                  onClick={handleSearchPatient}
                  disabled={loading || !identifierValue.trim()}
                >
                  {loading ? (
                    <span className={styles.btnLoading}>
                      <Loading small withOverlay={false} className={styles.btnSpinner} description="Searching" />
                      Searching…
                    </span>
                  ) : (
                    'Search'
                  )}
                </Button>
                <Button size="sm" kind="secondary" renderIcon={WarningAlt} onClick={handleEmergencyRegistration}>
                  Emergency Registration
                </Button>
              </div>
            </Layer>
            {notFound ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <SearchLocate size={24} />
                </div>
                <div>
                  <h5 className={styles.emptyTitle}>No match found</h5>
                  <p className={styles.emptyText}>
                    No client matching that <strong>{identifierType}</strong> was found in the Client Registry. Ask the
                    patient to register on the{' '}
                    <a href="https://afyayangu.go.ke/" target="_blank" rel="noopener noreferrer">
                      Afya Yangu portal
                    </a>{' '}
                    first, then search again — or use <strong>Emergency Registration</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <></>
            )}
            {fetchError ? (
              <div className={styles.errorState}>
                <div className={styles.errorStateIcon}>
                  <WarningAltFilled size={24} />
                </div>
                <div>
                  <h5 className={styles.errorStateTitle}>Couldn&apos;t complete the search</h5>
                  <p className={styles.errorStateText}>{fetchError} Please check your connection and try again.</p>
                </div>
              </div>
            ) : (
              <></>
            )}
            {principal ? (
              <Layer className={styles.card}>
                <div className={styles.hieData}>
                  <div className={styles.sectionHeader}>
                    <UserMultiple size={20} className={styles.sectionIcon} />
                    <h5 className={styles.sectionTitle}>Principal &amp; dependants</h5>
                  </div>
                  <p className={styles.formIntro}>
                    Select the patient to proceed with, then ask them to share the OTP sent to their phone.
                  </p>
                  <div className={styles.selectionHeader}>
                    <p className={styles.summaryLine}>
                      <span className={styles.summaryPrincipal} />1 principal
                      <span className={styles.summaryDot} />
                      <span className={styles.summaryDependant} />
                      {principal.dependants?.length ?? 0}{' '}
                      {(principal.dependants?.length ?? 0) === 1 ? 'dependant' : 'dependants'}
                    </p>
                  </div>
                  <div className={styles.principalDependantSection}>
                    <div className={styles.optionList}>
                      <div
                        className={`${styles.optionCard} ${styles.principalOption} ${
                          selectedPatient === 'principal' ? styles.optionSelected : ''
                        }`}
                        onClick={() => handleSelectedPatient('principal')}
                      >
                        <RadioButton
                          id="select-principal"
                          name="patient-selection"
                          labelText=""
                          value="principal"
                          checked={selectedPatient === 'principal'}
                          onChange={() => handleSelectedPatient('principal')}
                        />
                        <div className={styles.optionBody}>
                          <div className={styles.optionTopline}>
                            <span className={styles.optionName}>
                              {principal.first_name} {maskExceptFirstAndLast(principal.middle_name)}{' '}
                              {maskExceptFirstAndLast(principal.last_name)}
                            </span>
                            <Tag type="blue" size="sm">
                              Principal
                            </Tag>
                          </div>
                          <span className={styles.optionCr}>CR {maskCrNumber(principal.id)}</span>
                        </div>
                      </div>
                      {principal.dependants
                        ?.filter((d) => d?.result?.[0])
                        .map((d) => {
                          const dependant = d.result[0];
                          const relationship = d.relationship;
                          return (
                            <div
                              key={dependant.id}
                              className={`${styles.optionCard} ${styles.dependantOption} ${
                                selectedPatient === dependant.id ? styles.optionSelected : ''
                              }`}
                              onClick={() => handleSelectedPatient(dependant.id)}
                            >
                              <RadioButton
                                id={`select-${dependant.id}`}
                                name="patient-selection"
                                labelText=""
                                value={dependant.id}
                                checked={selectedPatient === dependant.id}
                                onChange={() => handleSelectedPatient(dependant.id)}
                              />
                              <div className={styles.optionBody}>
                                <div className={styles.optionTopline}>
                                  <span className={styles.optionName}>
                                    {dependant.first_name} {maskExceptFirstAndLast(dependant.middle_name)}{' '}
                                    {maskExceptFirstAndLast(dependant.last_name)}
                                  </span>
                                  <Tag type="teal" size="sm">
                                    {relationship || 'Dependant'}
                                  </Tag>
                                </div>
                                <span className={styles.optionCr}>CR {maskCrNumber(dependant.id)}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    <div className={styles.patientConfirmSelection}>
                      <div className={styles.btnContainer}>
                        <Button kind="primary" onClick={handleOtpVerification}>
                          {' '}
                          Confirm
                        </Button>
                      </div>
                      <div className={styles.btnContainer}>
                        <Button kind="secondary" onClick={handleCancel}>
                          Cancel
                        </Button>
                      </div>
                    </div>

                    <WorkflowDrawer
                      open={displayDrawer}
                      client={getPatient()}
                      clientType={
                        selectedPatient === 'principal'
                          ? 'Principal'
                          : principal.dependants?.find((d) => d.result[0]?.id === selectedPatient)?.relationship ||
                            'Dependant'
                      }
                      locationUuid={locationUuid}
                      requestCustomOtpDto={generateCustomSmsPayload()}
                      phoneNumber={principal.phone ? formatPhoneNumberForOTP(principal.phone) : ''}
                      onClose={() => setDisplayDrawer(false)}
                      onStartVisit={(details) => {
                        setDisplayDrawer(false);
                        startVisitForClient(details);
                      }}
                    />

                    {displayOtpModal && requestCustomOtpDto ? (
                      <OtpVerificationModal
                        requestCustomOtpDto={requestCustomOtpDto}
                        phoneNumber={formatPhoneNumberForOTP(principal.phone)}
                        open={displayOtpModal}
                        onModalClose={handleModelClose}
                        onOtpSuccessfullVerification={handleOtpSuccessfullVerification}
                      />
                    ) : (
                      <></>
                    )}

                    {principal && displayClientDetailsModal ? (
                      <>
                        <ClientDetailsModal
                          client={getPatient()}
                          open={displayClientDetailsModal}
                          onModalClose={onClientDetailsModalClose}
                          onSubmit={handleClientDetailsSubmit}
                        />{' '}
                      </>
                    ) : (
                      <></>
                    )}

                    {principal && displaytStartVisitModal ? (
                      <>
                        <StartPatientVisitModal
                          client={getPatient()}
                          amrsPatient={amrsPatients[0]}
                          open={displaytStartVisitModal}
                          onModalClose={onSendToTriageModalClose}
                          onSubmit={handleSendToTriageModalSubmit}
                          onCreateAmrsPatient={createAmrsPatient}
                          onManualRegistration={handleManualRegistration}
                        />
                      </>
                    ) : (
                      <></>
                    )}
                  </div>
                </div>
              </Layer>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RegistryComponent;
