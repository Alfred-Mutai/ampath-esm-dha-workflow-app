import React from 'react';
import styles from './general-discharge-summary.scss';

const DEMO_SUMMARY = {
  facility: 'Sample Sub County Hospital',
  patient: {
    name: 'John A. Sample',
    patientId: 'SAMPLE-ID-0000000',
    dob: '01-01-1990',
    gender: 'Male',
    nationalId: '00000000',
    hospitalNo: 'SAMPLE-ID-0000000',
    insuranceNo: '00000000',
    mobile: '+254700000000',
  },
  admission: {
    admissionDate: '01-01-2026 00:00:00',
    dischargeDate: '03-01-2026',
    status: 'Discharged',
    primaryDoctor: 'Dr. Sample Physician',
    ward: 'WARD-00 - Sample Ward',
    admissionDiagnosis: 'Sample admission diagnosis, unspecified',
    inpatientRecord: 'SAMPLE-INP-000000-000000-0000-0000',
  },
  clinical: {
    dischargeDiagnosis: 'Sample discharge diagnosis, unspecified',
    otherConditions: 'None',
    findings: 'Sample clinical findings as documented.',
    treatment: 'Sample treatment summary.',
    operations: 'None',
    labFindings: 'Sample lab panel',
    imagingFindings: 'None',
    referrals: 'None',
  },
  outcome: {
    condition: 'stable condition',
    attendingDoctor: 'Dr. Sample Physician',
  },
  medications: [
    {
      drug: 'SAMPLE DRUG 500 MG',
      dose: '1',
      period: '5 Day',
      notes: '(1) SAMPLE DRUG 500 MG BID for 5 Day Oral',
    },
    {
      drug: 'SAMPLE IV MEDICATION 1000 MG',
      dose: '1',
      period: '3 Day',
      notes: '(1) SAMPLE IV MEDICATION 1000 MG BID for 3 Day IV',
    },
  ],
  printedBy: 'Demo User',
  printedAt: '2026-01-03 00:00:00',
};

function Field({ label, value }) {
  return (
    <div className={styles['ds-field']}>
      <div className={styles['ds-field-label']}>{label}</div>
      <div className={styles['ds-field-value']}>{value}</div>
    </div>
  );
}

function SectionBlock({ number, title, children }) {
  return (
    <section className={styles['ds-section']}>
      <h2 className={styles['ds-section-title']}>
        {number && <span className={styles['ds-section-num']}>{number}</span>} {title}
      </h2>
      <div className={styles['ds-section-body']}>{children}</div>
    </section>
  );
}

const GeneralDischargeSummary = ({ summary = DEMO_SUMMARY }) => {
  const s = summary;

  return (
    <div className={styles['ds-root']}>
      <div className={styles['ds-shell']}>
        <header className={styles['ds-header']}>
          <div className={styles['ds-header-bar']} />
          <div className={styles['ds-header-info']}>
            <p className={styles['ds-org']}>{s.facility}</p>
            <h1 className={styles['ds-title']}>Discharge Summary</h1>
          </div>
          <div className={styles['ds-meta-right']}>
            Printed by {s.printedBy}
            <br />
            {s.printedAt}
          </div>
        </header>

        <SectionBlock number="1" title="Patient Information">
          <div className={styles['ds-field-grid']}>
            <Field label="Patient Name" value={s.patient.name} />
            <Field label="Patient ID" value={s.patient.patientId} />
            <Field label="Date of Birth" value={s.patient.dob} />
            <Field label="Gender" value={s.patient.gender} />
            <Field label="National ID" value={s.patient.nationalId} />
            <Field label="Hospital No" value={s.patient.hospitalNo} />
            <Field label="Insurance No" value={s.patient.insuranceNo} />
            <Field label="Mobile" value={s.patient.mobile} />
          </div>
        </SectionBlock>

        <SectionBlock number="2" title="Admission Details">
          <div className={styles['ds-field-grid']}>
            <Field label="Admission Date" value={s.admission.admissionDate} />
            <Field label="Discharge Date" value={s.admission.dischargeDate} />
            <Field label="Status" value={s.admission.status} />
            <Field label="Primary Doctor" value={s.admission.primaryDoctor} />
            <Field label="Ward / Bed" value={s.admission.ward} />
            <Field label="Admission Diagnosis" value={s.admission.admissionDiagnosis} />
            <Field label="Inpatient Record" value={s.admission.inpatientRecord} />
          </div>
        </SectionBlock>

        <SectionBlock number="3" title="Medical Data">
          <div className={styles['ds-field-grid']}>
            <Field label="Discharge Diagnosis" value={s.clinical.dischargeDiagnosis} />
            <Field label="Other Conditions" value={s.clinical.otherConditions} />
            <Field label="Clinical Findings" value={s.clinical.findings} />
            <Field label="Treatment" value={s.clinical.treatment} />
            <Field label="Operations / Procedures" value={s.clinical.operations} />
            <Field label="Laboratory Findings" value={s.clinical.labFindings} />
            <Field label="Imaging Findings" value={s.clinical.imagingFindings} />
            <Field label="Referrals / Other Instructions" value={s.clinical.referrals} />
          </div>
        </SectionBlock>

        <SectionBlock number="4" title="Medications Prescribed During Admission">
          <table className={styles['ds-table']}>
            <thead>
              <tr>
                <th>Drug</th>
                <th>Dose</th>
                <th>Period</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {s.medications.map((m, i) => (
                <tr key={i}>
                  <td className={styles['ds-drug-name']}>{m.drug}</td>
                  <td>{m.dose}</td>
                  <td>{m.period}</td>
                  <td className={styles['ds-drug-notes']}>{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        <SectionBlock number="5" title="Post-Discharge Instructions">
          <div className={styles['ds-outcome']}>
            Patient discharged in <strong>{s.outcome.condition}</strong>.
          </div>
          <Field label="Attending Doctor" value={s.outcome.attendingDoctor} />
        </SectionBlock>

        <div className={styles['ds-footer']}>Confidential — For authorized clinical use only</div>
      </div>
    </div>
  );
};

export default GeneralDischargeSummary;
