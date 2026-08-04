import React, { useRef } from 'react';
import { Button } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { usePatient, useSession } from '@openmrs/esm-framework';
import { useReactToPrint } from 'react-to-print';
import CaseSummaryPrintable from './components/case-summary-printable.component';
import { useVisitCaseSummary } from './case-summary.resource';
import styles from './case-summary.extension.scss';

interface CaseSummaryExtensionProps {}

const CaseSummaryExtension: React.FC<CaseSummaryExtensionProps> = () => {
  const { isLoading: isLoadingPatient, error: patientError, patient } = usePatient();
  const session = useSession();
  const { summary, isLoading, error } = useVisitCaseSummary(patient?.id, session?.sessionLocation?.uuid);
  const printRef = useRef<HTMLDivElement>(null);
  const printCaseSummary = useReactToPrint({
    contentRef: printRef,
    documentTitle: `CaseSummary-${summary?.demographics.name || patient?.id || 'patient'}`,
    pageStyle: '@page { size: A4; margin: 16mm; }',
  });

  if (isLoadingPatient || isLoading) return <div>Loading…</div>;
  if (patientError) return <div>Error loading patient</div>;
  if (error) return <div>{error.message}</div>;
  if (!summary) return <div>No case summary available.</div>;

  return (
    <div className={styles.caseSummary}>
      <div className={styles.toolbar}>
        <Button kind="tertiary" size="sm" renderIcon={Printer} onClick={() => printCaseSummary()}>
          Print
        </Button>
      </div>
      <CaseSummaryPrintable ref={printRef} summary={summary} />
    </div>
  );
};

export default CaseSummaryExtension;
