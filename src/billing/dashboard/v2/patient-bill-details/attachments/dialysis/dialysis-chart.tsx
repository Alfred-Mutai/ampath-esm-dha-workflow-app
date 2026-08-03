import React from 'react';
import styles from './dialysis-chart.scss';

const DEMO_SESSION = {
  facility: {
    name: 'Sample Renal Unit',
    hospital: 'Sample District Hospital',
    address: 'Sample Town, P.O. Box 000-00000, Sample Town',
    phone: '0700000000',
    email: 'info@samplehospital.example',
  },
  patient: {
    name: 'John A. Sample',
    opNo: '000000',
    insuranceNo: 'CR0000000000000-0',
    date: '01-Jan-2026',
    age: '60 years 0 months 0 weeks',
    sex: 'Male',
    contact: '0700000000',
    clinic: 'Renal Unit',
    diagnosis: 'Sample diagnosis code — Chronic kidney disease, stage 5',
    address: 'Sample Ward',
  },
  preAssessment: {
    weightBefore: '0.00 kg',
    temperature: '36.5 °C',
    pulse: '0.00 bpm',
    bp: '0/0 mmHg',
    respRate: '0.00',
    oxygenSat: '0.00 %',
    bloodSugar: '0.0',
    accessType: 'Catheter',
    accessSite: 'cvc',
    doctor: 'Dr. Sample Nephrologist',
  },
  prescription: {
    dialyzerType: 'synthetic',
    bfr: '-',
    dfr: '0.00 ml/min',
    duration: '-',
    ufGoal: '0.00 L',
    heparinDose: '-',
    dialysateComposition: 'sodium bicarbonate',
  },
  monitoring: [
    { time: '0 min', bp: '0/0', pulse: '0', temp: '36.5', ufRemoved: '0', heparin: '0', remarks: 'pt is stable' },
    { time: '60 min', bp: '0/0', pulse: '0', temp: '36.5', ufRemoved: '0mls', heparin: '0iu', remarks: 'pt is stable' },
    {
      time: '120 min',
      bp: '0/0',
      pulse: '0',
      temp: '36.5',
      ufRemoved: '0mls',
      heparin: '0iu',
      remarks: 'pt is stable',
    },
    {
      time: '180 min',
      bp: '0/0',
      pulse: '0',
      temp: '36.5',
      ufRemoved: '0mls',
      heparin: '0iu',
      remarks: 'pt is stable',
    },
    {
      time: '240 min',
      bp: '0/0',
      pulse: '0',
      temp: '36.5',
      ufRemoved: '0mls',
      heparin: '0iu',
      remarks: 'pt is stable',
    },
  ],
  postAssessment: {
    weightAfter: '0.00 kg',
    totalUfAchieved: '-',
    bp: '0/0',
    pulse: '0.00 bpm',
    temperature: '36.5 °C',
    accessSite: 'Cleaned and dressed',
    condition: 'Stable',
    complications: 'None',
  },
  summary: {
    prescribedDuration: '-',
    actualDuration: '-',
    adequacyAchieved: 'Yes',
    toleratedProcedure: 'Yes',
    comments: 'Sample discharge comment.',
    nextSessionDate: '-',
    additionalRemarks: '',
  },
  signoff: {
    nurse: { name: 'Sample Nurse', regNo: '000000', date: '01-Jan-2026' },
    doctor: { name: 'Dr. Sample Nephrologist', regNo: 'A0000', date: '01-Jan-2026' },
  },
};

function Field({ label, value }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  );
}

function SectionBlock({ number, title, children }) {
  return (
    <section className={styles['dc-section']}>
      <h2 className={styles['dc-section-title']}>
        <span className={styles['dc-section-num']}>{number}</span> {title}
      </h2>
      <div className={styles['dc-section-body']}>{children}</div>
    </section>
  );
}

