import { Order } from "@openmrs/esm-patient-common-lib";
import { act, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { validationSchema, type CreateOrderBillFormSchema } from "./schema";
import { ExtensionSlot, FetchResponse, OpenmrsResource, ResponsiveWrapper, showSnackbar, useConfig, useDebounce, useLayoutType, useSession, useVisit } from "@openmrs/esm-framework";
import { useTranslation } from "react-i18next";
import { Column, FilterableMultiSelect, Select, SelectItem, Form, FormGroup, Stack, TextInput, InlineNotification, ButtonSet, Button, InlineLoading, Search, Layer, Tile, FormLabel } from "@carbon/react";
import styles from './create-order-bill-form.scss';
import React from "react";
import classNames from 'classnames';
import { createOrderBillInHie, createPatientBill, removePatientBill, updatePatientBill, useBillableItems, useCashPoint, usePatientBills, usePatientIdentifiers } from "./create-order-bill-form.resource";
import { generateUpdateBillLineItems } from "../../utils";
import { IdentifierTypesUuids } from "../../../resources/identifier-types";
import { type ConfigObject } from "../../../config-schema";
import { type ClaimIntervention } from "../../../claims";
import { getConsentToken, getPaymentMode, getServiceType } from "../../../shared/services/claims.resource";
import { useProviderClaimPreview } from "../../billing-claims.resource";

interface CreateOrderBillFormProps {
    closeWorkspace: () => void;
    quantity: number;
    order: Order,
    mutated: () => void;
    serviceTypeUuid: string;
}

const CreateOrderBillForm: React.FC<CreateOrderBillFormProps> = ({
    closeWorkspace, quantity, order, mutated, serviceTypeUuid
}) => {
    const { t } = useTranslation();
    const isTablet = useLayoutType() === 'tablet';
    const { activeVisit } = useVisit(order?.patient?.uuid);
    const { lineItems, isLoading: isLoadingLineItems } = useBillableItems(); //useBillableItems(serviceTypeUuid);
    const { currentDayBills } = usePatientBills(order?.patient?.uuid);
    const { identifiers } = usePatientIdentifiers(order?.patient?.uuid);
    const { cashPoints } = useCashPoint();
    const sessionLocation = useSession();
    const { claimVisit, isLoading: isLoadingClaimVisits } = useProviderClaimPreview(getConsentToken(activeVisit), sessionLocation?.sessionLocation?.uuid);
    const patientUuid = order?.patient?.uuid;
    const conceptUuid = order?.concept?.uuid;
    const { nonSHAPaymentModes, consultationBillableServiceNames, subBenefitCodesWithHiddenClaimWidget } = useConfig<ConfigObject>();
    const [searchTerm, setSearchTerm] = useState('');
    const [triggerAddIntervention, setTriggerAddIntervention] = useState<boolean>(false);
    const [interventionResult, setInterventionResult] = useState<ClaimIntervention>();
    const [pendingSubmitData, setPendingSubmitData] = useState<CreateOrderBillFormSchema | null>(null);
    const [isSubmitPending, setIsSubmitPending] = useState(false);
    const debouncedSearchTerm = useDebounce(searchTerm.trim());
    const searchInputRef = useRef(null);
    const searchResults = useMemo(() => {
        if (debouncedSearchTerm) {
            const filteredItems = lineItems.filter(item => item?.name.toLowerCase()?.includes(debouncedSearchTerm.toLowerCase()));
            return filteredItems;
        }
        return [];
    }, [debouncedSearchTerm])

    const {
        control,
        watch,
        handleSubmit,
        setValue,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<CreateOrderBillFormSchema>({
        resolver: zodResolver(validationSchema),
        defaultValues: {
            quantity: quantity ?? 1
        }
    });

    const selectedServicePrice = watch('unitPrice');

    const selectedServicePriceUuid = useMemo(() => {
        if (selectedServicePrice) {
            return selectedServicePrice.split("#")[1];
        }
    }, [selectedServicePrice]);

    const initialPriceName = useMemo(() => {
        let priceName = "";
        if (currentDayBills && currentDayBills.length) {
            const bill = currentDayBills[0];
            priceName = bill?.lineItems?.find(i => consultationBillableServiceNames.includes(i?.billableService?.toUpperCase()))?.priceName;
        }
        return priceName;
    }, [currentDayBills]);

    const initialCashPoint = useMemo(() => {
        let cashPoint = "";
        if (currentDayBills && currentDayBills.length) {
            const bill = currentDayBills[0];
            const currentCashpoint = bill?.cashPoint;
            cashPoint = currentCashpoint?.uuid;
            setValue("cashPoint", cashPoint);
        }
        return cashPoint;
    }, [currentDayBills]);

    const selectedBillableItem = useWatch({ control, name: 'billableItem' });
    const billableItem = useMemo(() => {
        if (selectedBillableItem) {
            let filteredItems = lineItems.filter(item => item?.uuid === selectedBillableItem);
            return filteredItems;
        }
        return [];
    }, [selectedBillableItem, initialPriceName]);

    const isSHAEligible = useMemo(() => {
        if (identifiers) {
            return identifiers?.some(v => v.identifierType.uuid === IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID);
        }
        return false;
    }, [identifiers]);

    const crIdentifierId = useMemo(() => {
        return identifiers?.find(i => i.identifierType.uuid == IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID)?.identifier
    }, [identifiers])

    const servicePrices = useMemo(() => {
        if (billableItem && billableItem.length && identifiers) {
            let sPs = billableItem[0]?.servicePrices ?? [];
            // add the non-sha payments
            sPs = sPs && sPs.length && !isSHAEligible ? sPs.filter(v => nonSHAPaymentModes.includes(v?.paymentMode?.uuid)) : sPs;
            return sPs;
        }
        return [];
    }, [billableItem, identifiers]);

    const isSHAPaymentMode = useMemo(() => {
        if (servicePrices && selectedServicePriceUuid) {
            return servicePrices?.some((v) => v?.uuid === selectedServicePriceUuid && v?.name?.toUpperCase()?.includes("SHA"));
        }
        return false;
    }, [servicePrices, selectedServicePriceUuid]);

    const initialUnitPriceUuid = useMemo(() => {
        if (billableItem && billableItem.length) {
            const serviceUuid = billableItem[0]?.uuid ?? "";

            let initialServicePriceUuid = "";
            if (initialPriceName) {
                initialServicePriceUuid = servicePrices?.find(sP => sP?.paymentMode?.name?.toUpperCase() === initialPriceName.toUpperCase())?.uuid;
            }

            if (activeVisit && !initialPriceName) {
                const paymentModeUuid = getPaymentMode(activeVisit);
                if (paymentModeUuid) {
                    initialServicePriceUuid = servicePrices?.find(sP => sP?.paymentMode?.uuid === paymentModeUuid)?.uuid;
                }
            }

            const value = serviceUuid + "#" + initialServicePriceUuid;
            setValue("unitPrice", value);
            return value;
        }
        return null;
    }, [billableItem, initialPriceName, activeVisit]);

    const showClaimWidget = useMemo(() => {
        if (!isLoadingClaimVisits && claimVisit) {
            if ("error" in claimVisit) {
                return false;
            }
            return claimVisit.interventions.some((i) => !subBenefitCodesWithHiddenClaimWidget.includes(i.sub_benefit_code));
        }
        return false;
    }, [claimVisit, isLoadingClaimVisits])

    const onAddIntervention = (result: ClaimIntervention) => {
        if (result) {
            setInterventionResult(result);
        } else {
            setIsSubmitPending(false);
        }
    }

    const handleFormSubmit = async (data) => {
        const unitPriceTxt = data?.unitPrice;
        const serviceUuid = unitPriceTxt?.split("#")[0];
        const servicePriceUuid = unitPriceTxt?.split("#")[1];
        const lineItemOrder = order?.orderNumber?.split("-")[1] ?? null;
        const cashPointUuid = data?.cashPoint;

        const billableItems = lineItems
            .filter((item) => item.uuid === serviceUuid)
            .map((item, index) => {
                const price = item.servicePrices?.find(service => service.uuid === servicePriceUuid)?.price || 0;
                const paymentStatus = price == 0 ? "PAID" : "PENDING";
                return {
                    billableService: item.uuid,
                    quantity: data.quantity,
                    item: conceptUuid,
                    price: price,
                    priceName: item.servicePrices?.find(service => service.uuid === servicePriceUuid)?.name || 'Default',
                    priceUuid: servicePriceUuid || '',
                    lineItemOrder: Number(lineItemOrder) ?? index,
                    status: paymentStatus,
                }
            });
        let billPayload = {};

        let response: FetchResponse<{ uuid: string, lineItems: Array<{ lineItemOrder: number; uuid: string }> }> | undefined;

        if (currentDayBills && currentDayBills.length) {
            const bill = currentDayBills[0];
            const billUuid = bill?.uuid;
            const initialLineItems = generateUpdateBillLineItems(bill, lineItems);
            const lineItemsPayload = [...initialLineItems, ...billableItems];
            billPayload = {
                lineItems: lineItemsPayload
            }
            response = await updatePatientBill(billUuid, billPayload);
        } else {
            billPayload = {
                lineItems: billableItems,
                cashPoint: cashPointUuid,
                patient: order?.patient?.uuid,
                status: 'PENDING',
                payments: []
            };
            response = await createPatientBill(billPayload);
        }

        const billUuidResp = response?.data?.uuid;
        const lineItemUuid = response?.data?.lineItems?.find(v => v?.lineItemOrder === Number(lineItemOrder))?.uuid;

        if (billUuidResp) {
            let hiePayload = {
                bill_uuid: billUuidResp,
                order_no: order?.orderNumber,
                line_item_uuid: lineItemUuid
            };

            if (interventionResult) {
                const electivePreauth = interventionResult.requires_oncology_preauth || interventionResult.requires_optical_preauth || interventionResult.requires_radiology_preauth
                    || interventionResult.requires_renal_preauth || interventionResult.requires_surgical_preauth;
                const requiresPreauth = interventionResult.needs_preauth;
                const requiredPreauthDocumentTypes = interventionResult.required_preauth_document_types;
                const applicableDocumentTypes = interventionResult.applicable_document_types;

                let intervention = {
                    intervention_code: interventionResult.intervention_code,
                    consent_token: getConsentToken(activeVisit),
                    service_type: getServiceType(interventionResult, "OUTPATIENT"),
                    requires_preauth: requiresPreauth,
                    normal_preauth: requiresPreauth && !electivePreauth,
                    elective_preauth: electivePreauth
                }

                if (applicableDocumentTypes && applicableDocumentTypes.length) {
                    intervention["applicable_document_types"] = applicableDocumentTypes.join(",");
                }

                if (requiredPreauthDocumentTypes && requiredPreauthDocumentTypes.length) {
                    intervention["required_preauth_document_types"] = requiredPreauthDocumentTypes.join(",");
                }

                hiePayload = {
                    ...hiePayload,
                    ...intervention
                }
            }

            try {
                await createOrderBillInHie(hiePayload);
            } catch (error) {
                await removePatientBill(billUuidResp);
                throw error;
            }
        } else {
            throw new Error("Bill uuid not found!");
        }

        showSnackbar({
            title: t('billSuccess', 'Bill created'),
            subtitle: t('billSuccessMessage', "Patient's bill has been created successfully"),
            kind: 'success',
        });

        mutated();
        closeWorkspace();
    }

    useEffect(() => {
        if (triggerAddIntervention && interventionResult && pendingSubmitData) {
            const submitPendingData = async () => {
                try {
                    await handleFormSubmit(pendingSubmitData);
                } catch (error) {
                    showSnackbar({
                        title: t('error', 'Error'),
                        subtitle: error?.message || t('unknownError', 'An unknown error occurred'),
                        kind: 'error',
                    });
                } finally {
                    setPendingSubmitData(null);
                    setTriggerAddIntervention(false);
                }
            };
            void submitPendingData();
        }
    }, [triggerAddIntervention, interventionResult, pendingSubmitData]);

    const onSubmit = async (data) => {
        try {
            if (isSubmitting) {
                return;
            }

            setIsSubmitPending(true);

            if (isSHAPaymentMode && showClaimWidget) {
                setPendingSubmitData(data);
                setTriggerAddIntervention(true);
                if (interventionResult) {
                    await handleFormSubmit(data);
                    setPendingSubmitData(null);
                    setTriggerAddIntervention(false);
                }
                return;
            }
            await handleFormSubmit(data);
        } catch (error) {
            showSnackbar({
                title: t('error', 'Error'),
                subtitle: error?.message || t('unknownError', 'An unknown error occurred'),
                kind: 'error',
            });
        }
    }

    return (
        <Form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.formContainer}>
                <Stack gap={3}>
                    <InlineNotification
                        kind="info"
                        title={`${order?.orderNumber} - ${order?.display}`}
                        lowContrast
                    />

                    <ResponsiveWrapper>
                        <FormGroup legendText="">
                            <Column>
                                <Controller
                                    name="quantity"
                                    control={control}
                                    render={({ field }) => (
                                        <TextInput
                                            {...field}
                                            id="quantity"
                                            labelText={t('quantity', 'Quantity *')}
                                            placeholder={t('enterQuantity', 'Enter quantity')}
                                            invalid={!!errors.quantity}
                                            invalidText={errors.quantity?.message}
                                        />
                                    )}
                                />
                            </Column>
                        </FormGroup>
                    </ResponsiveWrapper>

                    <ResponsiveWrapper>
                        <Controller
                            name="billableItem"
                            control={control}
                            render={({ field }) => (
                                <>
                                    <FormLabel className={styles.conceptLabel}>{t('billableItem', 'Billable item')}</FormLabel>
                                    <Search
                                        id="billableItemSearch"
                                        labelText={t('billableItem', 'Billable item')}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                        onClear={() => {
                                            setSearchTerm('');
                                            field.onChange('');
                                        }}
                                        placeholder={t('searchBillableItem', 'Search billable item')}
                                        ref={searchInputRef}
                                        value={lineItems.find(v => v.uuid === selectedBillableItem)?.name || searchTerm}
                                    />

                                    {(() => {
                                        if (!debouncedSearchTerm || selectedBillableItem) {
                                            return null;
                                        }
                                        if (searchResults && searchResults.length) {

                                            return (
                                                <ul className={styles.conceptsList}>
                                                    {searchResults?.map((item) => (
                                                        <li
                                                            className={styles.service}
                                                            key={item?.uuid}
                                                            onClick={() => {
                                                                field.onChange(item?.uuid);
                                                                setSearchTerm('');
                                                            }}
                                                            role="menuitem">
                                                            {item?.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            );
                                        }
                                        return (
                                            <Layer>
                                                <Tile className={styles.emptyResults}>
                                                    <span>
                                                        {t('noResultsFor', 'No results for {{searchTerm}}', { searchTerm: debouncedSearchTerm })}
                                                    </span>
                                                </Tile>
                                            </Layer>
                                        );
                                    })()}
                                </>
                            )}
                        />
                    </ResponsiveWrapper>

                    <Column>
                        <Controller
                            control={control}
                            name="cashPoint"
                            render={({ field }) => {
                                return (
                                    <>
                                        {billableItem && billableItem.length ?
                                            <Select id="cashPoint" labelText={t('selectCashPoint', 'Select cashpoint *')} invalid={!!errors.cashPoint}
                                                invalidText={errors.cashPoint?.message}
                                                onChange={(e) => {
                                                    field.onChange(e.target.value);
                                                }}
                                                defaultValue={initialCashPoint ?? null}
                                            >
                                                <SelectItem value="" text="Select cashpoint" />
                                                {
                                                    cashPoints.map((cashPoint) => {
                                                        return (
                                                            <SelectItem value={cashPoint?.uuid} text={cashPoint?.name} />
                                                        )
                                                    })
                                                }
                                            </Select>
                                            : <></>
                                        }
                                    </>
                                );
                            }}
                        />
                    </Column>

                    <Column>
                        <Controller
                            control={control}
                            name="unitPrice"
                            render={({ field }) => {
                                const serviceUuid = billableItem[0]?.uuid ?? "";

                                return (
                                    <>
                                        {billableItem && billableItem.length ?
                                            (servicePrices.length > 0 ? (
                                                <Select id="unitPrice" labelText={t('selectServicePrice', 'Select service price *')} invalid={!!errors.unitPrice}
                                                    invalidText={errors.unitPrice?.message}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value);
                                                    }}
                                                    defaultValue={initialUnitPriceUuid ?? null}
                                                >
                                                    <SelectItem value="" text="Select service price" />
                                                    {
                                                        servicePrices.map((service) => {
                                                            const value = serviceUuid + "#" + service?.uuid;
                                                            const text = `${service?.name} - ${service?.price}`;
                                                            return (
                                                                <SelectItem value={value} text={text} />
                                                            )
                                                        })
                                                    }
                                                </Select>
                                            ) : (
                                                <InlineNotification
                                                    kind="warning"
                                                    title={t(
                                                        'noServicesAvailable',
                                                        'No service price has been configured for this order.',
                                                    )}
                                                    lowContrast
                                                />
                                            )) : null
                                        }
                                    </>
                                );
                            }}
                        />
                    </Column>
                    {
                        isSHAPaymentMode && showClaimWidget ?
                            getConsentToken(activeVisit) ?
                                <Column>
                                    <ExtensionSlot name='billing-claims-slot' state={{ clientRegistryId: crIdentifierId, patientUuid, isNewVisit: false, triggerAddIntervention, onSelectChange: () => { }, onAddIntervention }} />
                                </Column>
                                :
                                <InlineNotification
                                    kind="warning"
                                    title={t(
                                        'noActiveClaimVisitAvailable',
                                        'No active claim visit available.',
                                    )}
                                    lowContrast
                                />
                            :
                            <></>
                    }
                </Stack>
            </div>

            <ButtonSet className={classNames(styles.buttonSet, { [styles.tablet]: isTablet })}>
                <Button kind="secondary" onClick={closeWorkspace}>
                    {t('cancel', 'Cancel')}
                </Button>
                <Button kind="primary" type="submit" disabled={isSubmitting || isSubmitPending || !isDirty}>
                    {isSubmitting || isSubmitPending ? (
                        <InlineLoading description={t('submitting', 'Submitting...')} />
                    ) : (
                        t('saveAndClose', 'Save & close')
                    )}
                </Button>
            </ButtonSet>
        </Form>
    )
}

export default CreateOrderBillForm;