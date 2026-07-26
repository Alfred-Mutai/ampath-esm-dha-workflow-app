import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Tag } from '@carbon/react';
import { CheckmarkFilled, CloudUpload, DocumentBlank, DocumentPdf, Renew, TrashCan, View } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { type ClaimAttachment, type PatientFacilityBillDetails, type VisitIntervention } from '../../types';
import { useInvalidateProviderClaimPreview } from '../../../../billing-claims.resource';
import { sendClaimAttachment } from '../../../../../registry/hie.resource';
import InvoiceComponent from '../../patient-bill-details/attachments/invoice.component';
import FinalBillComponent from '../../patient-bill-details/attachments/final-bill.component';
import DischargeSummaryComponent from '../../patient-bill-details/attachments/discharge-summary/discharge-summary';
import styles from './intervention-attachments.component.scss';

// Document types the system can render from EMR data; everything else is uploaded by
// hand. Edit this set as more generators are added.
const AUTO_DOC_TYPES = new Set(['INVOICE', 'FINAL_BILL', 'DISCHARGE_SUMMARY']);

// "CASE_SUMMARY" -> "Case summary" for display; the raw code is still sent to the API.
const humanize = (docType: string): string => {
  const spaced = docType.replace(/_/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export interface InterventionAttachmentsProps {
  intervention: VisitIntervention;
  consentToken: string;
  locationUuid: string;
  claimAttachments: ClaimAttachment[];
  bill?: PatientFacilityBillDetails;
  /** Only a draft claim accepts new documents; otherwise the rows are read-only. */
  isClaimDraft?: boolean;
}

const generatePdfFile = async (element: HTMLElement, name: string): Promise<File> => {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight);
  return new File([pdf.output('blob')], `${name}.pdf`, { type: 'application/pdf' });
};

/**
 * The required documents for a single intervention (its `applicable_document_types`,
 * deduped). Each document is first STAGED — chosen (manual) or generated from EMR
 * (invoice/final bill) — so it can be previewed and removed; it's only sent to the
 * claim when the user confirms. Attached to THIS intervention's code.
 */
const InterventionAttachments: React.FC<InterventionAttachmentsProps> = ({
  intervention,
  consentToken,
  locationUuid,
  claimAttachments,
  bill,
  isClaimDraft = false,
}) => {
  const invalidate = useInvalidateProviderClaimPreview();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [attachedNow, setAttachedNow] = useState<Set<string>>(new Set());
  // Files chosen/generated but not yet sent — awaiting review and confirmation.
  const [staged, setStaged] = useState<Record<string, { file: File; url: string }>>({});
  // Preview URLs of files already attached this session.
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const finalBillRef = useRef<HTMLDivElement>(null);
  const dischargeRef = useRef<HTMLDivElement>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const createdUrls = useRef<string[]>([]);

  // Release blob URLs created this session on unmount.
  useEffect(() => () => createdUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const requiredDocs = Array.from(new Set(intervention.applicable_document_types ?? []));

  const claimAttachmentFor = (docType: string): ClaimAttachment | undefined =>
    (claimAttachments ?? []).find(
      (a) => a.intervention_code === intervention.intervention_code && a.attachment_type === docType,
    );

  const isAttached = (docType: string) => attachedNow.has(docType) || Boolean(claimAttachmentFor(docType));

  // Preview source: staged file, else the file just attached, else the stored link.
  const previewUrlFor = (docType: string): string | undefined =>
    staged[docType]?.url ?? localUrls[docType] ?? claimAttachmentFor(docType)?.data;

  // Hold a chosen/generated file for review — nothing is sent yet.
  const stage = (docType: string, file: File) => {
    const url = URL.createObjectURL(file);
    createdUrls.current.push(url);
    setStaged((s) => ({ ...s, [docType]: { file, url } }));
  };

  const unstage = (docType: string) => {
    setStaged((s) => {
      const next = { ...s };
      delete next[docType];
      return next;
    });
  };

  const generateAndStage = async (docType: string) => {
    const refByType: Record<string, React.RefObject<HTMLDivElement>> = {
      INVOICE: invoiceRef,
      FINAL_BILL: finalBillRef,
      DISCHARGE_SUMMARY: dischargeRef,
    };
    const element = refByType[docType]?.current;
    if (!element) {
      return;
    }
    setBusy((b) => ({ ...b, [docType]: true }));
    try {
      const file = await generatePdfFile(element, docType);
      stage(docType, file);
    } catch (error) {
      showSnackbar({ kind: 'error', title: `Could not generate ${docType}`, subtitle: 'Please try again or contact support.' });
    } finally {
      setBusy((b) => ({ ...b, [docType]: false }));
    }
  };

  const onFilePicked = (docType: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      stage(docType, file);
    }
  };

  // Send the reviewed, staged file to the claim.
  const confirmAttach = async (docType: string) => {
    const item = staged[docType];
    if (!item) {
      return;
    }
    setBusy((b) => ({ ...b, [docType]: true }));
    try {
      const response = await sendClaimAttachment(
        consentToken,
        docType,
        intervention.intervention_code,
        item.file,
        locationUuid,
      );
      // This endpoint reports failure in the body of an otherwise successful response —
      // a submitted or closed claim comes back as {error, message, code: 400} with HTTP
      // 200. Taking the resolved promise as proof of success marked the document
      // attached when the backend had in fact rejected it.
      if (response?.error) {
        showSnackbar({
          kind: 'error',
          title: response.error ?? `Could not attach ${humanize(docType)}`,
          subtitle: response.message ?? 'Please try again or contact support.',
        });
        // Left staged deliberately, so the file survives for a retry.
        return;
      }
      setLocalUrls((u) => ({ ...u, [docType]: item.url }));
      setAttachedNow((s) => new Set(s).add(docType));
      unstage(docType);
      showSnackbar({ kind: 'success', title: `${docType} attached`, subtitle: `Attached to ${intervention.intervention_code}` });
      invalidate();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: `Could not attach ${humanize(docType)}`,
        subtitle: error?.message ?? 'Please try again or contact support.',
      });
    } finally {
      setBusy((b) => ({ ...b, [docType]: false }));
    }
  };

  if (requiredDocs.length === 0) {
    return (
      <div className={styles.empty}>
        <DocumentBlank size={20} className={styles.emptyIcon} />
        <span>No documents required for this intervention.</span>
      </div>
    );
  }

  const attachedCount = requiredDocs.filter(isAttached).length;
  const allAttached = attachedCount === requiredDocs.length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>Required claim documents</span>
        <Tag size="sm" type={allAttached ? 'green' : 'gray'}>
          {attachedCount}/{requiredDocs.length} attached
        </Tag>
      </div>

      <ul className={styles.docs}>
        {requiredDocs.map((docType) => {
          const auto = AUTO_DOC_TYPES.has(docType);
          const attached = isAttached(docType);
          const stagedItem = staged[docType];
          const processing = busy[docType];
          const previewUrl = previewUrlFor(docType);
          return (
            <li className={`${styles.docRow} ${auto ? styles.auto : styles.manual}`} key={docType}>
              <span className={styles.docLeft}>
                <span className={styles.docBadge}>
                  <DocumentPdf size={18} />
                </span>
                <span className={styles.docText}>
                  <span className={styles.docName}>{humanize(docType)}</span>
                  <span className={styles.docMethod}>{auto ? 'Generated from EMR' : 'Manual upload'}</span>
                </span>
              </span>

              <span className={styles.docAction}>
                {attached ? (
                  <>
                    <span className={styles.attached}>
                      <CheckmarkFilled size={16} />
                      Attached
                    </span>
                    {previewUrl ? (
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={View}
                        iconDescription="Preview"
                        hasIconOnly
                        onClick={() => setPreview({ url: previewUrl, name: humanize(docType) })}
                      />
                    ) : null}
                  </>
                ) : !isClaimDraft ? (
                  // Past draft the claim takes no more documents, so an unattached one
                  // is stated rather than offered — no generate, choose or upload path.
                  <span className={styles.notAttached}>Not attached</span>
                ) : stagedItem ? (
                  // Staged: review, remove, or attach.
                  <>
                    <Tag size="sm" type="blue">
                      Ready to review
                    </Tag>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={View}
                      iconDescription="Preview"
                      hasIconOnly
                      onClick={() => setPreview({ url: stagedItem.url, name: humanize(docType) })}
                    />
                    <Button
                      kind="danger--ghost"
                      size="sm"
                      renderIcon={TrashCan}
                      iconDescription="Remove"
                      hasIconOnly
                      disabled={processing}
                      onClick={() => unstage(docType)}
                    />
                    <Button
                      kind="primary"
                      size="sm"
                      renderIcon={CloudUpload}
                      disabled={processing}
                      onClick={() => confirmAttach(docType)}
                    >
                      {processing ? 'Attaching…' : 'Attach'}
                    </Button>
                  </>
                ) : auto ? (
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={Renew}
                    disabled={processing || !bill}
                    onClick={() => generateAndStage(docType)}
                  >
                    {processing ? 'Generating…' : 'Generate'}
                  </Button>
                ) : (
                  <>
                    <input
                      type="file"
                      hidden
                      accept=".pdf,image/*"
                      ref={(el) => (fileInputs.current[docType] = el)}
                      onChange={(event) => onFilePicked(docType, event)}
                    />
                    <Button
                      kind="tertiary"
                      size="sm"
                      renderIcon={CloudUpload}
                      onClick={() => fileInputs.current[docType]?.click()}
                    >
                      Choose file
                    </Button>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Off-screen sources for the auto-generated PDFs. */}
      {bill ? (
        <div className={styles.hiddenPdf} aria-hidden="true">
          <InvoiceComponent ref={invoiceRef} bill={bill} />
          <FinalBillComponent ref={finalBillRef} bill={bill} />
          <DischargeSummaryComponent ref={dischargeRef} bill={bill} claimIntervention={intervention} />
        </div>
      ) : null}

      <Modal
        open={Boolean(preview)}
        passiveModal
        size="lg"
        modalHeading={preview?.name ?? 'Document preview'}
        onRequestClose={() => setPreview(null)}
      >
        {preview ? <iframe src={preview.url} title="Attachment preview" className={styles.previewFrame} /> : null}
      </Modal>
    </div>
  );
};

export default InterventionAttachments;
