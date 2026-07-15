import React, { useState } from 'react';
import { Button, InlineLoading, Tag, TextArea } from '@carbon/react';
import { ArrowLeft, Receipt, Renew, WarningAltFilled } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import styles from './claims-accounting.component.scss';
import { recallClaim, resubmitClaim, type ShaClaim } from './claims-accounting.resource';
import { statusMeta } from './status-meta';

interface ClaimDetailProps {
  claim: ShaClaim;
  onBack: () => void;
  onChanged: () => void;
}

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

const ClaimDetail: React.FC<ClaimDetailProps> = ({ claim, onBack, onChanged }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = statusMeta(claim.status);

  const canRecall = claim.status === 'SUBMITTED' || claim.status === 'APPROVED';
  const canResubmit = claim.status === 'RECALLED' || claim.status === 'REJECTED';

  // Every claim has a companion bill. When fully covered by SHA it's the
  // invoice; when there's a copay it's the cash slice + its receipt.
  const bill = claim.bill ?? {
    billNo: claim.claimCode.replace('CLM', 'INV'),
    totalCharge: claim.amount,
    shaCovered: claim.amount,
    copay: 0,
    document: 'sha-invoice.pdf',
  };

  const handleRecall = async () => {
    setBusy(true);
    try {
      await recallClaim(claim.id, note.trim());
      showSnackbar({ kind: 'success', title: 'Claim recalled', subtitle: 'You can now correct and resubmit it.' });
      onChanged();
      onBack();
    } finally {
      setBusy(false);
    }
  };

  const handleResubmit = async () => {
    setBusy(true);
    try {
      await resubmitClaim(claim.id, note.trim());
      showSnackbar({ kind: 'success', title: 'Claim resubmitted', subtitle: 'Sent back to SHA for processing.' });
      onChanged();
      onBack();
    } finally {
      setBusy(false);
    }
  };

  const lineTotal = claim.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return (
    <div className={styles.detail}>
      <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={onBack} className={styles.backBtn}>
        Back to claims
      </Button>

      <div className={styles.detailHead}>
        <div>
          <div className={styles.detailCode}>{claim.claimCode}</div>
          <h4 className={styles.detailName}>{claim.patientName}</h4>
          <div className={styles.detailMeta}>
            <span>{claim.crNumber}</span>
            <span className={styles.dot} />
            <span>{claim.fund}</span>
            <span className={styles.dot} />
            <span>{claim.serviceType === 'INPATIENT' ? 'Inpatient' : 'Outpatient'}</span>
          </div>
        </div>
        <Tag type={meta.tag} size="md">
          {meta.label}
        </Tag>
      </div>

      {claim.rejectionReason ? (
        <div className={styles.reasonNote}>
          <WarningAltFilled size={20} className={styles.reasonIcon} />
          <div>
            <div className={styles.reasonTitle}>{claim.status === 'REJECTED' ? 'Rejected by payer' : 'Recalled'}</div>
            <p className={styles.reasonText}>{claim.rejectionReason}</p>
          </div>
        </div>
      ) : null}

      <section className={styles.detailSection}>
        <h5 className={styles.detailSectionTitle}>Interventions</h5>
        <ul className={styles.interventionList}>
          {claim.interventions.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>

      {claim.diagnoses && claim.diagnoses.length > 0 ? (
        <section className={styles.detailSection}>
          <h5 className={styles.detailSectionTitle}>Diagnoses (ICD-11)</h5>
          <ul className={styles.diagnosisList}>
            {claim.diagnoses.map((d) => (
              <li key={d.icd11Code}>
                <span className={styles.mono}>{d.icd11Code}</span> · {d.display}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.detailSection}>
        <h5 className={styles.detailSectionTitle}>Claim lines</h5>
        <div className={styles.tableWrap}>
          <table className={styles.lineTable}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th className={styles.num}>Qty</th>
                <th className={styles.num}>Unit price</th>
                <th className={styles.num}>Tariff</th>
                <th className={styles.num}>Line total</th>
              </tr>
            </thead>
            <tbody>
              {claim.lines.map((l) => {
                const overTariff = l.unitPrice > l.tariff;
                return (
                  <tr key={l.code}>
                    <td className={styles.mono}>{l.code}</td>
                    <td>{l.description}</td>
                    <td className={styles.num}>{l.quantity}</td>
                    <td className={`${styles.num} ${overTariff ? styles.over : ''}`}>{money(l.unitPrice)}</td>
                    <td className={styles.num}>{money(l.tariff)}</td>
                    <td className={styles.num}>{money(l.unitPrice * l.quantity)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className={styles.num}>
                  Claim total
                </td>
                <td className={styles.num}>{money(lineTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {claim.attachments && claim.attachments.length > 0 ? (
        <section className={styles.detailSection}>
          <h5 className={styles.detailSectionTitle}>Attachments</h5>
          <ul className={styles.attachmentList}>
            {claim.attachments.map((a) => (
              <li key={a}>
                <Receipt size={16} /> {a}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {claim.status === 'PAID' ? (
        <div className={styles.paidBanner}>
          <Receipt size={20} />
          <span>
            Paid <strong>{money(claim.paidAmount ?? 0)}</strong> · remittance <strong>{claim.remittanceRef}</strong>
          </span>
        </div>
      ) : null}

      <section className={styles.detailSection}>
        <h5 className={styles.detailSectionTitle}>
          Companion bill{bill.copay > 0 ? ' · copay' : ''}
        </h5>
        <div className={styles.billPanel}>
          <div className={styles.billLine}>
            <span>Bill no.</span>
            <span className={styles.mono}>{bill.billNo}</span>
          </div>
          <div className={styles.billLine}>
            <span>Total charge</span>
            <strong>{money(bill.totalCharge)}</strong>
          </div>
          <div className={styles.billLine}>
            <span>SHA covered</span>
            <span className={styles.shaAmt}>{money(bill.shaCovered)}</span>
          </div>
          <div className={styles.billLine}>
            <span>Copay{bill.copayPayer ? ` · ${bill.copayPayer}` : ''}</span>
            {bill.copay > 0 ? (
              <span className={styles.copayAmt}>{money(bill.copay)}</span>
            ) : (
              <span className={styles.fullyCovered}>None · fully covered by SHA</span>
            )}
          </div>
          <div className={styles.billDoc}>
            <Receipt size={16} />
            <span>{bill.document}</span>
            <Tag size="sm" type="green">
              attached
            </Tag>
          </div>
        </div>
      </section>

      <section className={styles.detailSection}>
        <h5 className={styles.detailSectionTitle}>Timeline</h5>
        <ol className={styles.timeline}>
          {claim.timeline.map((e, idx) => (
            <li key={idx}>
              <span className={styles.timelineLabel}>{e.label}</span>
              <span className={styles.timelineMeta}>
                {new Date(e.at).toLocaleString('en-KE')}
                {e.by ? ` · ${e.by}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {canRecall || canResubmit ? (
        <section className={styles.actionPanel}>
          <TextArea
            id="claim-note"
            labelText={canResubmit ? 'Correction note (what changed)' : 'Reason for recall'}
            placeholder={
              canResubmit ? 'e.g. Corrected unit price to within tariff; attached diagnosis.' : 'e.g. Wrong tariff used.'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <div className={styles.actionRow}>
            {canRecall ? (
              <Button kind="danger--tertiary" size="sm" renderIcon={Renew} disabled={busy} onClick={handleRecall}>
                {busy ? <InlineLoading description="Recalling…" /> : 'Recall for correction'}
              </Button>
            ) : null}
            {canResubmit ? (
              <Button kind="primary" size="sm" renderIcon={Renew} disabled={busy} onClick={handleResubmit}>
                {busy ? <InlineLoading description="Resubmitting…" /> : 'Resubmit to SHA'}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default ClaimDetail;
