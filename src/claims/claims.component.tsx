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
import { addIntervention } from './interventions.resource';
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
  onSelectChange: (key, value) => void;
  onClaimsVisitStart?: (payload: ClaimResult) => void;
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
        { otp },
      );
      onClaimsVisitStart(claimVisit);

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

  const handleAddIntervention = async () => {
    try {
      if (isNewVisit) {
        return;
      }
      const consentToken = getConsentToken();
      const intervention = await addIntervention(consentToken, selectedIntervention.code, sessionLocation?.uuid);
      onAddIntervention(intervention);

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
