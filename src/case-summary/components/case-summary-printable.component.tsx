import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, Tile } from '@carbon/react';
import { Chat, ListChecked, Report, Stethoscope, type CarbonIconType } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import { type CaseSummaryResponse, type CaseSummarySoapNote, type CaseSummaryVitals } from '../types/case-summary.types';
import { EMPTY_VALUE, formatDateSafe, interpretationLabel, interpretationTagType, splitSoapSentences } from './case-summary-printable.utils';
import styles from './case-summary-printable.component.scss';

interface CaseSummaryPrintableProps {
  summary: CaseSummaryResponse;
}

/** Display labels live here, not on the server — `vitals` is a keyed object addressed by field name. */
const VITAL_ROWS: Array<[keyof CaseSummaryVitals, string]> = [
  ['temperature', 'Temperature'],
  ['bloodPressure', 'Blood Pressure'],
  ['pulse', 'Pulse'],
  ['respiratoryRate', 'Respiratory Rate'],
  ['spo2', 'SpO₂'],
  ['height', 'Height'],
  ['weight', 'Weight'],
  ['bmi', 'BMI'],
  ['tewScore', 'TEW Score'],
];

const SOAP_SECTIONS: Array<{
  key: keyof CaseSummarySoapNote;
  letter: string;
  title: string;
  Icon: CarbonIconType;
}> = [
  { key: 'subjective', letter: 'S', title: 'Subjective', Icon: Chat },
  { key: 'objective', letter: 'O', title: 'Objective', Icon: Stethoscope },
  { key: 'assessment', letter: 'A', title: 'Assessment', Icon: Report },
  { key: 'plan', letter: 'P', title: 'Plan', Icon: ListChecked },
];

