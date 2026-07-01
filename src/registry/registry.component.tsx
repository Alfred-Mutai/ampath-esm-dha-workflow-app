import {
  Button,
  Dropdown,
  InlineLoading,
  RadioButton,
  RadioButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from '@carbon/react';
import React, { useState } from 'react';
import styles from './registry.component.scss';
import {
  type ClientRegistrySearchRequest,
  type HieClient,
  IDENTIFIER_TYPES,
  type IdentifierType,
  type RequestCustomOtpDto,
} from './types';
import { fetchClientRegistryData } from './registry.resource';
import { type Patient, showSnackbar, useSession } from '@openmrs/esm-framework';
import OtpVerificationModal from './modal/otp-verification-modal/otp-verification-modal';
import { maskExceptFirstAndLast, maskValue } from './utils/mask-data';
import ClientDetailsModal from './modal/client-details-modal/client-details-modal';
import { searchPatientByCrNumber } from '../resources/patient-search.resource';
import SendToTriageModal from './modal/send-to-triage/send-to-triage.modal';
import { formatDependantDisplayData } from './utils/format-dependant-display-data';
import { registerHieClientInAmrs } from '../resources/hie-amrs-automatic-registration.service';
import { getErrorMessages } from './utils/error-handler';
import EligibilityTags from './eligibility/eliigibility-tags/eligibility-tags';
import { IdentifierTypesUuids } from '../resources/identifier-types';
import { formatPhoneNumberForOTP } from './utils/phone-number-formatter';
import { usePatient } from '../context/patient-context';

interface RegistryComponentProps {}
const RegistryComponent: React.FC<RegistryComponentProps> = () => {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('National ID');
  const [identifierValue, setIdentifierValue] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [principal, setPrincipal] = useState<HieClient>();
  const [selectedDependant, setSelectedDependant] = useState<HieClient>();
  const [amrsPatients, setAmrsPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('principal');
  const [displayOtpModal, setDisplayOtpModal] = useState<boolean>(false);
  const [displayClientDetailsModal, setDisplayClientDetailsModal] = useState<boolean>(false);
  const [displaytriageModal, setDisplaytriageModal] = useState<boolean>(false);
  const [requestCustomOtpDto, setRequestCustomOtpDto] = useState<RequestCustomOtpDto>();
  const session = useSession();
  const locationUuid = session!.sessionLocation!.uuid;
  const { setPatient } = usePatient();

  const handleSearchPatient = async () => {
    setLoading(true);
    try {
      const searchClientPayload = getSearchClientDto();

      if (!isValidSeatchClientPayload(searchClientPayload)) return false;

      const result = await fetchClientRegistryData(searchClientPayload);
      const patients = Array.isArray(result) ? result : [];

      if (patients.length === 0) {
        handleCancel();
        throw new Error('No matching patient found in Client Registry.');
      }

      const patient = patients[0];
      setPatient(patient);
      setPrincipal(patient);
      showAlert('success', 'Client Data Loaded', 'Patient fetched successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch client data';
      handleCancel();
      showAlert('error', 'Fetch Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getSearchClientDto = (): ClientRegistrySearchRequest => {
    return {
      identificationNumber: identifierValue,
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
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
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
  const handleModelClose = () => {
    setDisplayOtpModal(false);
  };
  const onClientDetailsModalClose = () => {
    setDisplayClientDetailsModal(false);
  };
  const handleClientDetailsSubmit = () => {
    return;
  };
  const handleEmergencyRegistration = () => {
    window.location.href = `${window.spaBase}/patient-registration`;
  };
  const handleManualRegistration = () => {
    setDisplaytriageModal(false);
    handleEmergencyRegistration();
  };
  const handleSendClientToTriage = async (crId: string) => {
    onClientDetailsModalClose();
    const resp = await searchPatientByCrNumber(crId);
    if (resp.totalCount > 0) {
      showAlert(
        'success',
        `${resp.totalCount} ${resp.totalCount > 0 ? 'Patients' : 'Patient'} found in the system with ${crId}`,
        '',
      );
      const validPatients = validateAmrsPatient(crId, resp.results ?? []);
      setAmrsPatients(validPatients);
      setDisplaytriageModal(true);
    } else {
      showAlert('error', 'Patient not found in the system', '');
      setAmrsPatients([]);
      setDisplaytriageModal(true);
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
    setDisplaytriageModal(false);
    if (modalCloseResp && modalCloseResp.success) {
      window.location.href = `${window.spaBase}/home/triage`;
    }
  };
  const handleSendToTriageModalSubmit = () => {};
  const getPatient = (): HieClient => {
    if (selectedPatient === 'principal') {
      return principal;
    } else if (selectedPatient === 'dependants') {
      return selectedDependant;
    } else {
      return principal;
    }
  };
  const handleSelectedDependant = (dependantId: string) => {
    const dependants = principal.dependants;
    if (dependants.length > 0) {
      const dependant = dependants.find((d) => {
        return d.result[0].id === dependantId;
      });
      if (dependant) {
        setSelectedDependant(dependant.result[0] as unknown as HieClient);
      }
    }
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
    setSelectedDependant(null);
    setAmrsPatients([]);
    setSelectedPatient(null);
    setIdentifierValue('');
    setIdentifierType('National ID');
    setDisplayClientDetailsModal(false);
    setDisplayOtpModal(false);
    setDisplaytriageModal(false);
    setSelectedPatient('principal');
  };
  const handleOtpSuccessfullVerification = () => {
    setDisplayOtpModal(false);
    setDisplayClientDetailsModal(true);
  };
  const registerOnAfyaYangu = () => {
    window.open('https://afyayangu.go.ke/', '_blank');
  };
  return (
    <>
      <div className={styles.registryLayout}>
        <div className={styles.mainContent}>
          <div className={styles.registryHeader}>
            <h4>Client Registry</h4>
            <p>Please enter identification number to begin</p>
          </div>
          <div className={styles.registryContent}>
            <div className={styles.formRow}>
              <div className={styles.formControl}>
                <Dropdown
                  id="identifier-type-dropdown"
                  label="Identifier Type"
                  titleText="Select Identifier Type"
                  items={IDENTIFIER_TYPES}
                  selectedItem={identifierType}
                  onChange={({ selectedItem }) => setIdentifierType(selectedItem as IdentifierType)}
                />
              </div>

              <div className={styles.formControl}>
                <TextInput
                  id="identifier-value"
                  labelText={`${identifierType} Value`}
                  value={identifierValue}
                  onChange={(e) => setIdentifierValue(e.target.value)}
                  placeholder={`Enter ${identifierType.toLowerCase()} value`}
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formControl}>
                <div className={styles.formBtn}>
                  <Button
                    className={styles.registrySearchBtn}
                    kind="primary"
                    onClick={handleSearchPatient}
                    disabled={loading}
                  >
                    {loading ? <InlineLoading description="Searching..." /> : 'Search'}
                  </Button>
                  <Button className={styles.registrySearchBtn} kind="secondary" onClick={handleEmergencyRegistration}>
                    Emergency Registration
                  </Button>
                  {!principal ? (
                    <Button className={styles.registrySearchBtn} kind="tertiary" onClick={registerOnAfyaYangu}>
                      Register on Afya Yangu
                    </Button>
                  ) : (
                    <></>
                  )}
                </div>
              </div>
            </div>
            {principal ? (
              <div className={styles.formRow}>
                <div className={styles.hieData}>
                  <div className={styles.selectionHeader}>
                    <h5>Please select one patient and request patient to share the OTP sent</h5>
                  </div>
                  <div className={styles.patientSelect}>
                    <div className={styles.patientSelectRadio}>
                      <RadioButtonGroup
                        defaultSelected="principal"
                        legendText="Patient"
                        onChange={(v) => handleSelectedPatient(v as string)}
                        name="radio-button-default-group"
                      >
                        <RadioButton id="principal" labelText="Principal" value="principal" />
                        <RadioButton id="dependants" labelText="Dependants" value="dependants" />
                      </RadioButtonGroup>
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
                  </div>
                  <div className={styles.principalDependantSection}>
                    {selectedPatient === 'principal' ? (
                      <>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableHeader>Name</TableHeader>
                              <TableHeader>CR</TableHeader>
                              <TableHeader>Phone No</TableHeader>
                              <TableHeader>ID No</TableHeader>
                              <TableHeader>Eligibility Status</TableHeader>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell>
                                {principal.first_name} {maskExceptFirstAndLast(principal.middle_name)}{' '}
                                {maskExceptFirstAndLast(principal.last_name)}
                              </TableCell>
                              <TableCell>{maskValue(principal.id)}</TableCell>
                              <TableCell>{maskValue(principal.phone)}</TableCell>
                              <TableCell>{maskValue(principal.identification_number)}</TableCell>
                              <TableCell>
                                <EligibilityTags crId={principal.id} locationUuid={locationUuid} />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </>
                    ) : (
                      <></>
                    )}
                    {selectedPatient === 'dependants' ? (
                      <>
                        <div className={styles.dependantDetails}>
                          <div>
                            <RadioButtonGroup
                              defaultSelected=""
                              helperText=""
                              invalidText=""
                              legendText=""
                              name="dependant-group"
                              onChange={(dependantId) => handleSelectedDependant(dependantId as string)}
                            >
                              {principal.dependants.map((d) => {
                                const dependant = d.result[0];
                                const relationship = d.relationship;
                                return (
                                  <RadioButton
                                    id={dependant.id}
                                    labelText={formatDependantDisplayData(dependant, relationship)}
                                    value={dependant.id}
                                  />
                                );
                              })}
                            </RadioButtonGroup>
                          </div>
                          <div>
                            {selectedDependant ? (
                              <>
                                <Table>
                                  <TableHead>
                                    <TableRow>
                                      <TableHeader>Name</TableHeader>
                                      <TableHeader>CR</TableHeader>
                                      <TableHeader>Eligibility Status</TableHeader>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell>
                                        {selectedDependant.first_name}{' '}
                                        {maskExceptFirstAndLast(selectedDependant.middle_name)}{' '}
                                        {maskExceptFirstAndLast(selectedDependant.last_name)}
                                      </TableCell>
                                      <TableCell>{maskValue(selectedDependant.id)}</TableCell>
                                      <TableCell>
                                        <EligibilityTags crId={selectedDependant.id} locationUuid={locationUuid} />
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </>
                            ) : (
                              <></>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <></>
                    )}

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
                          onSendClientToTriage={handleSendClientToTriage}
                        />{' '}
                      </>
                    ) : (
                      <></>
                    )}

                    {principal && displaytriageModal ? (
                      <>
                        <SendToTriageModal
                          client={getPatient()}
                          patients={amrsPatients}
                          open={displaytriageModal}
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
              </div>
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
