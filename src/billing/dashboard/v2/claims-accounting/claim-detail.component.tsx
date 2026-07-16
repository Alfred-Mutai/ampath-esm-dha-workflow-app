import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Breadcrumb, BreadcrumbItem, Button, InlineLoading, Tag, TextArea } from '@carbon/react';
import { DocumentPdf, Receipt, Renew, View, WarningAltFilled } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import styles from './claims-accounting.component.scss';
import { recallClaim, resubmitClaim, type ShaClaim } from './claims-accounting.resource';
import { statusMeta } from './status-meta';
import { buildClaimDocuments, claimDocumentLabel } from './bill-utils';
import InvoiceDocument from './invoice-document.component';

interface ClaimDetailProps {
  claim: ShaClaim;
  onBack: () => void;
  onChanged: () => void;
}

const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

const ClaimDetail: React.FC<ClaimDetailProps> = ({ claim, onBack, onChanged }) => {
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = statusMeta(claim.status);
  const documents = buildClaimDocuments(claim);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const printInvoice = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `Invoice-${claim.bill?.billNo ?? claim.claimCode.replace('CLM', 'INV')}`,
    pageStyle: '@page { size: A4; margin: 16mm; }',
  });

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
    if (!note.trim()) {
      setNoteError('Give a reason for the recall.');
      return;
    }
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
    if (!note.trim()) {
      setNoteError('Describe what changed before resubmitting.');
      return;
    }
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

  const initials = claim.patientName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={styles.detail}>
      <Breadcrumb noTrailingSlash className={styles.breadcrumb}>
        <BreadcrumbItem
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          Claims
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>{claim.claimCode}</BreadcrumbItem>
      </Breadcrumb>

      <div className={styles.topCard}>
      <div className={styles.detailHead}>
        <div className={styles.detailIdentity}>
          <span className={styles.detailAvatar}>{initials}</span>
          <div>
            <h4 className={styles.detailName}>{claim.patientName}</h4>
            <div className={styles.detailMeta}>
              <span className={styles.mono}>{claim.crNumber}</span>
              <Tag type="blue" size="sm">
                {claim.fund}
              </Tag>
              <Tag type="cool-gray" size="sm">
                {claim.serviceType === 'INPATIENT' ? 'Inpatient' : 'Outpatient'}
              </Tag>
            </div>
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

      {claim.status === 'PAID' ? (
        <div className={styles.paidBanner}>
          <Receipt size={20} />
          <span>
            Paid <strong>{money(claim.paidAmount ?? 0)}</strong> · remittance <strong>{claim.remittanceRef}</strong>
          </span>
        </div>
      ) : null}

      {/* At-a-glance money split: total → SHA slice + copay slice. */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryTile}>
          <span className={styles.summaryLabel}>Total charge</span>
          <span className={styles.summaryValue}>{money(bill.totalCharge)}</span>
        </div>
        <div className={`${styles.summaryTile} ${styles.tileSha}`}>
          <span className={styles.summaryLabel}>SHA covered</span>
          <span className={`${styles.summaryValue} ${styles.shaAmt}`}>{money(bill.shaCovered)}</span>
        </div>
        <div className={`${styles.summaryTile} ${bill.copay > 0 ? styles.tileCopay : ''}`}>
          <span className={styles.summaryLabel}>Copay{bill.copayPayer ? ` · ${bill.copayPayer}` : ''}</span>
          <span className={`${styles.summaryValue} ${bill.copay > 0 ? styles.copayAmt : styles.fullyCovered}`}>
            {bill.copay > 0 ? money(bill.copay) : 'None'}
          </span>
        </div>
      </div>
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailMain}>
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

          <section className={styles.detailSection}>
            <h5 className={styles.detailSectionTitle}>Supporting documents ({documents.length})</h5>
            <ul className={styles.docList}>
              {documents.map((d) => (
                <li key={d.id} className={styles.docItem}>
                  <span className={styles.docIcon}>
                    {d.type === 'INVOICE' ? <DocumentPdf size={18} /> : <Receipt size={18} />}
                  </span>
                  <div className={styles.docBody}>
                    <span className={styles.docName}>{d.name}</span>
                    <span className={styles.docMeta}>
                      {claimDocumentLabel(d.type)}
                      {d.autoGenerated ? ' · auto-generated' : ''}
                    </span>
                  </div>
                  {d.previewable ? (
                    <Button kind="ghost" size="sm" renderIcon={View} onClick={() => printInvoice()}>
                      Preview
                    </Button>
                  ) : (
                    <Tag size="sm" type="green">
                      attached
                    </Tag>
                  )}
                </li>
              ))}
            </ul>
            <p className={styles.docHint}>
              The system invoice is generated from the companion bill and attached automatically when the claim is
              submitted.
            </p>
          </section>

          {canRecall || canResubmit ? (
            <section className={styles.detailSection}>
              <h5 className={styles.detailSectionTitle}>{canResubmit ? 'Resubmit to SHA' : 'Recall claim'}</h5>
              <TextArea
                id="claim-note"
                labelText={canResubmit ? 'What changed' : 'Reason for recall'}
                placeholder={
                  canResubmit
                    ? 'e.g. Corrected unit price to within tariff; attached diagnosis.'
                    : 'e.g. Wrong tariff used.'
                }
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (noteError) {
                    setNoteError('');
                  }
                }}
                invalid={!!noteError}
                invalidText={noteError}
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

        <aside className={styles.detailAside}>
          <section className={styles.detailSection}>
            <h5 className={styles.detailSectionTitle}>Companion bill{bill.copay > 0 ? ' · copay' : ''}</h5>
            <div className={styles.billPanel}>
              <div className={styles.billLine}>
                <span>Bill no.</span>
                <span className={styles.mono}>{bill.billNo}</span>
              </div>
              <div className={styles.billLine}>
                <span>{bill.copay > 0 ? `Copay · ${bill.copayPayer ?? 'Cash'}` : 'Payer'}</span>
                <span>{bill.copay > 0 ? money(bill.copay) : 'SHA — fully covered'}</span>
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
        </aside>
      </div>

      <div className={styles.printArea} aria-hidden="true">
        <InvoiceDocument ref={invoiceRef} claim={claim} />
      </div>
    </div>
  );
};

export default ClaimDetail;
