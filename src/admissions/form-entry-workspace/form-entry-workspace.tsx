import React, { useState, useMemo } from 'react';
import { ExtensionSlot, Workspace2, usePatient } from '@openmrs/esm-framework';
import { useSWRConfig } from 'swr';
import { invalidateVisitAndEncounterData } from '@openmrs/esm-patient-common-lib';

export interface ClinicalFormWorkspaceProps {
  workspaceTitle: string;
  formUuid: string;
  patientUuid: string;
  visitUuid?: string;
  visitTypeUuid?: string;
  encounterUuid?: string;
  handlePostResponse?: (encounter: any) => void;
}

export default function FormEntryWorkspace({
  closeWorkspace,
  workspaceProps,
}: any) {
  const { workspaceTitle, formUuid, patientUuid, visitUuid, visitTypeUuid, encounterUuid, handlePostResponse } = workspaceProps;
  const { mutate: globalMutate } = useSWRConfig();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { patient, isLoading } = usePatient(patientUuid);

  if (!formUuid || !patientUuid || !closeWorkspace) {
    return <div>Loading workspace...</div>;
  }

  if (isLoading) {
    return <div>Loading patient...</div>;
  }

  const formState = useMemo(
    () => ({
      view: 'form',
      formUuid,
      patientUuid,
      patient,
      visitUuid: visitUuid ?? '',
      visitTypeUuid: visitTypeUuid ?? '',
      encounterUuid: encounterUuid ?? '',
      visit: null,
      closeWorkspace,
      closeWorkspaceWithSavedChanges: () => {
        invalidateVisitAndEncounterData(globalMutate, patientUuid);
        return closeWorkspace({ discardUnsavedChanges: true });
      },
      handlePostResponse,
      hideControls: false,
      hidePatientBanner: false,
      setHasUnsavedChanges,
      promptBeforeClosing: (func) => setHasUnsavedChanges(func()),
    }),
    [formUuid, patientUuid, patient, visitUuid, visitTypeUuid, encounterUuid, closeWorkspace, globalMutate, handlePostResponse],
  );

  return (
    <Workspace2 title={workspaceTitle} hasUnsavedChanges={hasUnsavedChanges}>
      <ExtensionSlot name="form-widget-slot" state={formState} />
    </Workspace2>
  );
}