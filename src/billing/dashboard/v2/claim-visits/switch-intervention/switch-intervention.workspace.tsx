import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  ButtonSet,
  ComboBox,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Form,
  InlineLoading,
  RadioButton,
  RadioButtonGroup,
  Tag,
  Toggle,
} from '@carbon/react';
import { Renew, WarningAltFilled } from '@carbon/react/icons';
import { showSnackbar, useSession, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './switch-intervention.workspace.scss';
import { type SwitchInterventionDto, type VisitIntervention } from '../../types';
import { switchClaimIntervention } from '../../../../billing-claims.resource';
import { useClientSubBenefits, useInterventions } from '../../../../../claims/claims.resource';
import { type ClientSubBenefit, type Intervention } from '../../../../../claims';

interface SwitchInterventionWorkspaceProps extends DefaultWorkspaceProps {
  consentToken: string;
  currentInterventions: VisitIntervention[];
  patientId?: string;
  billDate?: string;
  onSwitchSuccess?: () => void;
}

// A claim intervention is switchable only while its workflow_state is ACTIVE;
// INACTIVE (e.g. already switched out) interventions are hidden.
const isActive = (iv: VisitIntervention) => (iv?.workflow_state ?? '').toUpperCase() === 'ACTIVE';

// Normalize any date-ish value (Carbon's DatePicker Date, or a bill-date string)
// to a full ISO timestamp, so the DTO's bill window is always full ISO.
const toIso = (value?: string | Date): string => {
  if (!value) {
    return '';
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

const SwitchInterventionForm: React.FC<SwitchInterventionWorkspaceProps> = ({
  closeWorkspace,
  promptBeforeClosing,
  consentToken,
  currentInterventions,
  patientId,
  billDate,
  onSwitchSuccess,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid;

  // Step 1 — the intervention being switched FROM.
  const [selectedCurrentCode, setSelectedCurrentCode] = useState<string>(
    (currentInterventions ?? []).find(isActive)?.intervention_code ?? '',
  );
  // Step 2a — the sub-benefit to browse (gates the interventions fetch).
  const [selectedSubBenefitCode, setSelectedSubBenefitCode] = useState<string>('');
  // Step 2b — the intervention being switched TO.
  const [targetCode, setTargetCode] = useState<string>('');

  const [retainBillItems, setRetainBillItems] = useState<boolean>(true);
  const [billFrom, setBillFrom] = useState<string>('');
  const [billTo, setBillTo] = useState<string>('');

  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sub-benefits load once; interventions load lazily only after a sub-benefit
  // is chosen (useInterventions returns a null key until both args are set).
  const { clientSubBenefits, isLoadingClientSubBenefits } = useClientSubBenefits(patientId);
  const { interventions, isLoadingInterventions } = useInterventions(patientId, selectedSubBenefitCode);

  // Only ACTIVE interventions are switchable.
  const activeInterventions = useMemo(() => (currentInterventions ?? []).filter(isActive), [currentInterventions]);
  const currentIntervention = useMemo(
    () => activeInterventions.find((iv) => iv.intervention_code === selectedCurrentCode),
    [activeInterventions, selectedCurrentCode],
  );

  // Candidate targets: interventions in the chosen sub-benefit, minus the source.
  const targetOptions = useMemo(
    () => (interventions ?? []).filter((iv) => iv.code !== selectedCurrentCode),
    [interventions, selectedCurrentCode],
  );
  const target = useMemo(() => targetOptions.find((iv) => iv.code === targetCode), [targetOptions, targetCode]);

  const subBenefitDiffers = Boolean(
    currentIntervention && selectedSubBenefitCode && selectedSubBenefitCode !== currentIntervention.sub_benefit_code,
  );
  const hasUnsavedSelection = Boolean(targetCode);

  useEffect(() => {
    promptBeforeClosing(() => hasUnsavedSelection);
  }, [promptBeforeClosing, hasUnsavedSelection]);

  if (!activeInterventions.length) {
    return (
      <div className={styles.emptyState}>
        <p>{t('noInterventionsToSwitch', 'This claim has no active interventions to switch.')}</p>
      </div>
    );
  }

  const pickCurrent = (code: string) => {
    setSelectedCurrentCode(code);
    setTargetCode('');
    setShowConfirm(false);
  };

  const pickSubBenefit = (code: string) => {
    setSelectedSubBenefitCode(code);
    setTargetCode('');
    setShowConfirm(false);
  };

  const confirmSwitch = async () => {
    if (!currentIntervention || !target || !locationUuid) {
      return;
    }
    setSubmitting(true);
    // Bill window is always full ISO. When not retaining, the endpoint still
    // needs one — default it to the bill's creation date through now.
    const now = new Date().toISOString();
    const dto: SwitchInterventionDto = {
      consentToken,
      existingInterventionCode: currentIntervention.intervention_code,
      newInterventionCode: target.code,
      retainBillItems,
      billFrom: retainBillItems ? billFrom : toIso(billDate) || now,
      billTo: retainBillItems ? billTo : now,
      locationUuid,
    };
    try {
      await switchClaimIntervention(dto);
      showSnackbar({
        kind: 'success',
        title: t('interventionSwitched', 'Intervention switched'),
        subtitle: t('interventionSwitchedSubtitle', 'Switched {{from}} → {{to}}.', {
          from: currentIntervention.intervention_code,
          to: target.code,
        }),
      });
      onSwitchSuccess?.();
      promptBeforeClosing(() => false);
      closeWorkspace();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('switchInterventionFailed', 'Switch failed'),
        subtitle: typeof error === 'string' ? error : (error as Error)?.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <div className={styles.body}>
        {/* Step 1 — intervention to switch from */}
        <section className={styles.section}>
          <h5 className={styles.sectionTitle}>{t('switchFrom', 'Intervention to switch')}</h5>
          {activeInterventions.length > 1 ? (
            <RadioButtonGroup
              legendText={t('whichToSwitch', 'Which intervention do you want to switch?')}
              name="current-intervention"
              valueSelected={selectedCurrentCode}
              orientation="vertical"
              onChange={(value) => pickCurrent(value as string)}
            >
              {activeInterventions.map((iv) => (
                <RadioButton
                  key={iv.intervention_code}
                  id={`cur-${iv.intervention_code}`}
                  value={iv.intervention_code}
                  labelText={`${iv.intervention_code} · ${iv.intervention_name}`}
                />
              ))}
            </RadioButtonGroup>
          ) : null}
          {currentIntervention ? (
            <div className={styles.currentCard}>
              <div className={styles.ivHead}>
                <span className={styles.ivCode}>{currentIntervention.intervention_code}</span>
                <Tag size="sm" type="blue">
                  {currentIntervention.sub_benefit_code || t('noSubBenefit', 'No sub-benefit')}
                </Tag>
              </div>
              <div className={styles.ivName}>{currentIntervention.intervention_name}</div>
              <div className={styles.ivFlags}>
                <span>{currentIntervention.intervention_payment_mechanism}</span>
                {currentIntervention.needs_preauth ? (
                  <>
                    <span>·</span>
                    <span>{t('preauth', 'preauth')}</span>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {/* Step 2 — sub-benefit, then intervention to switch to */}
        <section className={styles.section}>
          <h5 className={styles.sectionTitle}>{t('switchTo', 'Switch to')}</h5>
          <p className={styles.sectionSub}>
            {t('pickSubBenefitFirst', 'Pick a sub-benefit to load its interventions — not limited to the source’s.')}
          </p>

          {!patientId ? (
            <p className={styles.hintBad}>
              {t('missingPatientId', "Patient identifier unavailable — can't load interventions.")}
            </p>
          ) : (
            <>
              <Dropdown
                id="sub-benefit"
                titleText={t('subBenefit', 'Sub-benefit')}
                label={
                  isLoadingClientSubBenefits
                    ? t('loading', 'Loading…')
                    : t('selectSubBenefit', 'Select a sub-benefit')
                }
                items={clientSubBenefits ?? []}
                itemToString={(item) =>
                  item ? `${(item as ClientSubBenefit).name} (${(item as ClientSubBenefit).code})` : ''
                }
                selectedItem={(clientSubBenefits ?? []).find((sb) => sb.code === selectedSubBenefitCode) ?? null}
                disabled={isLoadingClientSubBenefits}
                onChange={({ selectedItem }) => pickSubBenefit((selectedItem as ClientSubBenefit)?.code ?? '')}
              />

              {selectedSubBenefitCode ? (
                isLoadingInterventions ? (
                  <InlineLoading description={t('loadingInterventions', 'Loading interventions…')} />
                ) : targetOptions.length === 0 ? (
                  <p className={styles.hintBad}>
                    {t('noInterventionsInSubBenefit', 'No other interventions available in this sub-benefit.')}
                  </p>
                ) : (
                  <ComboBox
                    id="target-intervention"
                    titleText={t('targetIntervention', 'Target intervention')}
                    placeholder={t('searchIntervention', 'Search by code or name')}
                    items={targetOptions}
                    itemToString={(item) =>
                      item ? `${(item as Intervention).code} · ${(item as Intervention).name}` : ''
                    }
                    selectedItem={target ?? null}
                    onChange={({ selectedItem }) => {
                      setTargetCode((selectedItem as Intervention)?.code ?? '');
                      setShowConfirm(false);
                    }}
                  />
                )
              ) : null}
            </>
          )}

          {target ? (
            <div className={styles.ivGrid}>
              <div className={`${styles.ivTile} ${styles.ivTileActive}`}>
                <div className={styles.ivHead}>
                  <span className={styles.ivCode}>{target.code}</span>
                  <div className={styles.tagRow}>
                    <Tag size="sm" type="cyan">
                      {selectedSubBenefitCode || t('noSubBenefit', 'No sub-benefit')}
                    </Tag>
                    {target.needsPreauth ? (
                      <Tag size="sm" type="magenta">
                        {t('preauthTag', 'Preauth')}
                      </Tag>
                    ) : null}
                  </div>
                </div>
                <div className={styles.ivName}>{target.name}</div>
                <div className={styles.ivFlags}>
                  <span>{target.paymentMechanism}</span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Retain bill items */}
        <section className={styles.section}>
          <Toggle
            id="retain-bill-items"
            size="sm"
            labelText={t('retainBillItems', 'Retain bill items')}
            labelA={t('no', 'No')}
            labelB={t('yes', 'Yes')}
            toggled={retainBillItems}
            onToggle={(checked) => setRetainBillItems(checked)}
          />
          {retainBillItems ? (
            <div className={styles.dateRange}>
              <DatePicker datePickerType="single" dateFormat="Y-m-d" onChange={(dates) => setBillFrom(toIso(dates?.[0]))}>
                <DatePickerInput id="bill-from" labelText={t('billFrom', 'Bill from')} placeholder="yyyy-mm-dd" size="md" />
              </DatePicker>
              <DatePicker datePickerType="single" dateFormat="Y-m-d" onChange={(dates) => setBillTo(toIso(dates?.[0]))}>
                <DatePickerInput id="bill-to" labelText={t('billTo', 'Bill to')} placeholder="yyyy-mm-dd" size="md" />
              </DatePicker>
            </div>
          ) : null}
        </section>

        {/* Confirmation prompt */}
        {showConfirm && currentIntervention && target ? (
          <div className={styles.switchPrompt}>
            <Renew size={18} />
            <div className={styles.switchBody}>
              <p>
                {t('switchConfirmPrompt', 'Switch')}{' '}
                <strong>
                  {currentIntervention.intervention_code} · {currentIntervention.intervention_name}
                </strong>{' '}
                →{' '}
                <strong>
                  {target.code} · {target.name}
                </strong>
                ? {t('billItemsWillBe', 'Bill items will be')}{' '}
                <strong>{retainBillItems ? t('retained', 'retained') : t('notRetained', 'not retained')}</strong>.
              </p>
              {subBenefitDiffers ? (
                <p className={styles.warn}>
                  <WarningAltFilled size={16} />
                  <span>
                    {t('subBenefitChanges', 'Sub-benefit changes from {{from}} to {{to}}.', {
                      from: currentIntervention.sub_benefit_code || '—',
                      to: selectedSubBenefitCode || '—',
                    })}
                  </span>
                </p>
              ) : null}
              {target.needsPreauth ? (
                <p className={styles.warn}>
                  <WarningAltFilled size={16} />
                  <span>{t('targetNeedsPreauth', '{{name}} requires preauthorisation.', { name: target.name })}</span>
                </p>
              ) : null}
              <div className={styles.switchActions}>
                <Button kind="danger--tertiary" size="sm" onClick={confirmSwitch} disabled={submitting}>
                  {submitting ? (
                    <InlineLoading description={t('switching', 'Switching…')} />
                  ) : (
                    t('confirmSwitch', 'Confirm switch')
                  )}
                </Button>
                <Button kind="ghost" size="sm" onClick={() => setShowConfirm(false)} disabled={submitting}>
                  {t('cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ButtonSet className={styles.buttonSet}>
        <Button kind="secondary" onClick={() => closeWorkspace()} disabled={submitting}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="primary" onClick={() => setShowConfirm(true)} disabled={!targetCode || submitting || showConfirm}>
          {t('switchIntervention', 'Switch intervention')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

// Remount the whole form when the workspace is reused for a different claim /
// patient, so no selection, fetched data, or Carbon widget state carries over.
const SwitchInterventionWorkspace: React.FC<SwitchInterventionWorkspaceProps> = (props) => (
  <SwitchInterventionForm key={`${props.consentToken}::${props.patientId ?? ''}`} {...props} />
);

export default SwitchInterventionWorkspace;
