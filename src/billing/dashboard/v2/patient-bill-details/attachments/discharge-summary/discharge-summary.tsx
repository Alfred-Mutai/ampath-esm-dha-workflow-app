import React, { forwardRef, useEffect, useState } from 'react';
import { type VisitIntervention } from '../../../types';
import { type DischargeSummary } from '../type';
import { getDischargeSummary } from '../../../../../maternity-discharge.resource';

import styles from './discharge-summary.scss';

interface DischargeSummaryComponentProps {
  bill: any;
  claimIntervention: VisitIntervention;
}

const DischargeSummaryComponent = forwardRef<HTMLDivElement, DischargeSummaryComponentProps>(
  ({ bill, claimIntervention }, ref) => {
    const [summary, setSummary] = useState<DischargeSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const loadSummary = async () => {
        try {
          const response = await getDischargeSummary(bill.cr_no, bill.amrs_universal_id);

          setSummary(response);
        } finally {
          setLoading(false);
        }
      };

      loadSummary();
    }, [bill.amrs_universal_id, bill.cr_no, claimIntervention]);

    if (loading) {
      return <div ref={ref}>Loading...</div>;
    }

    if (!summary) {
      return <div ref={ref}>Unable to load discharge summary.</div>;
    }

    return (
      <>
        <div ref={ref} className={styles.container}>
          <div className={styles.headerContainer}>
            <div className={styles.county}>County Government of Uasin Gishu</div>

            <div className={styles.department}>Department of Health Services</div>

            <div className={styles.hospitalName}>Kesses Sub-County Hospital</div>

            <div className={styles.encounterType}>POST NATAL DISCHARGE SUMMARY</div>
          </div>
          <Field label="NAME" value={summary.patientName} />
          <Field label="AGE" value={summary.age} />
          <Field label="IP NO" value={summary.ipNumber} />
          <Field label="PARITY" value={summary.parity} />
          <Field
            label="DATE OF ADMISSION"
            value={summary.admissionDate ? new Date(summary.admissionDate).toLocaleDateString() : ''}
          />
          <Field
            label="DATE OF DELIVERY"
            value={summary.deliveryDate ? new Date(summary.deliveryDate).toLocaleDateString() : ''}
          />
          <Field label="MODE OF DELIVERY" value={summary.modeOfDelivery} />
          <Field label="SEX OF BABY" value={summary.babySex} />
          <Field label="BIRTH WEIGHT" value={summary.birthWeight} />
          <Field label="FATE" value={summary.fate} />
          <Field label="ADVICE ON PERSONAL HYGIENE" value={summary.hygieneAdvice} />
          <Field label="NUTRITION" value={summary.nutrition} />
          <Field label="BREAST FEEDING" value={summary.breastFeeding} />
          <Field label="IMMUNIZATION" value={summary.immunization} />
          <Field label="FAMILY PLANNING" value={summary.familyPlanning} />

          <div
            style={{
              marginTop: '20px',
            }}
          >
            <div
              style={{
                marginTop: '25px',
              }}
            >
              <div className={styles.remarksLabel}>REMARKS</div>

              <div className={styles.remarksValue}>{summary.remarks || '-'}</div>
            </div>
          </div>

          <div className={styles.footer}>
            <div>
              <div style={{ fontWeight: 600 }}>Discharge Date</div>
              <div>{summary.dischargeDate ? new Date(summary.dischargeDate).toLocaleDateString() : '-'}</div>
            </div>

            <div className={styles.clinicianContainer}>
              <div className={styles.clinicianLabel}>Nurse / Clinician</div>

              <div>{summary.clinician || '-'}</div>
            </div>
          </div>
        </div>
      </>
    );
  },
);

interface FieldProps {
  label: string;
  value?: string | number;
}

const Field: React.FC<FieldProps> = ({ label, value }) => (
  <div className={styles.fieldContainer}>
    <div className={styles.fieldLabel}>{label}</div>

    <div className={styles.fieldValue}>{value || '-'}</div>
  </div>
);
DischargeSummaryComponent.displayName = 'DischargeSummaryComponent';

export default DischargeSummaryComponent;
