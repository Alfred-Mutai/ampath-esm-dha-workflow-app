import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Dropdown,
  InlineLoading,
  NumberInput,
  ProgressIndicator,
  ProgressStep,
  RadioButton,
  RadioButtonGroup,
  Tag,
  TextInput,
} from '@carbon/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckmarkFilled,
  Close,
  Document,
  FingerprintRecognition,
  Receipt,
  Renew,
  Send,
  WarningAltFilled,
} from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import styles from './claim-workspace.component.scss';
import {
  captureConsent,
  checkCompatibility,
  checkEligibility,
  COPAY_PAYERS,
  generateCopayReceipt,
  getEligibleInterventions,
  getEncounterDiagnoses,
  mechanismLabel,
  previewClaim,
  raisePreauth,
  resolveScenario,
  type ClaimPreview,
  type CopayReceipt,
  type EligibilityResult,
  type EncounterDiagnosis,
  type Intervention,
} from './claim-workspace.resource';
import { pushClaim, type ShaClaim } from '../claims-accounting/claims-accounting.resource';

const STEPS = ['Patient & eligibility', 'Interventions', 'Consent', 'Preauth', 'Billing', 'Preview & submit'];
const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

type PreauthState = 'idle' | 'pending' | 'FINALISED';
interface LineDraft {
  quantity: number; // days for per diem
  charge: number; // the hospital's unit charge (may exceed the SHA tariff)
}

const ClaimWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1 — eligibility
  const [crNumber, setCrNumber] = useState('');
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [loadingElig, setLoadingElig] = useState(false);

  // Step 2 — interventions
  const [available, setAvailable] = useState<Intervention[]>([]);
  const [selected, setSelected] = useState<Intervention[]>([]);
  const [addError, setAddError] = useState('');
  const [switchCandidate, setSwitchCandidate] = useState<Intervention | null>(null);

  // Step 3 — consent
  const [consentMethod, setConsentMethod] = useState<'biometric' | 'otp'>('biometric');
  const [consentToken, setConsentToken] = useState('');
  const [capturing, setCapturing] = useState(false);

  // Step 4 — preauth
  const [preauth, setPreauth] = useState<Record<string, PreauthState>>({});

  // Step 5 — billing + copay harmonisation + ICD-11 diagnoses (from the encounter)
  const [lines, setLines] = useState<Record<string, LineDraft>>({});
  const [copayPayer, setCopayPayer] = useState<Record<string, string>>({});
  const [encounterDx, setEncounterDx] = useState<EncounterDiagnosis[]>([]);
  const [selectedDx, setSelectedDx] = useState<string[]>([]);

  // Step 6 — preview & submit
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [receipt, setReceipt] = useState<CopayReceipt | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getEligibleInterventions().then(setAvailable);
    getEncounterDiagnoses().then(setEncounterDx);
  }, []);

  // Any billing change invalidates a prior preview + receipt (must re-preview).
  const invalidatePreview = () => {
    setPreview(null);
    setReceipt(null);
  };

  const shaActive = eligibility?.schemes.some((s) => /shif|sha/i.test(s.schemeName) && s.active) ?? false;
  const serviceType: 'INPATIENT' | 'OUTPATIENT' = selected.some((i) => i.accessPoint === 'IP') ? 'INPATIENT' : 'OUTPATIENT';
  const dispatch: 'discharge' | 'submit' = serviceType === 'INPATIENT' ? 'discharge' : 'submit';
  const preauthNeeded = selected.filter((i) => i.needsPreauth);
  const preauthSatisfied = preauthNeeded.every((i) => preauth[i.code] === 'FINALISED');

  // Fee-for-service and per-diem require attachments; capitation does not.
  const attachmentsRequired = selected.some((i) => i.paymentMechanism !== 'CAPITATION');

  const getLine = (iv: Intervention): LineDraft => lines[iv.code] ?? { quantity: 1, charge: iv.tariff };
  const isChargeEditable = (iv: Intervention) => iv.paymentMechanism === 'FEE_FOR_SERVICE';
  const unitCharge = (iv: Intervention) => (isChargeEditable(iv) ? getLine(iv).charge : iv.tariff);
  const shaUnit = (iv: Intervention) => Math.min(unitCharge(iv), iv.tariff);
  const copayUnit = (iv: Intervention) => Math.max(0, unitCharge(iv) - iv.tariff);
  const shaLine = (iv: Intervention) => getLine(iv).quantity * shaUnit(iv);
  const copayLine = (iv: Intervention) => getLine(iv).quantity * copayUnit(iv);

  const totals = useMemo(() => {
    let sha = 0;
    let copay = 0;
    for (const iv of selected) {
      sha += getLine(iv).quantity * Math.min(isChargeEditable(iv) ? getLine(iv).charge : iv.tariff, iv.tariff);
      copay += getLine(iv).quantity * Math.max(0, (isChargeEditable(iv) ? getLine(iv).charge : iv.tariff) - iv.tariff);
    }
    return { sha, copay, grand: sha + copay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, lines]);

  const lineBalanced = (iv: Intervention) => copayLine(iv) === 0 || !!copayPayer[iv.code];
  const billingValid =
    selected.every((iv) => getLine(iv).quantity > 0 && lineBalanced(iv)) && selectedDx.length > 0;

  // Total copay being collected in cash — becomes a receipt attachment.
  const cashCopayTotal = selected.reduce(
    (sum, iv) => sum + (copayPayer[iv.code] === 'Cash' ? copayLine(iv) : 0),
    0,
  );

  const toggleDx = (uuid: string, checked: boolean) => {
    setSelectedDx((prev) => (checked ? [...prev, uuid] : prev.filter((u) => u !== uuid)));
    invalidatePreview();
  };

  const canNext = (() => {
    switch (step) {
      case 0:
        return shaActive;
      case 1:
        return selected.length > 0;
      case 2:
        return !!consentToken;
      case 3:
        return preauthSatisfied;
      case 4:
        return billingValid;
      default:
        return true;
    }
  })();

  const seedFor = (iv: Intervention) => {
    setLines((prev) => ({ ...prev, [iv.code]: { quantity: 1, charge: iv.tariff } }));
    setPreauth((prev) => ({ ...prev, [iv.code]: 'idle' }));
    invalidatePreview();
  };

  const addIntervention = (iv: Intervention) => {
    const res = checkCompatibility(selected, iv);
    if (!res.ok) {
      if (res.requiresSwitch) {
        setSwitchCandidate(iv);
        setAddError('');
      } else {
        setAddError(res.reason ?? 'Cannot add this intervention.');
      }
      return;
    }
    setSelected((prev) => [...prev, iv]);
    seedFor(iv);
    setAddError('');
  };

  const removeIntervention = (code: string) => {
    setSelected((prev) => prev.filter((i) => i.code !== code));
    setLines((prev) => {
      const n = { ...prev };
      delete n[code];
      return n;
    });
    setCopayPayer((prev) => {
      const n = { ...prev };
      delete n[code];
      return n;
    });
    setPreauth((prev) => {
      const n = { ...prev };
      delete n[code];
      return n;
    });
    setAddError('');
    invalidatePreview();
  };

  const confirmSwitch = () => {
    if (!switchCandidate) {
      return;
    }
    const outgoing = selected.find((i) => i.paymentMechanism === 'PER_DIEM');
    setSelected((prev) => [...prev.filter((i) => i.paymentMechanism !== 'PER_DIEM'), switchCandidate]);
    if (outgoing) {
      removeIntervention(outgoing.code);
    }
    seedFor(switchCandidate);
    setSwitchCandidate(null);
  };

  const runEligibility = async () => {
    setLoadingElig(true);
    try {
      setEligibility(await checkEligibility(crNumber));
    } finally {
      setLoadingElig(false);
    }
  };

  const runConsent = async () => {
    setCapturing(true);
    try {
      const { consentToken: token } = await captureConsent(consentMethod);
      setConsentToken(token);
      showSnackbar({ kind: 'success', title: 'Consent captured', subtitle: 'You can proceed with the claim.' });
    } finally {
      setCapturing(false);
    }
  };

  const runPreauth = async (iv: Intervention) => {
    setPreauth((prev) => ({ ...prev, [iv.code]: 'pending' }));
    const { status } = await raisePreauth(consentToken, iv.code);
    setPreauth((prev) => ({ ...prev, [iv.code]: status }));
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const p = await previewClaim(consentToken);
      setPreview(p);
      // Attach the cash copay receipt from billing as a second attachment.
      if (cashCopayTotal > 0) {
        setReceipt(await generateCopayReceipt(cashCopayTotal));
      } else {
        setReceipt(null);
      }
      showSnackbar({
        kind: 'success',
        title: 'Preview generated',
        subtitle: attachmentsRequired ? 'Attached as the claim supporting document.' : 'Submit unlocked.',
      });
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async () => {
    if (!eligibility || selected.length === 0 || !preview) {
      return;
    }
    setSubmitting(true);
    try {
      const claimCode = `CLM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const claim: ShaClaim = {
        id: `c-${Math.floor(Math.random() * 1e6)}`,
        claimCode,
        patientName: eligibility.fullName,
        crNumber: eligibility.crNumber,
        fund: selected[0].fund,
        serviceType,
        interventions: selected.map((i) => `${i.code} · ${i.name}`),
        amount: totals.sha,
        status: 'SUBMITTED',
        updatedAt: new Date().toISOString(),
        lines: selected.map((iv) => ({
          code: iv.code,
          description: iv.name,
          quantity: getLine(iv).quantity,
          unitPrice: shaUnit(iv), // billed to SHA (tariff-capped)
          tariff: iv.tariff,
        })),
        diagnoses: encounterDx
          .filter((d) => selectedDx.includes(d.uuid))
          .map((d) => ({ icd11Code: d.icd11Code, display: d.display })),
        attachments: [
          ...(attachmentsRequired && preview ? [preview.documentName] : []),
          ...(receipt ? [receipt.documentName] : []),
        ],
        bill: {
          billNo: claimCode.replace('CLM', 'INV'),
          totalCharge: totals.grand,
          shaCovered: totals.sha,
          copay: totals.copay,
          copayPayer: totals.copay > 0 ? (cashCopayTotal > 0 ? 'Cash' : 'Other insurer') : undefined,
          document: receipt ? receipt.documentName : preview?.documentName ?? 'sha-invoice.pdf',
        },
        timeline: [
          { at: new Date().toISOString(), label: 'Claim created (workspace)', by: 'You' },
          { at: new Date().toISOString(), label: `Preview generated (${preview.previewId})`, by: 'You' },
          {
            at: new Date().toISOString(),
            label: `${dispatch === 'discharge' ? 'Discharged & submitted' : 'Submitted'} to SHA${
              totals.copay > 0 ? ` · copay ${money(totals.copay)} collected separately` : ''
            }`,
            by: 'You',
          },
        ],
      };
      pushClaim(claim);
      showSnackbar({ kind: 'success', title: 'Claim submitted', subtitle: `${claim.claimCode} sent to SHA.` });
      navigate('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.wsHeader}>
        <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={() => navigate('')}>
          Back to accounting
        </Button>
        <h4 className={styles.wsTitle}>New SHA claim</h4>
      </div>

      <div className={styles.wsBody}>
        <aside className={styles.wsRail}>
          <ProgressIndicator vertical currentIndex={step}>
            {STEPS.map((label, i) => (
              <ProgressStep key={label} label={label} complete={i < step} current={i === step} />
            ))}
          </ProgressIndicator>
        </aside>

        <div className={styles.wsContent}>
          {/* Step 1 — eligibility */}
          {step === 0 ? (
            <section className={styles.panel}>
              <h5 className={styles.panelTitle}>Confirm the patient &amp; SHA eligibility</h5>
              <div className={styles.inlineForm}>
                <TextInput
                  id="cr-number"
                  labelText="CR / SHA number"
                  placeholder="CR4098636401452-9"
                  value={crNumber}
                  onChange={(e) => setCrNumber(e.target.value)}
                />
                <Button size="md" onClick={runEligibility} disabled={loadingElig}>
                  {loadingElig ? <InlineLoading description="Checking…" /> : 'Check eligibility'}
                </Button>
              </div>
              {eligibility ? (
                <div className={styles.eligCard}>
                  <div className={styles.eligName}>{eligibility.fullName}</div>
                  <div className={styles.eligCr}>{eligibility.crNumber}</div>
                  <div className={styles.schemeRow}>
                    {eligibility.schemes.map((s) => (
                      <Tag key={s.schemeName} type={s.active ? 'green' : 'red'} size="sm">
                        {s.schemeName} · {s.active ? 'Active' : 'Inactive'}
                      </Tag>
                    ))}
                  </div>
                  {!shaActive ? <p className={styles.hintBad}>No active SHIF/SHA scheme — can't claim under SHA.</p> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Step 2 — interventions */}
          {step === 1 ? (
            <section className={styles.panel}>
              <h5 className={styles.panelTitle}>Add interventions</h5>
              <p className={styles.panelSub}>
                A claim carries one fund. Only one active per-diem is allowed — a second replaces it (a switch).
              </p>

              {selected.length > 0 ? (
                <div className={styles.selectedList}>
                  {selected.map((iv) => {
                    const sc = resolveScenario(iv);
                    return (
                      <div key={iv.code} className={styles.selectedRow}>
                        <div>
                          <span className={styles.ivCode}>{iv.code}</span>
                          <span className={styles.selName}>{iv.name}</span>
                          <div className={styles.selMeta}>
                            <Tag size="sm" type={iv.accessPoint === 'IP' ? 'purple' : 'blue'}>
                              {iv.accessPoint}
                            </Tag>
                            <span>{mechanismLabel(iv.paymentMechanism)}</span>
                            <span>·</span>
                            <span>{sc.preauth === 'none' ? 'no preauth' : `${sc.preauth} preauth`}</span>
                          </div>
                        </div>
                        <Button
                          kind="ghost"
                          size="sm"
                          hasIconOnly
                          iconDescription="Remove"
                          renderIcon={Close}
                          onClick={() => removeIntervention(iv.code)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {addError ? (
                <div className={styles.addError}>
                  <WarningAltFilled size={18} />
                  <span>{addError}</span>
                </div>
              ) : null}

              {switchCandidate ? (
                <div className={styles.switchPrompt}>
                  <Renew size={18} />
                  <div className={styles.switchBody}>
                    <p>
                      Switch the active per-diem to <strong>{switchCandidate.name}</strong>? The current per-diem will be
                      removed.
                    </p>
                    <div className={styles.switchActions}>
                      <Button kind="tertiary" size="sm" onClick={confirmSwitch}>
                        Switch
                      </Button>
                      <Button kind="ghost" size="sm" onClick={() => setSwitchCandidate(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <h6 className={styles.availLabel}>Available interventions</h6>
              <div className={styles.ivGrid}>
                {available.map((iv) => {
                  const sc = resolveScenario(iv);
                  const added = selected.some((i) => i.code === iv.code);
                  return (
                    <button
                      type="button"
                      key={iv.code}
                      className={`${styles.ivTile} ${added ? styles.ivTileAdded : ''}`}
                      onClick={() => addIntervention(iv)}
                      disabled={added}
                    >
                      <div className={styles.ivHead}>
                        <span className={styles.ivCode}>{iv.code}</span>
                        <Tag size="sm" type={iv.accessPoint === 'IP' ? 'purple' : 'blue'}>
                          {iv.accessPoint}
                        </Tag>
                      </div>
                      <div className={styles.ivName}>{iv.name}</div>
                      <div className={styles.ivFlags}>
                        <span>{iv.fund}</span>
                        <span>·</span>
                        <span>{mechanismLabel(iv.paymentMechanism)}</span>
                      </div>
                      <div className={styles.ivScenario}>{added ? 'Added' : sc.title}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Step 3 — consent */}
          {step === 2 ? (
            <section className={styles.panel}>
              <h5 className={styles.panelTitle}>Capture patient consent</h5>
              <p className={styles.panelSub}>
                Same biometric → OTP flow as registration. Produces the consent token every claim step needs.
              </p>
              <RadioButtonGroup
                legendText="Consent method"
                name="consent-method"
                valueSelected={consentMethod}
                onChange={(v) => setConsentMethod(v as 'biometric' | 'otp')}
                orientation="horizontal"
              >
                <RadioButton id="cm-bio" labelText="Biometric" value="biometric" />
                <RadioButton id="cm-otp" labelText="OTP" value="otp" />
              </RadioButtonGroup>
              {consentToken ? (
                <div className={styles.consentOk}>
                  <CheckmarkFilled size={20} />
                  <span>Consent captured via {consentMethod}. Token stored.</span>
                </div>
              ) : (
                <Button size="md" renderIcon={FingerprintRecognition} onClick={runConsent} disabled={capturing} className={styles.leftBtn}>
                  {capturing ? <InlineLoading description="Capturing…" /> : 'Capture consent'}
                </Button>
              )}
            </section>
          ) : null}

          {/* Step 4 — preauth */}
          {step === 3 ? (
            <section className={styles.panel}>
              <h5 className={styles.panelTitle}>Preauthorisation</h5>
              {preauthNeeded.length === 0 ? (
                <div className={styles.okNote}>
                  <CheckmarkFilled size={20} />
                  <span>No intervention on this claim needs preauth. Continue to billing.</span>
                </div>
              ) : (
                <div className={styles.preauthList}>
                  {preauthNeeded.map((iv) => {
                    const sc = resolveScenario(iv);
                    const st = preauth[iv.code] ?? 'idle';
                    return (
                      <div key={iv.code} className={styles.preauthRow}>
                        <div className={styles.preauthInfo}>
                          <span className={styles.ivCode}>{iv.code}</span>
                          <span className={styles.selName}>{iv.name}</span>
                          <Tag size="sm" type={sc.preauth === 'elective' ? 'magenta' : 'purple'}>
                            {sc.preauth === 'elective' ? 'Elective' : 'Normal'} preauth
                          </Tag>
                        </div>
                        {st === 'FINALISED' ? (
                          <Tag size="sm" type="green">
                            FINALISED
                          </Tag>
                        ) : (
                          <Button size="sm" kind="tertiary" onClick={() => runPreauth(iv)} disabled={st === 'pending'}>
                            {st === 'pending' ? <InlineLoading description="Awaiting…" /> : 'Raise preauth'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {preauthNeeded.some((iv) => resolveScenario(iv).preauth === 'elective') ? (
                    <p className={styles.electiveHint}>
                      Elective preauths are approved by a doctor before a future scheduled visit, which reuses the
                      approval. Billing stays locked until every preauth is FINALISED.
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {/* Step 5 — billing + copay */}
          {step === 4 ? (
            <section className={styles.panel}>
              <h5 className={styles.panelTitle}>Billing &amp; copay</h5>
              <p className={styles.panelSub}>
                SHA pays up to the tariff. Anything charged above tariff is a copay — assign who covers it (cash or
                another insurer) so the claim balances.
              </p>
              <div className={styles.billList}>
                {selected.map((iv) => {
                  const l = getLine(iv);
                  const editable = isChargeEditable(iv);
                  const cp = copayLine(iv);
                  return (
                    <div key={iv.code} className={styles.billRow}>
                      <div className={styles.billHead}>
                        <span className={styles.ivCode}>{iv.code}</span>
                        <span className={styles.selName}>{iv.name}</span>
                        <Tag size="sm" type="cool-gray">
                          {mechanismLabel(iv.paymentMechanism)}
                        </Tag>
                      </div>
                      <div className={styles.billFields}>
                        <NumberInput
                          id={`qty-${iv.code}`}
                          label={iv.paymentMechanism === 'PER_DIEM' ? 'Days' : 'Quantity'}
                          min={1}
                          value={l.quantity}
                          onChange={(_e, { value }) => {
                            setLines((prev) => ({ ...prev, [iv.code]: { ...l, quantity: Number(value) || 1 } }));
                            invalidatePreview();
                          }}
                        />
                        {editable ? (
                          <NumberInput
                            id={`charge-${iv.code}`}
                            label="Hospital charge (KES)"
                            min={0}
                            value={l.charge}
                            onChange={(_e, { value }) => {
                              setLines((prev) => ({ ...prev, [iv.code]: { ...l, charge: Number(value) || 0 } }));
                              invalidatePreview();
                            }}
                          />
                        ) : (
                          <div className={styles.tariffChip}>
                            {iv.paymentMechanism === 'PER_DIEM' ? 'Auto line · ' : ''}Charge fixed at tariff
                          </div>
                        )}
                        <div className={styles.tariffChip}>Tariff {money(iv.tariff)}</div>
                      </div>

                      {/* Harmonisation split */}
                      <div className={styles.split}>
                        <span className={styles.splitSha}>SHA {money(shaLine(iv))}</span>
                        {cp > 0 ? (
                          <>
                            <span className={styles.splitPlus}>+</span>
                            <span className={styles.splitCopay}>Copay {money(cp)}</span>
                            <Dropdown
                              id={`copay-${iv.code}`}
                              className={styles.copayDropdown}
                              size="sm"
                              titleText=""
                              label="Copay paid by…"
                              items={COPAY_PAYERS}
                              selectedItem={copayPayer[iv.code] ?? null}
                              onChange={({ selectedItem }) =>
                                setCopayPayer((prev) => ({ ...prev, [iv.code]: (selectedItem as string) ?? '' }))
                              }
                            />
                          </>
                        ) : (
                          <span className={styles.splitFull}>fully covered</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.totalsCard}>
                <div>
                  <span>SHA claim</span>
                  <strong>{money(totals.sha)}</strong>
                </div>
                <div>
                  <span>Copay</span>
                  <strong>{money(totals.copay)}</strong>
                </div>
                <div className={styles.totalsGrand}>
                  <span>Total charge</span>
                  <strong>{money(totals.grand)}</strong>
                </div>
              </div>
              {/* ICD-11 diagnoses from the OpenMRS encounter */}
              <div className={styles.dxBlock}>
                <h6 className={styles.dxTitle}>Diagnoses (ICD-11)</h6>
                <p className={styles.dxSub}>Pulled from the patient&apos;s encounter. Select the ones this claim supports.</p>
                {encounterDx.length === 0 ? (
                  <p className={styles.hintBad}>
                    No encounter diagnoses found — the clinician must record a diagnosis before the claim can be billed.
                  </p>
                ) : (
                  <div className={styles.dxList}>
                    {encounterDx.map((d) => (
                      <label key={d.uuid} className={styles.dxRow}>
                        <Checkbox
                          id={`dx-${d.uuid}`}
                          labelText={d.display}
                          checked={selectedDx.includes(d.uuid)}
                          onChange={(_e, { checked }) => toggleDx(d.uuid, checked)}
                        />
                        <span className={styles.dxCode}>{d.icd11Code}</span>
                        <Tag size="sm" type={d.certainty === 'CONFIRMED' ? 'green' : 'cool-gray'}>
                          {d.certainty === 'CONFIRMED' ? 'Confirmed' : 'Presumed'}
                        </Tag>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {!billingValid ? (
                <p className={styles.hintBad}>
                  {selectedDx.length === 0
                    ? 'Select at least one ICD-11 diagnosis and assign a payer to every copay before continuing.'
                    : 'Assign a payer to every copay before continuing.'}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Step 6 — preview & submit */}
          {step === 5 ? (
            <section className={styles.panel}>
              <h5 className={styles.panelTitle}>Preview &amp; {dispatch === 'discharge' ? 'discharge' : 'submit'}</h5>
              <dl className={styles.summary}>
                <div>
                  <dt>Patient</dt>
                  <dd>{eligibility?.fullName}</dd>
                </div>
                <div>
                  <dt>Interventions</dt>
                  <dd>{selected.length}</dd>
                </div>
                <div>
                  <dt>SHA claim</dt>
                  <dd>{money(totals.sha)}</dd>
                </div>
                <div>
                  <dt>Copay</dt>
                  <dd>{totals.copay > 0 ? money(totals.copay) : 'None'}</dd>
                </div>
                <div>
                  <dt>Diagnoses</dt>
                  <dd>{selectedDx.length} · ICD-11</dd>
                </div>
                <div>
                  <dt>Attachments</dt>
                  <dd>
                    {(attachmentsRequired ? 1 : 0) + (cashCopayTotal > 0 ? 1 : 0) || 'None'}
                    {attachmentsRequired ? ' · preview' : ''}
                    {cashCopayTotal > 0 ? ' · copay receipt' : ''}
                  </dd>
                </div>
                <div>
                  <dt>Dispatch</dt>
                  <dd>{dispatch === 'discharge' ? 'Discharge (IP)' : 'Submit (OP)'}</dd>
                </div>
              </dl>

              {/* Preview must be generated to unlock submit */}
              {preview ? (
                <div className={styles.consentOk}>
                  <CheckmarkFilled size={20} />
                  <span>
                    Preview {preview.previewId} generated.
                    {attachmentsRequired ? (
                      <>
                        {' '}
                        Attached as <strong>{preview.documentName}</strong>.
                      </>
                    ) : (
                      ' No attachment needed for capitation.'
                    )}
                  </span>
                </div>
              ) : (
                <Button size="md" renderIcon={Document} onClick={runPreview} disabled={previewing} className={styles.leftBtn}>
                  {previewing ? <InlineLoading description="Generating preview…" /> : 'Preview provider claim'}
                </Button>
              )}

              {preview && (attachmentsRequired || receipt) ? (
                <div className={styles.attachList}>
                  {attachmentsRequired ? (
                    <div className={styles.attachChip}>
                      <Document size={16} />
                      <span>{preview.documentName}</span>
                      <span className={styles.attachMeta}>Provider claim preview</span>
                      <Tag size="sm" type="green">
                        attached
                      </Tag>
                    </div>
                  ) : null}
                  {receipt ? (
                    <div className={styles.attachChip}>
                      <Receipt size={16} />
                      <span>{receipt.documentName}</span>
                      <span className={styles.attachMeta}>
                        Cash copay {money(receipt.amount)} · {receipt.receiptNo}
                      </span>
                      <Tag size="sm" type="green">
                        attached
                      </Tag>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Button
                size="md"
                renderIcon={Send}
                onClick={submit}
                disabled={submitting || !preview}
                className={styles.leftBtn}
              >
                {submitting ? (
                  <InlineLoading description="Submitting…" />
                ) : (
                  `${dispatch === 'discharge' ? 'Discharge' : 'Submit'} claim to SHA`
                )}
              </Button>
              {!preview ? <p className={styles.hintMuted}>Generate the preview to unlock submit.</p> : null}
            </section>
          ) : null}
        </div>
      </div>

      <footer className={styles.wsFooter}>
        <Button kind="secondary" size="md" renderIcon={ArrowLeft} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button kind="primary" size="md" renderIcon={ArrowRight} disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : null}
      </footer>
    </div>
  );
};

export default ClaimWorkspace;
