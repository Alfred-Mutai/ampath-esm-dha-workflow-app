import { Button, InlineLoading, Row, Select, SelectItem, Tag, TextInput } from '@carbon/react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  createClaimsVisit,
  fetchConsentToken,
  getServiceType,
  useBenefitUtilizations,
  useClientSubBenefits,
  useInterventions,
  usePatientVisit,
} from './claims.resource';
import {
  type BenefitUtilization,
  type InterventionResults,
  type ClientSubBenefitResults,
  type Intervention,
  type ClientSubBenefit,
  VisitType,
  type ClaimResult,
} from './index';
import { addIntervention, checkInterventionExists } from './interventions.resource';
import { showModal, showSnackbar, useSession, useVisit, Visit } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

interface ClaimsComponentProps {
  clientRegistryId: string;
  patientUuid?: string;
  visitType?: VisitType;
  isNewVisit?: boolean;
  triggerCreateVisit?: boolean;
  triggerAddIntervention?: boolean;
  otp?: string;
  authGuid?: string;
  onSelectChange: (key, value) => void;
  onClaimsVisitStart?: (payload: ClaimResult, intervention: Intervention) => void;
  onAddIntervention?: (intervention: any) => void;
  onInterventionChange?: (intervention: Intervention | undefined) => void;
}

