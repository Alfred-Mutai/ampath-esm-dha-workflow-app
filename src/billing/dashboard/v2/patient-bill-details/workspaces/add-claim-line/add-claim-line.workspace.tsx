import React, { useState } from 'react';
import { Button, ButtonSet, Form, InlineLoading, Stack, TextInput } from '@carbon/react';
import { showSnackbar, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import styles from './add-claim-line.workspace.scss';
import { type AddClaimLineDto, type PatientFacilityBillDetails } from '../../../types';
import { addClaimItem } from '../../../../../billing-claims.resource';

interface AddClaimLineWorkspaceProps extends DefaultWorkspaceProps {
  billItem: PatientFacilityBillDetails;
  locationUuid: string;
  onSuccess?: () => void;
}

const AddClaimLineWorkspace: React.FC<AddClaimLineWorkspaceProps> = ({
  billItem,
  locationUuid,
  onSuccess,
  closeWorkspace,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  function getClaimLineDto(): AddClaimLineDto {
    return {
      consentToken: billItem.consent_token,
      interventionCode: billItem.intervention_code,
      unitPrice: String(billItem.item_price),
      quantity: String(billItem.item_quantity),
      locationUuid: locationUuid,
    };
  }

  async function handleAddClaimLineItem(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const resp = await addClaimItem(getClaimLineDto());
      if (resp['error']) {
        showSnackbar({
          title: resp['error'] ?? 'Error Adding Claim Line',
          kind: 'error',
          subtitle: resp['message'] ?? 'An error occurred while adding the claim line. Kindy retry or contact support',
        });
      } else {
        showSnackbar({
          title: 'Sucess Adding Claim Line',
          kind: 'success',
          subtitle: 'Claim Item added successfully',
        });
      }
      onSuccess?.();
      closeWorkspace();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error Adding Claim Line',
        subtitle: 'An error occurred while adding the claim line. Kindy retry or contact support',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form className={styles.form} onSubmit={handleAddClaimLineItem}>
      <div className={styles.formContent}>
        <Stack gap={5}>
          <TextInput id="bill-item" labelText="Billable item" value={billItem.billable_service ?? '—'} readOnly />
          <TextInput
            id="intervention-code"
            labelText="Intervention code"
            value={billItem.intervention_code ?? '—'}
            readOnly
          />
          <TextInput id="unit-price" labelText="Unit price" value={`Ksh ${billItem.item_price}`} readOnly />
          <TextInput id="quantity" labelText="Quantity" value={billItem.item_quantity} readOnly />
        </Stack>
      </div>

      <ButtonSet className={styles.buttonSet}>
        <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
          Cancel
        </Button>
        <Button className={styles.button} kind="primary" type="submit" disabled={loading}>
          {loading ? <InlineLoading description="Adding..." /> : 'Add claim line'}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default AddClaimLineWorkspace;
