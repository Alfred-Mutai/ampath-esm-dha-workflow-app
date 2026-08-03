import React from 'react';
import styles from './case-summary.scss';

const DEMO_PATIENT = {
  facility: 'Sample County Government',
  patientName: 'Jane A. Doe',
  dob: '01-01-1990',
  age: 36,
  gender: 'Female',
  patientId: 'SAMPLE-ID-0000000',
  nationalId: '00000000',
  insuranceNo: '00000000',
  printedBy: 'Demo User',
  printedAt: '2026-01-01 00:00:00',
  alert: 'No active clinical alerts on file.',
  allergies: [{ label: 'No Known Allergies (NKA)' }],
  diagnoses: [
    {
      date: '01-Jan-2026',
      code: 'A00Z',
      description: 'Sample diagnosis, unspecified',
      status: 'Active',
      primary: true,
    },
    {
      date: '01-Jan-2026',
      code: 'B00Z',
      description: 'Sample secondary condition',
      status: 'Active',
      primary: false,
    },
  ],
  vitals: {
    takenAt: '01-Jan-2026 00:00',
    tewScore: 0,
    readings: [
      { label: 'Temp', value: '36.8', unit: '°C', trend: 'flat' },
      { label: 'Pulse', value: '76', unit: 'bpm', trend: 'down' },
      { label: 'BP', value: '112/67', unit: 'mmHg', trend: 'down' },
      { label: 'RR', value: '18', unit: '/min', trend: 'up' },
      { label: 'SpO2', value: '99', unit: '%', trend: 'flat' },
      { label: 'Wt', value: '62.0', unit: 'kg', trend: 'flat' },
      { label: 'Ht', value: '—', unit: 'cm', trend: 'flat' },
      { label: 'BMI', value: '—', unit: '', trend: 'flat' },
    ],
  },
  medications: [
    {
      date: '05-Jan-2026',
      drug: 'SAMPLE DRUG 500 MG',
      tag: 'Discharge',
      detail: '(1) SAMPLE DRUG 500 MG BID for 5 Day Oral',
      dose: '1',
      route: 'Oral',
      frequency: 'BID',
      duration: '5 Day',
    },
    {
      date: '03-Jan-2026',
      drug: 'SAMPLE IV MEDICATION 1000 MG',
      tag: null,
      detail: '(1) SAMPLE IV MEDICATION 1000 MG BID for 3 Day IV',
      dose: '1',
      route: 'IV',
      frequency: 'BID',
      duration: '3 Day',
    },
  ],
  labs: [],
  soap: {
    date: '01-Jan-2026',
    subjective: 'Sample presenting complaint, duration and character as documented at intake.',
    objective: 'General appearance and exam findings as documented.',
    assessment: 'Clinical impression as documented by attending clinician.',
    plan: 'Admit / treat / follow-up as documented.',
  },
  admission: {
    date: '01-Jan-2026 00:00:00',
    status: 'Admitted',
    diagnosis: 'Sample admission diagnosis',
    doctor: 'Dr. Sample Physician',
    ward: 'WARD-00 - Sample Ward',
  },
  encounters: [
    {
      date: '01-Jan-2026',
      time: '00:00',
      clinician: 'Dr. Sample Physician',
      labOrders: 'Sample Lab Panel',
      prescriptions: 'Sample Rx A; Sample Rx B',
    },
    {
      date: '30-Dec-2025',
      time: '17:02',
      clinician: 'Dr. Sample Physician B',
      labOrders: 'Sample Lab Panel B',
      prescriptions: 'Sample Rx C; Sample Rx D; Sample Rx E',
    },
  ],
};

const TREND_GLYPH = { up: '↑', down: '↓', flat: '→' };

function Field({ label, value }) {
  return (
    <div className={styles['cs-field']}>
      <div className={styles['cs-field-label']}>{label}</div>
      <div className={styles['cs-field-value']}>{value}</div>
    </div>
  );
}

function SectionBlock({ number, title, children }) {
  return (
    <section className={styles['cs-section']}>
      <h2 className={styles['cs-section-title']}>
        {number && <span className={styles['cs-section-num']}>{number}</span>} {title}
      </h2>
      <div className={styles['cs-section-body']}>{children}</div>
    </section>
  );
}