const ClaimsComponent: React.FC<ClaimsComponentProps> = ({
  clientRegistryId,
  patientUuid,
  visitType,
  isNewVisit = true,
  triggerCreateVisit = false,
  triggerAddIntervention = false,
  otp = null,
  authGuid = null,
  onSelectChange,
  onClaimsVisitStart,
  onAddIntervention,
  onInterventionChange,
}) => {
  const { activeVisit } = useVisit(patientUuid);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention>();
  const [selectedSubBenefitCode, setSelectedSubBenefitCode] = useState<ClientSubBenefit>();
  const [isBenefitEligible, setIsBenefitEligible] = useState(false);

  const { clientSubBenefits, isLoadingClientSubBenefits } = useClientSubBenefits(clientRegistryId);
  const { interventions, isLoadingInterventions } = useInterventions(clientRegistryId, selectedSubBenefitCode?.code);
  const { benefitUtilizations, isLoadingBenefitUtilization } = useBenefitUtilizations(
    clientRegistryId,
    selectedIntervention?.code,
    selectedIntervention?.paymentMechanism?.toUpperCase() === 'CAPITATION',
  );
  const { sessionLocation } = useSession();
  const { t } = useTranslation();

  useEffect(() => {
    if (benefitUtilizations) {
      const benefitUtilization = benefitUtilizations[0];
      setIsBenefitEligible(benefitUtilization.computationalDetail.eligibility);
    }
  }, [benefitUtilizations]);

  useEffect(() => {
    if (triggerCreateVisit) {
      const fn = async () => {
        await handleStartVisit();
      };
      fn();
    }
  }, [triggerCreateVisit]);

  useEffect(() => {
    if (triggerAddIntervention) {
      const fn = async () => {
        await handleAddIntervention();
      };
      fn();
    }
  }, [triggerAddIntervention]);

  const launchPreauthsModal = useCallback(() => {
    const dispose = showModal('preauths-modal', {
      closeModal: () => dispose(),
      intervention: selectedIntervention,
    });
  }, [selectedIntervention]);

  const handleStartVisit = async () => {
    try {
      if (!isNewVisit) {
        return;
      }
      const serviceType = getServiceType(selectedIntervention, visitType);
      const claimVisit = await createClaimsVisit(
        selectedIntervention.code,
        clientRegistryId,
        serviceType,
        sessionLocation?.uuid,
        { otp, auth_guid: authGuid },
      );
      onClaimsVisitStart(claimVisit, selectedIntervention);

      showSnackbar({
        title: t('startClaimVisitSuccess', 'Claim visit started successfully'),
        subtitle: t('createdClaimVisitSuccess', 'Claim visit has been created successfully'),
        kind: 'success',
      });
    } catch (err) {
      showSnackbar({
        title: t('startingVisitError', 'Error starting visit'),
        subtitle: `Error: ${err}`,
        kind: 'error',
      });
    }
  };

  const getConsentToken = () => {
    const consentToken =
      activeVisit.attributes?.find((atr) => atr?.attributeType?.uuid === '4962a633-c4f8-474c-857c-5c68c72fbbe3')
        ?.value ?? '';
    return consentToken;
  };

  const mapIntervention = (intervention: any) => {
    if (!intervention) return undefined;
    // ClaimIntervention to Intervention
    if ('intervention_code' in intervention) {
      const ci = intervention as any;
      return {
        id: Number(ci.id) || 0,
        accessPoint: ci.access_point ?? '',
        name: ci.intervention_name,
        code: ci.intervention_code,
        paymentMechanism: ci.intervention_payment_mechanism,
        needsPreauth: !!ci.needs_preauth,
        needsManualPreauthApproval: false,
        overallTariff: ci.accrued_per_diem_amount ?? '',
        kephLevelTarriff: ci.keph_level_tarrif ?? '',
        fund: ci.intervention_fund ?? '',
        fallBackOverallTariff: '',
        tariffPerAdditionalKilometer: '',
        level2Tariff: '',
        level3Tariff: '',
        level4Tariff: '',
        level5Tariff: '',
        level6Tariff: '',
        requiresSurgicalPreauth: !!ci.requires_surgical_preauth,
        requiresRenalPreauth: !!ci.requires_renal_preauth,
        requiresOncologyPreauth: !!ci.requires_oncology_preauth,
        requiresRadiologyPreauth: !!ci.requires_radiology_preauth,
        requiresOpticalPreauth: !!ci.requires_optical_preauth,
        applicableSchemes: ci.supported_scheme ? [ci.supported_scheme] : [],
        requiredPreauthDocumentTypes: ci.required_preauth_document_types ?? [],
        applicableDocumentTypes: ci.applicable_document_types ?? [],
      };
    }

    // Intervention to ClaimIntervention
    const i = intervention as any;
    return {
      id: String(i.id ?? ''),
      intervention_code: i.code,
      intervention_name: i.name,
      intervention_payment_mechanism: i.paymentMechanism,
      keph_level_tarrif: i.kephLevelTarriff ?? '',
      accrued_per_diem_amount: i.overallTariff ?? '',
      accrued_per_diem_days: 0,
      workflow_state: '',
      preauth_exist: false,
      is_switched_intervention: false,
      supported_scheme: (i.applicableSchemes && i.applicableSchemes[0]) || '',
      switched_lines_retained: false,
      sub_benefit_code: '',
      active_for_uhc: false,
      intervention_fund: i.fund ?? '',
      requires_surgical_preauth: !!i.requiresSurgicalPreauth,
      requires_renal_preauth: !!i.requiresRenalPreauth,
      requires_oncology_preauth: !!i.requiresOncologyPreauth,
      requires_radiology_preauth: !!i.requiresRadiologyPreauth,
      requires_optical_preauth: !!i.requiresOpticalPreauth,
      optional_document_type: null,
      required_preauth_document_types: i.requiredPreauthDocumentTypes ?? null,
      optional_preauth_document_types: null,
      applicable_document_types: i.applicableDocumentTypes ?? [],
      needs_preauth: !!i.needsPreauth,
    };
  }

  const handleAddIntervention = async () => {
    try {
      if (isNewVisit) {
        return;
      }
      const consentToken = getConsentToken();
      // Check if intervention exists
      const interventionExists = await checkInterventionExists(consentToken, selectedIntervention.code);
      if (interventionExists) {
        onAddIntervention(mapIntervention(selectedIntervention));
      } else {
        const intervention = await addIntervention(consentToken, selectedIntervention.code, sessionLocation?.uuid);
        onAddIntervention(intervention);
      }

      showSnackbar({
        title: t('addInterventionSuccess', 'Intervention added successfully'),
        subtitle: t('createdInterventionSuccess', 'Intervention created successfully'),
        kind: 'success',
      });
    } catch (err) {
      showSnackbar({
        title: t('addInterventionError', 'Error adding intervention'),
        subtitle: `Error: ${err}`,
        kind: 'error',
      });
    }
  };

  return (
    <>
      {/* Benefits */}
      {isLoadingClientSubBenefits ? (
        <InlineLoading description="Loading client sub-benefits" />
      ) : (
        <Select
          id="client-sub-benefits"
          labelText="Client sub benefits"
          onChange={($event) => {
            const value = $event.target.value;
            setSelectedSubBenefitCode(clientSubBenefits.find((sB) => sB.code === value));
            return onSelectChange('client-sub-benefits', value);
          }}
        >
          <SelectItem value="" text="--Select Sub Benefit--" />
          {clientSubBenefits &&
            clientSubBenefits.map((subBenefit) => {
              return <SelectItem value={subBenefit.code} text={`${subBenefit.name} (${subBenefit.code})`} />;
            })}
        </Select>
      )}
      {/* Interventions */}
      <Row>
        {isLoadingInterventions ? (
          <InlineLoading description="Loading interventions" />
        ) : (
          <Select
            id="interventions"
            labelText="Interventions"
            onChange={($event) => {
              const value = $event.target.value;
              const intervention = interventions?.find((i) => i.code === value);

              setSelectedIntervention(intervention);
              onInterventionChange?.(intervention);
              return onSelectChange('interventions', value);
            }}
          >
            <SelectItem value="" text="--Select Intervention--" />
            {interventions &&
              interventions.map((intervention) => {
                return <SelectItem value={intervention.code} text={`${intervention.name} (${intervention.code})`} />;
              })}
          </Select>
        )}
        {isLoadingBenefitUtilization ? (
          <InlineLoading description="Checking eligibility" />
        ) : benefitUtilizations ? (
          isBenefitEligible ? (
            <Tag type="green">Eligible</Tag>
          ) : (
            <Tag type="red">Not Eligible</Tag>
          )
        ) : (
          <></>
        )}
        {selectedIntervention ? (
          selectedIntervention.needsPreauth && !selectedIntervention.needsManualPreauthApproval ? (
            <Tag type="blue" onClick={launchPreauthsModal}>
              Needs Preauth
            </Tag>
          ) : selectedIntervention.needsPreauth && selectedIntervention.needsManualPreauthApproval ? (
            <Tag type="blue" onClick={launchPreauthsModal}>
              Needs Elective Preauth
            </Tag>
          ) : (
            <></>
          )
        ) : (
          <></>
        )}
      </Row>
    </>
  );
};

export default ClaimsComponent;