const CaseSummaryPrintable = React.forwardRef<HTMLDivElement, CaseSummaryPrintableProps>(({ summary }, ref) => {
  const session = useSession();
  const { demographics, allergies, inpatientDetails, visit, visitUuids, vitals, conditions, medications, labOrders, labResultsUnavailable, soapNote } =
    summary;

  const soapSections = SOAP_SECTIONS.map((section) => ({ ...section, sentences: splitSoapSentences(soapNote[section.key]) }));
  const hasSoapNote = soapSections.some((section) => section.sentences.length > 0);

  return (
    <div className={styles.document} ref={ref}>
      <header className={styles.header}>
        <div className={styles.facility}>{session?.sessionLocation?.display ?? EMPTY_VALUE}</div>
        <h3 className={styles.title}>Patient Clinical Summary</h3>
        <div className={styles.visitMeta}>
          {visit.display ?? visit.visitType ?? 'Visit'} · {formatDateSafe(visit.startDatetime)}
          {/* Say so when the day's visits were combined, so a reader isn't left
              wondering why the content spans more than the named visit. */}
          {visitUuids.length > 1 ? ` · ${visitUuids.length} visits combined` : ''}
        </div>
      </header>

      <section className={styles.section}>
        <h5 className={styles.sectionTitle}>Demographics</h5>
        <div className={styles.keyValueGrid}>
          <KeyValue label="Name" value={demographics.name || EMPTY_VALUE} />
          <KeyValue label="DOB" value={formatDateSafe(demographics.birthDate)} />
          <KeyValue label="Gender" value={demographics.gender ?? EMPTY_VALUE} />
          <KeyValue label="National ID" value={demographics.nationalId ?? EMPTY_VALUE} />
          <KeyValue label="CR Number" value={demographics.crNumber ?? EMPTY_VALUE} />
        </div>
      </section>

      <section className={styles.section}>
        <h5 className={styles.sectionTitle}>Allergies</h5>
        {allergies.length ? (
          <Table size="sm" aria-label="allergies" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Substance</TableHeader>
                <TableHeader>Criticality</TableHeader>
                <TableHeader>Reaction</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {allergies.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.substance}</TableCell>
                  <TableCell>{row.criticality ?? EMPTY_VALUE}</TableCell>
                  <TableCell>{row.reaction ?? EMPTY_VALUE}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className={styles.empty}>No known allergies recorded.</p>
        )}
      </section>

      <section className={styles.section}>
        <h5 className={styles.sectionTitle}>Active Diagnoses</h5>
        {conditions.length ? (
          <Table size="sm" aria-label="active diagnoses" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>ICD-11</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Certainty</TableHeader>
                <TableHeader>Primary</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {conditions.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className={styles.mono}>{row.code ?? EMPTY_VALUE}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>{row.certainty ?? EMPTY_VALUE}</TableCell>
                  <TableCell>{row.primary ? 'Yes' : EMPTY_VALUE}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className={styles.empty}>No active diagnoses recorded.</p>
        )}
      </section>

      <section className={styles.section}>
        <h5 className={styles.sectionTitle}>Latest Vitals</h5>
        <div className={styles.keyValueGrid}>
          {VITAL_ROWS.map(([key, label]) => (
            <KeyValue key={key} label={label} value={vitals[key] ?? EMPTY_VALUE} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h5 className={styles.sectionTitle}>Active Medications</h5>
        {medications.length ? (
          <Table size="sm" aria-label="active medications" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Date</TableHeader>
                <TableHeader>Drug Name</TableHeader>
                <TableHeader>Dose</TableHeader>
                <TableHeader>Route</TableHeader>
                <TableHeader>Frequency</TableHeader>
                <TableHeader>Duration</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {medications.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDateSafe(row.date)}</TableCell>
                  <TableCell>{row.drug}</TableCell>
                  <TableCell>{row.dose ?? EMPTY_VALUE}</TableCell>
                  <TableCell>{row.route ?? EMPTY_VALUE}</TableCell>
                  <TableCell>{row.frequency ?? EMPTY_VALUE}</TableCell>
                  <TableCell>{row.duration ?? EMPTY_VALUE}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className={styles.empty}>No active medications recorded.</p>
        )}
      </section>

      <section className={styles.section}>
        <h5 className={styles.sectionTitle}>Test Results</h5>
        {/* Three distinct states, which is the point of this section: nothing ordered,
            ordered but not yet resulted, and ordered but the lookup failed. A failed
            lookup is reported *alongside* the orders, never instead of them — which
            tests were requested is useful even when their values can't be shown. */}
        {!labOrders.length ? (
          <p className={styles.empty}>No tests were ordered during this visit.</p>
        ) : (
          <div className={styles.testOrders}>
            {labResultsUnavailable ? (
              <p className={styles.empty}>Results could not be retrieved — the tests ordered are listed below.</p>
            ) : null}
            {labOrders.map((order) => (
              <div key={order.uuid} className={styles.testOrder}>
                <div className={styles.testOrderHead}>
                  <span className={styles.testOrderName}>{order.test || EMPTY_VALUE}</span>
                  <span className={styles.testOrderMeta}>Ordered {formatDateSafe(order.orderedDate)}</span>
                  {order.pending ? (
                    <Tag size="sm" type="gray">
                      Pending
                    </Tag>
                  ) : null}
                </div>
                {order.results.length ? (
                  <Table size="sm" aria-label={`results for ${order.test}`} useZebraStyles>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Test</TableHeader>
                        <TableHeader>Result</TableHeader>
                        <TableHeader>Units</TableHeader>
                        <TableHeader>Reference</TableHeader>
                        <TableHeader>Date</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {order.results.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.panel && row.panel !== row.test ? `${row.panel} · ${row.test}` : row.test}</TableCell>
                          <TableCell>
                            <span className={row.interpretation ? styles.abnormalValue : undefined}>{row.value}</span>
                            {row.interpretation ? (
                              <Tag size="sm" type={interpretationTagType(row.interpretation)}>
                                {interpretationLabel(row.interpretation)}
                              </Tag>
                            ) : null}
                          </TableCell>
                          <TableCell>{row.units ?? EMPTY_VALUE}</TableCell>
                          <TableCell>{row.range ?? EMPTY_VALUE}</TableCell>
                          <TableCell>{formatDateSafe(row.datetime)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className={styles.empty}>Awaiting results.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Replaces the old Clinical Notes section (raw per-encounter obs dump) — the
          SOAP note below is server-generated from the same underlying data, already
          organised into the categories a reader actually wants: what the patient said,
          what was observed, what was concluded, what happens next. */}
      <section className={styles.section}>
        <h5 className={styles.sectionTitle}>Clinical SOAP Note</h5>
        {hasSoapNote ? (
          <div className={styles.soapGrid}>
            {soapSections.map(({ key, letter, title, Icon, sentences }) =>
              sentences.length ? (
                <Tile key={key} className={styles.soapCard}>
                  <div className={styles.soapCardHeader}>
                    <Icon size={16} />
                    <span className={styles.soapCardTitle}>{title}</span>
                    <Tag size="sm" type="gray">
                      {letter}
                    </Tag>
                  </div>
                  <ul className={styles.soapList}>
                    {sentences.map((sentence, i) => (
                      <li key={i}>{sentence}</li>
                    ))}
                  </ul>
                </Tile>
              ) : null,
            )}
          </div>
        ) : (
          <p className={styles.empty}>No SOAP note could be generated for this visit.</p>
        )}
      </section>

      {/* Omitted entirely for an outpatient visit — a heading over "not applicable" is
          just noise on a printed page. `inpatientDetails` is only set when the visit
          carries an ADT encounter. */}
      {inpatientDetails ? (
        <section className={styles.section}>
          <h5 className={styles.sectionTitle}>Inpatient Details</h5>
          <div className={styles.keyValueGrid}>
            <KeyValue label="Admission Date" value={formatDateSafe(inpatientDetails.admissionDate)} />
            <KeyValue label="Status" value={inpatientDetails.status ?? EMPTY_VALUE} />
            <KeyValue label="Ward" value={inpatientDetails.ward ?? EMPTY_VALUE} />
            <KeyValue label="Doctor" value={inpatientDetails.doctor ?? EMPTY_VALUE} />
            <KeyValue label="Discharge Date" value={formatDateSafe(inpatientDetails.dischargeDate)} />
          </div>
        </section>
      ) : null}
    </div>
  );
});

CaseSummaryPrintable.displayName = 'CaseSummaryPrintable';

const KeyValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={styles.keyValueItem}>
    <span className={styles.keyValueLabel}>{label}</span>
    <span className={styles.keyValueValue}>{value}</span>
  </div>
);

export default CaseSummaryPrintable;
