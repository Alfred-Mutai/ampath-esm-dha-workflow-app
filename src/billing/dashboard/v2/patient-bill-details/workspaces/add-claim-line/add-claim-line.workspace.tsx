import React, { useEffect, useState } from 'react';
import { Button, ButtonSet, Form, InlineLoading, InlineNotification, Stack, TextInput } from '@carbon/react';
import { showSnackbar, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import styles from './add-claim-line.workspace.scss';
import { type AddClaimLineDto, type PatientFacilityBillDetails } from '../../../types';
import { addClaimItem } from '../../../../../billing-claims.resource';
import { ensureInterventionOnVisit } from '../../../../../../claims/interventions.resource';
import { extractPreauthStatus, getPreauthPreview } from '../../../../../../claims/claims.resource';
import { asBool, getStoredPreauthCode, needsNormalPreauth } from '../../../preauth/preauth.resource';

interface AddClaimLineWorkspaceProps extends DefaultWorkspaceProps {
  billItem: PatientFacilityBillDetails;
  locationUuid: string;
  /** Visit claim token — bill lines often have consent_token null */
  consentToken?: string;
  onSuccess?: () => void;
}

function errorMessage(error: unknown): string {
  if (error == null) {
    return 'An error occurred while adding the claim line. Kindly retry or contact support.';
  }
  if (typeof error === 'string') {
    return error;
  }
  const e = error as { message?: unknown; responseBody?: { message?: unknown } };
  const fromBody = e.responseBody?.message;
  if (Array.isArray(fromBody)) {
    return fromBody.join(', ');
  }
  if (typeof fromBody === 'string' && fromBody.trim()) {
    return fromBody;
  }
  if (typeof e.message === 'string' && e.message.trim()) {
    return e.message;
  }
  return 'An error occurred while adding the claim line. Kindly retry or contact support.';
}

const AddClaimLineWorkspace: React.FC<AddClaimLineWorkspaceProps> = ({
  billItem,
  locationUuid,
  consentToken: consentTokenProp,
  onSuccess,
  closeWorkspace,
}) => {
  const [loading, setLoading] = useState(false);
  const [checkingPreauth, setCheckingPreauth] = useState(false);
  const [preauthBlocked, setPreauthBlocked] = useState(false);
  const [preauthCode, setPreauthCode] = useState<string | undefined>();
  const resolvedToken = (consentTokenProp || billItem.consent_token || '').trim();

  useEffect(() => {
    if (!needsNormalPreauth(billItem) || !resolvedToken) {
      setPreauthBlocked(false);
      setPreauthCode(getStoredPreauthCode(resolvedToken, billItem.intervention_code));
      return;
    }

    let cancelled = false;
    const run = async () => {
      setCheckingPreauth(true);
      try {
        const stored = getStoredPreauthCode(resolvedToken, billItem.intervention_code);
        setPreauthCode(stored);
        const preview = await getPreauthPreview(resolvedToken, locationUuid);
        const status = extractPreauthStatus(preview);
        if (!cancelled) {
          const ok = status === 'FINALISED' || status === 'FINALIZED' || asBool(billItem.preauth_approved);
          setPreauthBlocked(!ok);
        }
      } catch {
        if (!cancelled) {
          setPreauthBlocked(
            !asBool(billItem.preauth_approved) &&
              !getStoredPreauthCode(resolvedToken, billItem.intervention_code),
          );
        }
      } finally {
        if (!cancelled) setCheckingPreauth(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [billItem, resolvedToken, locationUuid]);

  function getClaimLineDto(): AddClaimLineDto {
    const dto: AddClaimLineDto = {
      consentToken: resolvedToken,
      interventionCode: billItem.intervention_code,
      unitPrice: String(billItem.item_price),
      quantity: String(billItem.item_quantity),
      locationUuid: locationUuid,
    };
    const code = preauthCode || getStoredPreauthCode(resolvedToken, billItem.intervention_code);
    if (code) {
      dto.preauthCode = code;
    }
    return dto;
  }

  async function handleAddClaimLineItem(event: React.FormEvent) {
    event.preventDefault();
    if (!resolvedToken) {
      showSnackbar({
        kind: 'error',
        title: 'No claim token',
        subtitle: 'Start a claim visit for this patient before adding a claim line.',
      });
      return;
    }
    if (!billItem.intervention_code) {
      showSnackbar({
        kind: 'error',
        title: 'Missing intervention',
        subtitle: 'This bill line has no intervention code.',
      });
      return;
    }
    if (preauthBlocked) {
      showSnackbar({
        kind: 'error',
        title: 'Preauth required',
        subtitle: 'Wait until preauth is FINALISED before adding a claim line for this intervention.',
      });
      return;
    }

    setLoading(true);
    try {
      await ensureInterventionOnVisit(resolvedToken, billItem.intervention_code, locationUuid);

      const resp = await addClaimItem(getClaimLineDto());
      if (resp && resp['error']) {
        const detail = Array.isArray(resp['message'])
          ? resp['message'].join(', ')
          : (resp['message'] as string) || errorMessage(resp);
        showSnackbar({
          title: (resp['error'] as string) ?? 'Error Adding Claim Line',
          kind: 'error',
          subtitle: detail,
        });
      } else {
        showSnackbar({
          title: 'Success Adding Claim Line',
          kind: 'success',
          subtitle: 'Claim item added successfully',
        });
        onSuccess?.();
        closeWorkspace();
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error Adding Claim Line',
        subtitle: errorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form className={styles.form} onSubmit={handleAddClaimLineItem}>
      <div className={styles.formContent}>
        <Stack gap={5}>
          {preauthBlocked ? (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Preauth not finalised"
              subtitle="Raise and finalise preauth for this intervention before adding a claim line."
            />
          ) : null}
          {preauthCode ? (
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              title="Preauth code"
              subtitle={preauthCode}
            />
          ) : null}
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
        <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()} disabled={loading}>
          Cancel
        </Button>
        <Button
          className={styles.button}
          kind="primary"
          type="submit"
          disabled={loading || checkingPreauth || preauthBlocked || !resolvedToken}
        >
          {loading ? (
            <InlineLoading description="Adding..." />
          ) : checkingPreauth ? (
            <InlineLoading description="Checking preauth..." />
          ) : (
            'Add claim line'
          )}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default AddClaimLineWorkspace;
