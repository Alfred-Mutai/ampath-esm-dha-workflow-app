import { Button, ComboBox, InlineLoading, Loading, Tag, TextInput } from '@carbon/react';
import styles from './claims.component.scss';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createClaimsVisit,
  fetchConsentToken,
  getServiceType,
  useBenefitUtilizations,
  useClientSubBenefits,
  useInterventions,
  usePatientVisit,
  usePomsfBalance,
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
  const { sessionLocation } = useSession();
  const { t } = useTranslation();

  const isPmsf = useMemo(() => {
    if (selectedSubBenefitCode) {
      return selectedSubBenefitCode.code.toUpperCase().includes("PMF");
    }
    return false;
  }, [selectedSubBenefitCode]);

   const { benefitUtilizations, isLoadingBenefitUtilization } = useBenefitUtilizations(
    clientRegistryId,
    selectedIntervention?.code,
    selectedIntervention?.paymentMechanism?.toUpperCase() === 'CAPITATION',
    isPmsf
  );

  const { pomsfBalance, isLoadingPomsfBalances } = usePomsfBalance(clientRegistryId, isPmsf);

  const pmfBalance = useMemo(() => {
    let pBalance = 0;
    if (!isLoadingPomsfBalances && pomsfBalance && selectedSubBenefitCode && selectedIntervention) {
      pomsfBalance.memberPolicies.map((memberPolicy) => {
        memberPolicy.benefit.map((benefit) => {
          const balance = benefit.subBenefit.find((subBenefit) => subBenefit.subBenefitCode === selectedSubBenefitCode.code)?.balance;
          if (balance && balance?.length) {
            pBalance = balance[0].balance;
          }
        });
      });
    }
    return pBalance;
  }, [pomsfBalance, isLoadingPomsfBalances, selectedSubBenefitCode, selectedIntervention]);

  useEffect(() => {
    // The endpoint returns an empty list for clients with no utilization record,
    // so neither the first entry nor its computational detail is guaranteed.
    setIsBenefitEligible(benefitUtilizations?.[0]?.computationalDetail?.eligibility ?? false);
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

  // A ComboBox is an editable text input, so a chosen value can be partially
  // deleted/typed over. Once an item is selected we lock the field: block typing
  // and partial edits; Backspace/Delete (or the ✕) clears the whole selection so
  // the user can search again from scratch.
  const lockSelection =
    (selected: unknown, onClear: () => void) => (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selected || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        onClear();
      } else if (e.key.length === 1) {
        // Any single printable character would edit the locked label — block it.
        e.preventDefault();
        e.stopPropagation();
      }
    };

  const clearSubBenefit = () => {
    setSelectedSubBenefitCode(undefined);
    setSelectedIntervention(undefined);
    onInterventionChange?.(undefined);
    onSelectChange('client-sub-benefits', '');
  };

  const clearIntervention = () => {
    setSelectedIntervention(undefined);
    onInterventionChange?.(undefined);
    onSelectChange('interventions', '');
  };

  return (
    <div className={styles.claimFields}>
      {/* Benefits — searchable */}
      <div className={styles.field} onKeyDownCapture={lockSelection(selectedSubBenefitCode, clearSubBenefit)}>
        <ComboBox
          id="client-sub-benefits"
          titleText="Client sub benefits"
          placeholder={isLoadingClientSubBenefits ? 'Loading sub-benefits…' : 'Search sub-benefit'}
          disabled={isLoadingClientSubBenefits}
          items={clientSubBenefits ?? []}
          itemToString={(item) => (item ? `${item.name} (${item.code})` : '')}
          shouldFilterItem={({ item, inputValue }) => {
            const selectedLabel = selectedSubBenefitCode
              ? `${selectedSubBenefitCode.name} (${selectedSubBenefitCode.code})`
              : '';
            // Reopening on a selection (input still equals the label) lists all
            // options again; only a fresh typed query narrows the list.
            if (!inputValue || inputValue === selectedLabel) {
              return true;
            }
            return `${item?.name ?? ''} ${item?.code ?? ''}`.toLowerCase().includes(inputValue.toLowerCase());
          }}
          selectedItem={selectedSubBenefitCode ?? null}
          onChange={({ selectedItem }) => {
            setSelectedSubBenefitCode(selectedItem ?? undefined);
            // Reset the dependent intervention whenever the sub-benefit changes.
            setSelectedIntervention(undefined);
            onInterventionChange?.(undefined);
            return onSelectChange('client-sub-benefits', selectedItem?.code ?? '');
          }}
        />
        {isLoadingClientSubBenefits ? (
          <Loading small withOverlay={false} className={styles.fieldSpinner} description="Loading sub-benefits" />
        ) : null}
      </div>
      {/* Interventions — searchable, disabled until a sub-benefit is picked, and
          loads inline within the field while its options are fetched. */}
      <div className={styles.interventionRow}>
        <div className={styles.field} onKeyDownCapture={lockSelection(selectedIntervention, clearIntervention)}>
          <ComboBox
            id="interventions"
            titleText="Interventions"
            placeholder={
              !selectedSubBenefitCode
                ? 'Select a sub-benefit first'
                : isLoadingInterventions
                  ? 'Loading interventions…'
                  : 'Search intervention'
            }
            disabled={!selectedSubBenefitCode || isLoadingInterventions}
            items={interventions ?? []}
            itemToString={(item) => (item ? `${item.name} (${item.code})` : '')}
            shouldFilterItem={({ item, inputValue }) => {
              const selectedLabel = selectedIntervention
                ? `${selectedIntervention.name} (${selectedIntervention.code})`
                : '';
              if (!inputValue || inputValue === selectedLabel) {
                return true;
              }
              return `${item?.name ?? ''} ${item?.code ?? ''}`.toLowerCase().includes(inputValue.toLowerCase());
            }}
            selectedItem={selectedIntervention ?? null}
            onChange={({ selectedItem }) => {
              setSelectedIntervention(selectedItem ?? undefined);
              onInterventionChange?.(selectedItem ?? undefined);
              return onSelectChange('interventions', selectedItem?.code ?? '');
            }}
          />
          {isLoadingInterventions ? (
            <Loading small withOverlay={false} className={styles.fieldSpinner} description="Loading interventions" />
          ) : null}
        </div>

        {isLoadingBenefitUtilization && !isPmsf ? (
          <InlineLoading className={styles.checkingEligibility} description="Checking eligibility" />
        ) : benefitUtilizations?.length ? (
          isBenefitEligible ? (
            <Tag size="sm" type="green">
              Eligible
            </Tag>
          ) : (
            <Tag size="sm" type="red">
              Not Eligible
            </Tag>
          )
        ) : (
          <></>
        )}

        {isLoadingPomsfBalances && isPmsf ? (
          <InlineLoading className={styles.checkingEligibility} description="Loading POMSF balance" />
        ) : (
          pmfBalance ? (
            <Tag size="sm" type="green">
              {pmfBalance}
            </Tag>
          ) : <></>
        )}

        {selectedIntervention ? (
          selectedIntervention.needsPreauth && !selectedIntervention.needsManualPreauthApproval ? (
            <Tag size="sm" type="blue" onClick={launchPreauthsModal}>
              Needs Preauth
            </Tag>
          ) : selectedIntervention.needsPreauth && selectedIntervention.needsManualPreauthApproval ? (
            <Tag size="sm" type="blue" onClick={launchPreauthsModal}>
              Needs Elective Preauth
            </Tag>
          ) : (
            <></>
          )
        ) : (
          <></>
        )}
      </div>
    </div>
  );
};

export default ClaimsComponent;
