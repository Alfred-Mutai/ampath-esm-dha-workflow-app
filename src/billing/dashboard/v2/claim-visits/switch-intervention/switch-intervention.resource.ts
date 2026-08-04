import { type CreateOrderEncounterDto } from '../../../../../shared/types';
import { createOrderEncounter, getOrder } from '../../../../../shared/services/encounters.resource';

type CreateSwitchInterventionOrderParams = {
  patientUuid: string;
  visitUuid: string;
  locationUuid: string;
  providerUuid: string;
  orderEncounterTypeUuid: string;
  outPatientCareSettingUuid: string;
  shaInterventionSwitchingUuid: string;
};

export async function createSwitchInterventionOrder({
  patientUuid,
  visitUuid,
  locationUuid,
  providerUuid,
  orderEncounterTypeUuid,
  outPatientCareSettingUuid,
  shaInterventionSwitchingUuid,
}: CreateSwitchInterventionOrderParams): Promise<{ orderUuid: string; orderNumber: string }> {
  const dto: CreateOrderEncounterDto = {
    patient: patientUuid,
    location: locationUuid,
    encounterType: orderEncounterTypeUuid,
    encounterDatetime: new Date().toISOString(),
    visit: visitUuid,
    obs: [],
    orders: [
      {
        action: 'NEW',
        type: 'order',
        patient: patientUuid,
        careSetting: outPatientCareSettingUuid,
        orderer: providerUuid,
        concept: shaInterventionSwitchingUuid,
        urgency: 'ROUTINE',
      },
    ],
  };

  const encounter = await createOrderEncounter(dto);
  const createdOrder = encounter?.orders?.[0];
  if (!createdOrder?.uuid) {
    throw new Error('Order encounter was created without an order');
  }

  const order = await getOrder(createdOrder.uuid);
  return { orderUuid: createdOrder.uuid, orderNumber: order?.orderNumber };
}
