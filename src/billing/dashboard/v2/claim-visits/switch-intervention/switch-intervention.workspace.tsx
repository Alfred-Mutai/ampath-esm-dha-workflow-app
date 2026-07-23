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
import { showSnackbar, useConfig, useSession, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './switch-intervention.workspace.scss';
import { type SwitchInterventionDto, type VisitIntervention } from '../../types';
import { switchClaimIntervention } from '../../../../billing-claims.resource';
import { useClientSubBenefits, useInterventions } from '../../../../../claims/claims.resource';
import { type ClientSubBenefit, type Intervention } from '../../../../../claims';
import { type ConfigObject } from '../../../../../config-schema';
import { type CreateBillDto } from '../../../../../shared/types';
import {
  createOrderBillInHie,
  createPatientBill,
  removePatientBill,
  useBillableItems,
  useCashPoint,
} from '../../../../workspaces/create-order-bill-form-workspace/create-order-bill-form.resource';
import { createSwitchInterventionOrder } from './switch-intervention.resource';

type ServicePrice = { uuid: string; name: string; price: number; paymentMode?: { uuid: string; name: string } };

interface SwitchInterventionWorkspaceProps extends DefaultWorkspaceProps {
  consentToken: string;
  currentInterventions: VisitIntervention[];
  patientId?: string;
  patientUuid?: string;
  visitUuid?: string;
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
  patientUuid,
  visitUuid,
  billDate,
  onSwitchSuccess,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid;
  const {
    orderEncounterTypeUuid,
    outPatientCareSettingUuid,
    shaConsulationConceptUuid,
    shaPaymentModeUuid,
  } = useConfig<ConfigObject>();

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

  // Step 2b — the service type whose SHA-tariff price becomes the switch's
  // billed amount. Keyed to the currently selected target so a target
  // change starts it over.
  const [selectedServiceUuid, setSelectedServiceUuid] = useState<string>('');

  // The OpenMRS order is created only *after* switchClaimIntervention
  // succeeds — switchCompleted gates the post-switch order-creation step and
  // locks the form against a second submission. The bill item is then
  // created only after the order exists, tied to it via orderNumber.
  const [switchCompleted, setSwitchCompleted] = useState<boolean>(false);
  const [creatingOrder, setCreatingOrder] = useState<boolean>(false);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [orderError, setOrderError] = useState<string>('');
  const [creatingBillItem, setCreatingBillItem] = useState<boolean>(false);
  const [billItemCreated, setBillItemCreated] = useState<boolean>(false);
  const [billItemError, setBillItemError] = useState<string>('');

  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { lineItems: billableItems } = useBillableItems();
  const { cashPoints } = useCashPoint();
  const selectedBillableItem = useMemo(
    () => (billableItems ?? []).find((item) => item.uuid === selectedServiceUuid),
    [billableItems, selectedServiceUuid],
  );
  const shaPrice = useMemo(
    () =>
      (selectedBillableItem?.servicePrices as ServicePrice[] | undefined)?.find(
        (sp) => sp.paymentMode?.uuid === shaPaymentModeUuid,
      ),
    [selectedBillableItem, shaPaymentModeUuid],
  );

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

  // Create the bill item for the switch. Called only after the OpenMRS order
  // already exists, tying the two together via orderNumber — mirrors
  // create-order-bill-form.workspace.tsx's create-then-link-to-HIE pattern.
  // A failure here never leaves an orphaned order: the order already
  // succeeded, so the user just retries this step alone.
  const attemptCreateBillItem = async (createdOrderNumber: string) => {
    if (!selectedBillableItem || !shaPrice) {
      setBillItemError(t('missingServiceType', 'Select a service type before creating the bill item.'));
      return;
    }
    const cashPointUuid = cashPoints?.[0]?.uuid;
    if (!cashPointUuid || !patientUuid) {
      setBillItemError(
        t('missingBillContext', 'Cash point or patient context unavailable — cannot create the bill item.'),
      );
      return;
    }
    setCreatingBillItem(true);
    setBillItemError('');
    try {
      const billPayload: CreateBillDto = {
        lineItems: [
          {
            billableService: selectedBillableItem.uuid,
            quantity: 1,
            price: shaPrice.price,
            priceName: shaPrice.name,
            priceUuid: shaPrice.uuid,
            lineItemOrder: 0,
            status: shaPrice.price === 0 ? 'PAID' : 'PENDING',
          },
        ],
        cashPoint: cashPointUuid,
        patient: patientUuid,
        status: 'PENDING',
        payments: [],
      };
      const billResponse = await createPatientBill(billPayload);
      const billUuid = billResponse?.data?.uuid;
      const lineItemUuid = billResponse?.data?.lineItems?.find((li) => li.lineItemOrder === 0)?.uuid;
      if (!billUuid) {
        throw new Error('Bill was created without a uuid');
      }
      try {
        await createOrderBillInHie({
          bill_uuid: billUuid,
          order_no: createdOrderNumber,
          line_item_uuid: lineItemUuid,
          intervention_code: target?.code,
          consent_token: consentToken,
        });
      } catch (hieError) {
        await removePatientBill(billUuid);
        throw hieError;
      }
      setBillItemCreated(true);
      // Refresh again now that the order + bill are actually in place, on
      // top of the earlier refresh right after the switch itself succeeded.
      onSwitchSuccess?.();
      promptBeforeClosing(() => false);
      closeWorkspace();
    } catch (error) {
      setBillItemError(typeof error === 'string' ? error : (error as Error)?.message ?? 'Failed to create bill item.');
      showSnackbar({
        kind: 'error',
        title: t('billItemCreationFailed', 'Bill item creation failed'),
        subtitle: t(
          'billItemCreationFailedSubtitle',
          'The order was already created. Retry creating the bill item below.',
        ),
      });
    } finally {
      setCreatingBillItem(false);
    }
  };

  // Create the OpenMRS order for the switch. Called only after
  // switchClaimIntervention has already succeeded, so a failure here never
  // leaves an orphaned order — the switch itself is already done, and the
  // user can retry just this step.
  const attemptCreateOrder = async () => {
    if (!patientUuid || !visitUuid || !locationUuid) {
      setOrderError(t('missingOrderContext', 'Patient or visit context unavailable — cannot create an order.'));
      return;
    }
    setCreatingOrder(true);
    setOrderError('');
    try {
      const { orderNumber: createdOrderNumber } = await createSwitchInterventionOrder({
        patientUuid,
        visitUuid,
        locationUuid,
        providerUuid: session.currentProvider?.uuid ?? '',
        orderEncounterTypeUuid,
        outPatientCareSettingUuid,
        shaConsulationConceptUuid,
      });
      setOrderNumber(createdOrderNumber);
      await attemptCreateBillItem(createdOrderNumber);
    } catch (error) {
      setOrderError(typeof error === 'string' ? error : (error as Error)?.message ?? 'Failed to create order.');
      showSnackbar({
        kind: 'error',
        title: t('orderCreationFailed', 'Order creation failed'),
        subtitle: t(
          'orderCreationFailedSubtitle',
          'The intervention switch already succeeded. Retry creating the order below.',
        ),
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  const subBenefitDiffers = Boolean(
    currentIntervention && selectedSubBenefitCode && selectedSubBenefitCode !== currentIntervention.sub_benefit_code,
  );
  const hasUnsavedSelection = Boolean(targetCode) && (!switchCompleted || !orderNumber || !billItemCreated);

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

  // Clears the service-type selection and any switch/order/bill progress so
  // nothing from a previous target carries into a switch for a different one.
  const resetOrderState = () => {
    setSelectedServiceUuid('');
    setSwitchCompleted(false);
    setOrderNumber('');
    setOrderError('');
    setBillItemCreated(false);
    setBillItemError('');
  };

  const pickCurrent = (code: string) => {
    setSelectedCurrentCode(code);
    setTargetCode('');
    setShowConfirm(false);
    resetOrderState();
  };

  const pickSubBenefit = (code: string) => {
    setSelectedSubBenefitCode(code);
    setTargetCode('');
    setShowConfirm(false);
    resetOrderState();
  };

  const pickTarget = (code: string) => {
    setTargetCode(code);
    setShowConfirm(false);
    resetOrderState();
  };

  const confirmSwitch = async () => {
    if (!currentIntervention || !target || !locationUuid || !shaPrice) {
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
      billedAmount: String(shaPrice.price),
    };
    try {
      await switchClaimIntervention(dto);
      setSwitchCompleted(true);
      showSnackbar({
        kind: 'success',
        title: t('interventionSwitched', 'Intervention switched'),
        subtitle: t('interventionSwitchedSubtitle', 'Switched {{from}} → {{to}}.', {
          from: currentIntervention.intervention_code,
          to: target.code,
        }),
      });
      onSwitchSuccess?.();
      // The switch succeeded before any order exists, so nothing is orphaned
      // if the order-creation step below fails — the user just retries it.
      await attemptCreateOrder();
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
                    onChange={({ selectedItem }) => pickTarget((selectedItem as Intervention)?.code ?? '')}
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

        {/* Step 2b — service type whose SHA-tariff price becomes the
            switch's billed amount. The OpenMRS order itself is only created
            after the switch succeeds (see the post-switch section below). */}
        {target && !switchCompleted ? (
          <section className={styles.section}>
            <h5 className={styles.sectionTitle}>{t('serviceType', 'Service type')}</h5>
            <ComboBox
              id="service-type"
              titleText={t('serviceType', 'Service type')}
              placeholder={t('searchServiceType', 'Search billable service')}
              items={billableItems ?? []}
              itemToString={(item) => item?.name ?? ''}
              selectedItem={selectedBillableItem ?? null}
              onChange={({ selectedItem }) => setSelectedServiceUuid(selectedItem?.uuid ?? '')}
            />
            {selectedBillableItem ? (
              shaPrice ? (
                <p className={styles.sectionSub}>{`${selectedBillableItem.name} (SHA: ${shaPrice.price})`}</p>
              ) : (
                <p className={styles.hintBad}>{t('noShaPrice', 'This service has no SHA price configured.')}</p>
              )
            ) : null}
          </section>
        ) : null}

        {/* Post-switch — the OpenMRS order is created only once the switch
            itself has succeeded, so a failure here never leaves an
            orphaned order; the user retries just this step. */}
        {switchCompleted ? (
          <section className={styles.section}>
            <h5 className={styles.sectionTitle}>{t('switchOrder', 'Switch order')}</h5>
            {creatingOrder ? (
              <InlineLoading description={t('creatingOrder', 'Creating order…')} />
            ) : orderNumber ? (
              <div className={styles.currentCard}>
                <span>
                  {t('orderCreated', 'Order created')}: <strong>{orderNumber}</strong>
                </span>
              </div>
            ) : orderError ? (
              <>
                <p className={styles.hintBad}>{orderError}</p>
                <Button kind="ghost" size="sm" onClick={attemptCreateOrder}>
                  {t('retry', 'Retry')}
                </Button>
              </>
            ) : null}

            {orderNumber ? (
              creatingBillItem ? (
                <InlineLoading description={t('creatingBillItem', 'Creating bill item…')} />
              ) : billItemCreated ? (
                <div className={styles.currentCard}>
                  <span>{t('billItemCreated', 'Bill item created')}</span>
                </div>
              ) : billItemError ? (
                <>
                  <p className={styles.hintBad}>{billItemError}</p>
                  <Button kind="ghost" size="sm" onClick={() => attemptCreateBillItem(orderNumber)}>
                    {t('retry', 'Retry')}
                  </Button>
                </>
              ) : null
            ) : null}
          </section>
        ) : null}

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
        {showConfirm && !switchCompleted && currentIntervention && target ? (
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
                , {t('billedAt', 'billed at')}{' '}
                <strong>
                  {shaPrice?.price} {t('via', 'via')} {selectedBillableItem?.name}
                </strong>
                . {t('billItemsWillBe', 'Bill items will be')}{' '}
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
        <Button
          kind="primary"
          onClick={() => setShowConfirm(true)}
          disabled={!targetCode || !shaPrice || submitting || showConfirm || switchCompleted}
        >
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