const DialysisChart: React.FC<{ session?: typeof DEMO_SESSION }> = ({ session = DEMO_SESSION }) => {
  const s = session;

  return (
    <div className={styles['dc-root']}>
      <div className={styles['dc-shell']}>
        <header className={styles['dc-header']}>
          <div className={styles['dc-header-bar']} />
          <div className={styles['dc-header-info']}>
            <h1 className={styles['dc-title']}>Renal Unit Haemodialysis Notes</h1>
            <p className={styles['dc-hospital']}>{s.facility.hospital}</p>
            <p className={styles['dc-hospital-meta']}>
              {s.facility.address} · Tel: {s.facility.phone} · {s.facility.email}
            </p>
          </div>
        </header>

        <div className={styles['dc-identity']}>
          <Field label="Patient Name" value={s.patient.name} />
          <Field label="OP No" value={s.patient.opNo} />
          <Field label="Insurance No" value={s.patient.insuranceNo} />
          <Field label="Date" value={s.patient.date} />
          <Field label="Age" value={s.patient.age} />
          <Field label="Sex" value={s.patient.sex} />
          <Field label="Contact" value={s.patient.contact} />
          <Field label="Clinic" value={s.patient.clinic} />
          <Field label="Diagnosis" value={s.patient.diagnosis} />
          <Field label="Address" value={s.patient.address} />
        </div>

        <SectionBlock number="1" title="Pre-Dialysis Assessment">
          <div className={styles['dc-field-grid']}>
            <Field label="Weight Before" value={s.preAssessment.weightBefore} />
            <Field label="Temperature" value={s.preAssessment.temperature} />
            <Field label="Pulse" value={s.preAssessment.pulse} />
            <Field label="BP" value={s.preAssessment.bp} />
            <Field label="Resp. Rate" value={s.preAssessment.respRate} />
            <Field label="Oxygen Sat." value={s.preAssessment.oxygenSat} />
            <Field label="Blood Sugar" value={s.preAssessment.bloodSugar} />
            <Field label="Access Type" value={s.preAssessment.accessType} />
            <Field label="Access Site" value={s.preAssessment.accessSite} />
            <Field label="Doctor/Nephrologist" value={s.preAssessment.doctor} />
          </div>
        </SectionBlock>

        <SectionBlock number="2" title="Physician Prescription">
          <div className={styles['dc-field-grid']}>
            <Field label="Dialyzer Type" value={s.prescription.dialyzerType} />
            <Field label="BFR" value={s.prescription.bfr} />
            <Field label="DFR" value={s.prescription.dfr} />
            <Field label="Duration" value={s.prescription.duration} />
            <Field label="UF Goal" value={s.prescription.ufGoal} />
            <Field label="Heparin Dose" value={s.prescription.heparinDose} />
            <Field label="Dialysate Composition" value={s.prescription.dialysateComposition} />
          </div>
        </SectionBlock>

        <SectionBlock number="3" title="Intra-Dialytic Monitoring — Record Observations Every 60 Minutes">
          <table className={styles['dc-table']}>
            <thead>
              <tr>
                <th>Time</th>
                <th>BP</th>
                <th>Pulse</th>
                <th>Temp</th>
                <th>UF Removed</th>
                <th>Heparin</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {s.monitoring.map((row, i) => (
                <tr key={i}>
                  <td>{row.time}</td>
                  <td>{row.bp}</td>
                  <td>{row.pulse}</td>
                  <td>{row.temp}</td>
                  <td>{row.ufRemoved}</td>
                  <td>{row.heparin}</td>
                  <td>{row.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        <SectionBlock number="4" title="Post-Dialysis Assessment">
          <div className={styles['dc-field-grid']}>
            <Field label="Weight After" value={s.postAssessment.weightAfter} />
            <Field label="Total UF Achieved" value={s.postAssessment.totalUfAchieved} />
            <Field label="BP" value={s.postAssessment.bp} />
            <Field label="Pulse" value={s.postAssessment.pulse} />
            <Field label="Temperature" value={s.postAssessment.temperature} />
            <Field label="Access Site" value={s.postAssessment.accessSite} />
            <Field label="Condition" value={s.postAssessment.condition} />
            <Field label="Complications" value={s.postAssessment.complications} />
          </div>
        </SectionBlock>

        <SectionBlock number="5" title="Dialysis Summary">
          <div className={styles['dc-field-grid']}>
            <Field label="Prescribed Duration" value={s.summary.prescribedDuration} />
            <Field label="Actual Duration" value={s.summary.actualDuration} />
            <Field label="Adequacy Achieved" value={s.summary.adequacyAchieved} />
            <Field label="Tolerated Procedure" value={s.summary.toleratedProcedure} />
          </div>
          <div className={styles['dc-notes']}>
            <div className={styles['dc-field-label']}>Comments</div>
            <p className={styles['dc-note-text']}>{s.summary.comments}</p>
            <p className={styles['dc-note-text']}>Next dialysis date: {s.summary.nextSessionDate}</p>
          </div>
          <div className={styles['dc-notes']}>
            <div className={styles['dc-field-label']}>Additional Remarks / Emergency Instructions</div>
            <p className={styles['dc-note-text']}>
              {s.summary.additionalRemarks || <span className={styles['dc-empty']}>None recorded</span>}
            </p>
          </div>
        </SectionBlock>

        <section className={styles['dc-signoff']}>
          <div className={styles['dc-signoff-block']}>
            <div className={styles['dc-signoff-title']}>Dialysis Nurse</div>
            <Field label="Name" value={s.signoff.nurse.name} />
            <Field label="Reg. No" value={s.signoff.nurse.regNo} />
            <Field label="Date" value={s.signoff.nurse.date} />
            <div className={styles['dc-signature-line']} />
          </div>
          <div className={styles['dc-signoff-block']}>
            <div className={styles['dc-signoff-title']}>Doctor / Nephrologist</div>
            <Field label="Name" value={s.signoff.doctor.name} />
            <Field label="Reg. No" value={s.signoff.doctor.regNo} />
            <Field label="Date" value={s.signoff.doctor.date} />
            <div className={styles['dc-signature-line']} />
          </div>
          <div className={`${styles['dc-signoff-block']} ${styles['dc-signoff-stamp']}`}>
            <div className={styles['dc-signoff-title']}>Hospital Stamp</div>
            <div className={styles['dc-stamp-placeholder']}>stamp area</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DialysisChart;
