import { Button, ComboBox, InlineLoading, Loading, Tag, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TextInput } from '@carbon/react';
import styles from './claims.component.scss';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createClaimsVisit,
  fetchConsentToken,
  getServiceType,
  useBenefitUtilizations,
  useClientSubBenefits,
  usePreExistingIntervention,
  useInterventions,
  usePatientVisit,
  usePomsfBalance,
  updateBillOrderConsentToken,
} from './claims.resource';
import {
  type BenefitUtilization,
  type InterventionResults,
  type ClientSubBenefitResults,
  type Intervention,
  type ClientSubBenefit,
  type PreExistingIntervention,
  VisitType,
  type ClaimResult,
} from './index';
import { addIntervention, checkInterventionExists } from './interventions.resource';
import { launchWorkspace, showSnackbar, useSession, useVisit, Visit } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { useProviderClaimPreview } from '../billing/billing-claims.resource';
import { getConsentToken as getVisitConsentToken } from '../shared/services/claims.resource';

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
  onClaimsVisitStart?: (payload: ClaimResult, intervention: Intervention, subBenefit: ClientSubBenefit, usePreselectedIntervention: boolean) => void;
  onAddIntervention?: (intervention: any, subBenefit?: ClientSubBenefit) => void;
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
  // Preselect from bill-order only once — re-running when interventions reload was
  // forcing the first preexisting code back whenever the user picked another.
  const didAutoPreselect = useRef(false);

  const { clientSubBenefits, isLoadingClientSubBenefits } = useClientSubBenefits(clientRegistryId);
  const { interventions, isLoadingInterventions } = useInterventions(clientRegistryId, selectedSubBenefitCode?.code);
  const { preExistingInterventions, isLoadingPreExistingIntervention } = usePreExistingIntervention(patientUuid);
  const { sessionLocation } = useSession();

  const loadedConsentToken = useMemo(() => {
    if (activeVisit) {
      const consentToken =
        activeVisit.attributes?.find((atr) => atr?.attributeType?.uuid === '4962a633-c4f8-474c-857c-5c68c72fbbe3')
          ?.value ?? '';
      return consentToken;
    }
  }, [activeVisit]);

  const { claimVisit: existingClaimVisit } = useProviderClaimPreview(loadedConsentToken, sessionLocation?.uuid);
  const { t } = useTranslation();

  const formatPreauthType = (intervention: PreExistingIntervention) => {
    if (intervention.normal_preauth) {
      return t('normalPreauth', 'Normal');
    }
    if (intervention.elective_preauth) {
      return t('electivePreauth', 'Elective');
    }
    return t('noPreauth', 'None');
  };

  const formatDate = (value: string) => {
    return value ? new Date(value).toLocaleDateString() : '-';
  };

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

  useEffect(() => {
    if (didAutoPreselect.current) {
      return;
    }
    if (isLoadingPreExistingIntervention || !preExistingInterventions?.length) {
      return;
    }
    if (!clientSubBenefits && !interventions) {
      return;
    }

    const preExistingIntervention = preExistingInterventions[0];
    if (clientSubBenefits) {
      const preSelected = clientSubBenefits.find((v) => v.code === preExistingIntervention.sub_benefit_code);
      if (preSelected) {
        setSelectedSubBenefitCode(preSelected);
      }
    }
    if (interventions) {
      const preSelected = interventions.find((v) => v.code === preExistingIntervention.intervention_code);
      if (preSelected) {
        setSelectedIntervention(preSelected);
      }
      // Interventions for the (auto) sub-benefit have arrived — stop re-applying so the
      // user can clear or pick a different intervention without being overwritten.
      didAutoPreselect.current = true;
    }
  }, [preExistingInterventions, isLoadingPreExistingIntervention, clientSubBenefits, interventions]);

  const launchPreauthsModal = useCallback(() => {
    if (!selectedIntervention) return;

    const elective =
      Boolean(selectedIntervention.needsPreauth) &&
      Boolean(selectedIntervention.needsManualPreauthApproval);

    const token = getVisitConsentToken(activeVisit);
    if (!elective && !token) {
      showSnackbar({
        kind: 'error',
        title: t('missingConsentToken', 'No claim token on visit'),
        subtitle: t(
          'missingConsentTokenDetail',
          'Start a claim visit first, then raise normal preauth from the Preauthorizations tab or here.',
        ),
      });
      return;
    }

    launchWorkspace('preauth-form-workspace', {
      consentToken: token || '',
      patientUuid,
      locationUuid: sessionLocation?.uuid,
      isElective: elective,
      billItem: {
        patient_uuid: patientUuid,
        patient_name: '',
        intervention_code: selectedIntervention.code,
        billable_service: selectedIntervention.name,
        item_price: Number(selectedIntervention.overallTariff) || 0,
        item_quantity: 1,
        cr_no: clientRegistryId,
        requires_preauth: true,
        normal_preauth: !elective,
        elective_preauth: elective,
        required_preauth_document_types: (selectedIntervention.requiredPreauthDocumentTypes ?? []).join(','),
        applicable_document_types: (selectedIntervention.applicableDocumentTypes ?? []).join(','),
        requires_surgical_preauth: selectedIntervention.requiresSurgicalPreauth,
        requires_renal_preauth: selectedIntervention.requiresRenalPreauth,
        requires_oncology_preauth: selectedIntervention.requiresOncologyPreauth,
        requires_radiology_preauth: selectedIntervention.requiresRadiologyPreauth,
        requires_optical_preauth: selectedIntervention.requiresOpticalPreauth,
      },
      intervention: {
        code: selectedIntervention.code,
        name: selectedIntervention.name,
        requiresSurgicalPreauth: selectedIntervention.requiresSurgicalPreauth,
        requiresRenalPreauth: selectedIntervention.requiresRenalPreauth,
        requiresOncologyPreauth: selectedIntervention.requiresOncologyPreauth,
        requiresRadiologyPreauth: selectedIntervention.requiresRadiologyPreauth,
        requiresOpticalPreauth: selectedIntervention.requiresOpticalPreauth,
        requiredPreauthDocumentTypes: selectedIntervention.requiredPreauthDocumentTypes ?? [],
        applicableDocumentTypes: selectedIntervention.applicableDocumentTypes ?? [],
      },
    });
  }, [selectedIntervention, activeVisit, patientUuid, sessionLocation, clientRegistryId, t]);

  const handleStartVisit = async () => {
    try {
      if (!isNewVisit) {
        return;
      }
      const serviceType = getServiceType(selectedIntervention, visitType);
      let interventionCodes = [];
      if (selectedIntervention) {
        interventionCodes.push(selectedIntervention.code);
      }
      if (preExistingInterventions && preExistingInterventions.length) {
        const preExistingCodes = preExistingInterventions.map(v => v.intervention_code);
        interventionCodes.push(...preExistingCodes);
      }

      interventionCodes = Array.from(new Set(interventionCodes));

      const claimVisit = await createClaimsVisit(
        selectedIntervention.code,
        clientRegistryId,
        serviceType,
        sessionLocation?.uuid,
        { otp, auth_guid: authGuid },
      );

      // update the existing bill orders if the interventions match
      if (preExistingInterventions && preExistingInterventions.length) {
        // Check if the selected intervention is in preExistingInterventions
        const consentToken = claimVisit.authorization_code;

        const promises = [];
        const existsInPreExistingInterventions = preExistingInterventions.some(v => v.intervention_code === selectedIntervention.code);
        if (existsInPreExistingInterventions) {
          promises.push(
            ...preExistingInterventions.map((intervention) =>
              updateBillOrderConsentToken(intervention.id, claimVisit.authorization_code),
            ),
          );
        } else {
          const filteredPreExistingInterventions = preExistingInterventions.filter(v => v.intervention_code != selectedIntervention.code);
          promises.push(
            ...filteredPreExistingInterventions.map((intervention) =>
              updateBillOrderConsentToken(intervention.id, claimVisit.authorization_code),
            ),
          );
        }

        if (consentToken) {
          promises.push(
            interventionCodes.map((intervention) => {
              const interventionExistsInProviderPreview = claimVisit?.interventions?.some(i => i?.intervention_code === intervention);
              if (interventionExistsInProviderPreview) {
                return;
              }
              return addIntervention(consentToken, intervention, sessionLocation?.uuid);
            },
            ),
          );
        }

        await Promise.all(promises);

        const selectedInterventionPreExists = preExistingInterventions.some(p => p.intervention_code === selectedIntervention.code);
        if (!selectedInterventionPreExists) {
          onClaimsVisitStart(claimVisit, selectedIntervention, selectedSubBenefitCode, false);
        } else {
          onClaimsVisitStart(claimVisit, null, null, true);
        }
      } else {
        onClaimsVisitStart(claimVisit, selectedIntervention, selectedSubBenefitCode, false);
      }

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

  const getConsentToken = () => getVisitConsentToken(activeVisit);

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
      // check if consent token exists to enable creation of bill order in:
      // lab, procedures, radiology and pharmacy.
      if (!consentToken) {
        onAddIntervention(mapIntervention(selectedIntervention), selectedSubBenefitCode);
        return;
      }
      // Check if intervention exists
      const interventionExists = await checkInterventionExists(consentToken, selectedIntervention.code);
      const interventionExistsInProviderPreview = existingClaimVisit?.interventions?.some(i => i?.intervention_code === selectedIntervention.code);
      if (interventionExists || interventionExistsInProviderPreview) {
        onAddIntervention(mapIntervention(selectedIntervention), selectedSubBenefitCode);
      } else {
        const intervention = await addIntervention(consentToken, selectedIntervention.code, sessionLocation?.uuid);
        onAddIntervention(intervention ?? mapIntervention(selectedIntervention), selectedSubBenefitCode);
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
    <>
      {
        isLoadingPreExistingIntervention ?
          <InlineLoading className={styles.checkingEligibility} description="Loading existing interventions" /> :
          preExistingInterventions && preExistingInterventions.length ?
            <div className={styles.claimFields}>
              <div className={styles.preExistingInterventionsHeader}>
                <h6>{t('preExistingInterventionsHeading', 'Existing interventions')}</h6>
              </div>
              <div className={styles.tableWrapper}>
                <Table size="sm">
                  <TableHead>
                    <TableRow>
                      <TableHeader>{t('orderNumber', 'Order #')}</TableHeader>
                      <TableHeader>{t('subBenefit', 'Sub-benefit')}</TableHeader>
                      <TableHeader>{t('interventionCode', 'Intervention')}</TableHeader>
                      <TableHeader>{t('preauthRequired', 'Preauth')}</TableHeader>
                      <TableHeader>{t('createdAt', 'Created')}</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preExistingInterventions.map((intervention) => (
                      <TableRow key={intervention.id}>
                        <TableCell>{intervention.order_no || '-'}</TableCell>
                        <TableCell>{intervention.sub_benefit_code || '-'}</TableCell>
                        <TableCell>{intervention.intervention_code || '-'}</TableCell>
                        <TableCell>{formatPreauthType(intervention)}</TableCell>
                        <TableCell>{formatDate(intervention.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            : <></>
      }

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
    </>
  );
};

export default ClaimsComponent;
