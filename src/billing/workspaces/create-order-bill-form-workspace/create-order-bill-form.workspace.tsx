import { Order } from "@openmrs/esm-patient-common-lib";
import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { validationSchema, type CreateOrderBillFormSchema } from "./schema";
import { ResponsiveWrapper, showSnackbar, useLayoutType } from "@openmrs/esm-framework";
import { useTranslation } from "react-i18next";
import { Column, FilterableMultiSelect, Select, SelectItem, Form, FormGroup, Stack, TextInput, InlineNotification, ButtonSet, Button, InlineLoading } from "@carbon/react";
import styles from './create-order-bill-form.scss';
import React from "react";
import classNames from 'classnames';
import { createOrderBillInHie, createPatientBill, removePatientBill, useBillableItems, useCashPoint } from "./create-order-bill-form.resource";

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
    const { lineItems, isLoading: isLoadingLineItems } = useBillableItems();
    const { cashPoints } = useCashPoint();
    const cashPointUuid = cashPoints?.[0]?.uuid ?? '';
    const conceptUuid = order?.concept?.uuid;

    const {
        control,
        watch,
        handleSubmit,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<CreateOrderBillFormSchema>({
        resolver: zodResolver(validationSchema),
        defaultValues: {
            quantity: quantity ?? 1
        }
    });

    const unitPriceObservable = watch('unitPrice');

    const onSubmit = async (data) => {
        try {
            if (isSubmitting) {
                return;
            }

            const unitPriceTxt = data?.unitPrice;
            const serviceUuid = unitPriceTxt?.split("#")[0];
            const servicePriceUuid = unitPriceTxt?.split("#")[1];

            const billableItems = lineItems
                .filter((item) => item.uuid === serviceUuid)
                .map((item, index) => ({
                    billableService: item.uuid,
                    quantity: data.quantity,
                    item: conceptUuid,
                    price: item.servicePrices?.find(service => service.uuid === servicePriceUuid)?.price || '0.000',
                    priceName: item.servicePrices?.find(service => service.uuid === servicePriceUuid)?.name || 'Default',
                    priceUuid: servicePriceUuid || '',
                    lineItemOrder: index,
                    paymentStatus: 'PENDING',
                }));
            const billPayload = {
                lineItems: billableItems,
                cashPoint: cashPointUuid,
                patient: order?.patient?.uuid,
                status: 'PENDING',
                payments: [],
            };

            const response = await createPatientBill(billPayload);
            let billUuid = response.data.uuid;

            const hiePayload = {
                bill_uuid: billUuid,
                order_no: order?.orderNumber
            };

            try {
                await createOrderBillInHie(hiePayload);
            } catch (error) {
                await removePatientBill(billUuid);
                throw error;
            }

            showSnackbar({
                title: t('billSuccess', 'Bill created'),
                subtitle: t('billSuccessMessage', "Patient's bill has been created successfully"),
                kind: 'success',
            });

            mutated();
            closeWorkspace();
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

                    <Column>
                        <Controller
                            control={control}
                            name="unitPrice"
                            render={({ field }) => {

                                const availableServices = lineItems
                                    .filter(
                                        (service) => service?.serviceType?.uuid === serviceTypeUuid && service?.concept?.uuid === conceptUuid,
                                    );
                                const servicePrices = availableServices[0]?.servicePrices ?? [];
                                const serviceUuid = availableServices[0]?.uuid ?? "";

                                return (
                                    <>
                                        {servicePrices.length > 0 ? (
                                            <Select id="unitPrice" labelText={t('selectServicePrice', 'Select service price *')} invalid={!!errors.unitPrice}
                                                invalidText={errors.unitPrice?.message}
                                                onChange={(e) => {
                                                    field.onChange(e.target.value);
                                                }}
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
                                        )}
                                    </>
                                );
                            }}
                        />
                    </Column>
                </Stack>
            </div>

            <ButtonSet className={classNames(styles.buttonSet, { [styles.tablet]: isTablet })}>
                <Button kind="secondary" onClick={closeWorkspace}>
                    {t('cancel', 'Cancel')}
                </Button>
                <Button kind="primary" type="submit" disabled={isSubmitting || !isDirty}>
                    {isSubmitting ? (
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