const CaseSummary = ({ patient = DEMO_PATIENT }) => {
  const p = patient;

  return (
    <div className={styles['cs-root']}>
      <div className={styles['cs-shell']}>
        <header className={styles['cs-header']}>
          <div className={styles['cs-header-bar']} />
          <div className={styles['cs-header-info']}>
            <p className={styles['cs-org']}>{p.facility}</p>
            <h1 className={styles['cs-title']}>Patient Clinical Summary</h1>
          </div>
          <div className={styles['cs-meta-right']}>
            Printed by {p.printedBy}
            <br />
            {p.printedAt}
          </div>
        </header>

        <div className={styles['cs-identity']}>
          <div className={styles['cs-field']}>
            <div className={styles['cs-field-label']}>Patient Name</div>
            <div className={styles['cs-field-value']} cs-name-value>
              {p.patientName}
            </div>
          </div>
          <Field label="DOB" value={p.dob} />
          <Field label="Age / Gender" value={`${p.age}y · ${p.gender}`} />
          <Field label="Patient ID" value={p.patientId} />
          <Field label="National ID" value={p.nationalId} />
          <Field label="Insurance No." value={p.insuranceNo} />
        </div>

        {p.alert && <div className={styles['cs-alert']}>{p.alert}</div>}

        <SectionBlock number="1" title="Allergies">
          {p.allergies.map((a, i) => (
            <div key={i} className={styles['cs-field-value']}>
              ✓ {a.label}
            </div>
          ))}
        </SectionBlock>

        <SectionBlock number="2" title="Active Diagnoses">
          <table className={styles['cs-table']}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Code</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {p.diagnoses.map((d, i) => (
                <tr key={i}>
                  <td>{d.date}</td>
                  <td>{d.code}</td>
                  <td>
                    {d.description}
                    {d.primary && <span className={styles['cs-pill']}>Primary</span>}
                  </td>
                  <td>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        <SectionBlock number="3" title="Latest Vitals">
          <div className={styles['cs-vitals-grid']}>
            {p.vitals.readings.map((v, i) => (
              <div className={styles['cs-vital']} key={i}>
                <div className={styles['cs-vital-value']}>
                  {v.value}
                  <span className={styles['cs-vital-unit']}> {v.unit}</span>
                </div>
                <div className={styles['cs-vital-label']}>
                  {v.label} <span className={styles['cs-vital-trend']}>{TREND_GLYPH[v.trend]}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={styles['cs-vitals-foot']}>
            <span>Taken: {p.vitals.takenAt}</span>
            <span>TEW Score: {p.vitals.tewScore}</span>
          </div>
        </SectionBlock>

        <SectionBlock number="4" title="Active Medications">
          <table className={styles['cs-table']}>
            <thead>
              <tr>
                <th>Drug</th>
                <th>Dose</th>
                <th>Route</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {p.medications.map((m, i) => (
                <tr key={i}>
                  <td>
                    <div className={styles['cs-drug-name']}>
                      {m.drug}
                      {m.tag && <span className={styles['cs-pill']}> {m.tag}</span>}
                    </div>
                    <div className={styles['cs-drug-detail']}>{m.detail}</div>
                  </td>
                  <td>{m.dose}</td>
                  <td>{m.route}</td>
                  <td>{m.frequency}</td>
                  <td>{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        <SectionBlock number="5" title="Latest Lab Results">
          {p.labs.length === 0 ? (
            <div className={styles['cs-empty']}>No lab results available</div>
          ) : (
            <ul>
              {p.labs.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </SectionBlock>

        <SectionBlock number="6" title={`SOAP Note — ${p.soap.date}`}>
          <dl className={styles['cs-soap']}>
            <dt>Subjective</dt>
            <dd>{p.soap.subjective}</dd>
            <dt>Objective</dt>
            <dd>{p.soap.objective}</dd>
            <dt>Assessment</dt>
            <dd>{p.soap.assessment}</dd>
            <dt>Plan</dt>
            <dd>{p.soap.plan}</dd>
          </dl>
        </SectionBlock>

        <SectionBlock number="7" title="Admission Details">
          <div className={styles['cs-field-grid']}>
            <Field label="Status" value={p.admission.status} />
            <Field label="Admission Date" value={p.admission.date} />
            <Field label="Admission Diagnosis" value={p.admission.diagnosis} />
            <Field label="Primary Doctor" value={p.admission.doctor} />
            <Field label="Ward / Bed" value={p.admission.ward} />
          </div>
        </SectionBlock>

        <SectionBlock number="8" title="Encounter Log">
          {p.encounters.map((e, i) => (
            <div className={styles['cs-encounter']} key={i}>
              <div className={styles['cs-encounter-head']}>
                {e.date} — {e.time} — {e.clinician}
              </div>
              {e.labOrders && (
                <div className={styles['cs-encounter-line']}>
                  <b>Lab Orders:</b> {e.labOrders}
                </div>
              )}
              {e.prescriptions && (
                <div className={styles['cs-encounter-line']}>
                  <b>Prescriptions:</b> {e.prescriptions}
                </div>
              )}
            </div>
          ))}
        </SectionBlock>

        <div className={styles['cs-footer']}>Confidential — For authorized clinical use only</div>
      </div>
    </div>
  );
};

export default CaseSummary;
