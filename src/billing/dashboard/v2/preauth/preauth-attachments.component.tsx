import React, { useMemo, useRef, useState } from 'react';
import { Button, Dropdown, InlineLoading, Modal, Tag } from '@carbon/react';
import { DocumentPdf, TrashCan, View } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import InvoiceComponent from '../patient-bill-details/attachments/invoice.component';
import FinalBillComponent from '../patient-bill-details/attachments/final-bill.component';
import DischargeSummaryComponent from '../patient-bill-details/attachments/discharge-summary/discharge-summary';
import { type VisitIntervention } from '../types';
import { GENERATABLE_DOC_TYPES, type PreauthInterventionProps } from './preauth.resource';
import styles from './preauth.workspace.scss';

export type PreauthAttachmentRow = {
  id: string;
  document_type: string;
  document_title: string;
  file?: File;
  previewUrl?: string;
  source?: 'upload' | 'generate';
  required: boolean;
  generating?: boolean;
};

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Props = {
  attachments: PreauthAttachmentRow[];
  onChange: (updater: (prev: PreauthAttachmentRow[]) => PreauthAttachmentRow[]) => void;
  addableDocTypes: string[];
  billItem: Record<string, unknown>;
  intervention: PreauthInterventionProps;
  disabled?: boolean;
};

async function generatePdfFromElement(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  return pdf.output('blob');
}

function isAllowedFile(file: File): { ok: true } | { ok: false; reason: string } {
  const ext = `.${(file.name.split('.').pop() ?? '').toLowerCase()}`;
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.type) || file.type === '';
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    return { ok: false, reason: 'Only PNG, JPG, and PDF files are allowed.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: `${file.name} exceeds the maximum size of 10 MB.` };
  }
  return { ok: true };
}

const PreauthAttachments: React.FC<Props> = ({
  attachments,
  onChange,
  addableDocTypes,
  billItem,
  intervention,
  disabled,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [docTypeToAdd, setDocTypeToAdd] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const invoiceRef = useRef<HTMLDivElement>(null);
  const dischargeRef = useRef<HTMLDivElement>(null);
  const finalBillRef = useRef<HTMLDivElement>(null);

  const claimIntervention = useMemo(
    () =>
      ({
        id: intervention.code,
        intervention_code: intervention.code,
        intervention_name: intervention.name ?? intervention.code,
        applicable_document_types: (intervention.applicableDocumentTypes ??
          intervention.requiredPreauthDocumentTypes ??
          []) as VisitIntervention['applicable_document_types'],
        requires_surgical_preauth: !!intervention.requiresSurgicalPreauth,
        requires_renal_preauth: !!intervention.requiresRenalPreauth,
        requires_oncology_preauth: !!intervention.requiresOncologyPreauth,
        requires_radiology_preauth: !!intervention.requiresRadiologyPreauth,
        requires_optical_preauth: !!intervention.requiresOpticalPreauth,
        required_preauth_document_types: intervention.requiredPreauthDocumentTypes ?? [],
      }) as VisitIntervention,
    [intervention],
  );

  const updateRow = (id: string, patch: Partial<PreauthAttachmentRow>) => {
    onChange((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const clearRowFile = (id: string) => {
    onChange((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
        return {
          ...r,
          file: undefined,
          previewUrl: undefined,
          source: undefined,
          document_title: r.document_type.replace(/_/g, ' '),
          generating: false,
        };
      }),
    );
  };

  const handlePickFile = (id: string, file?: File) => {
    if (!file) return;
    const check = isAllowedFile(file);
    if (check.ok === false) {
      showSnackbar({ kind: 'error', title: 'Invalid file', subtitle: check.reason });
      return;
    }
    onChange((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
        return {
          ...r,
          file,
          previewUrl: URL.createObjectURL(file),
          source: 'upload' as const,
          document_title: file.name || r.document_title || 'Upload',
        };
      }),
    );
  };

  const handleGenerate = async (row: PreauthAttachmentRow) => {
    if (!GENERATABLE_DOC_TYPES.has(row.document_type)) {
      showSnackbar({
        kind: 'warning',
        title: 'Generate not available',
        subtitle: `No system generator for ${row.document_type}. Please add a file.`,
      });
      return;
    }

    let element: HTMLDivElement | null = null;
    switch (row.document_type) {
      case 'INVOICE':
        element = invoiceRef.current;
        break;
      case 'FINAL_BILL':
        element = finalBillRef.current;
        break;
      case 'DISCHARGE_SUMMARY':
        element = dischargeRef.current;
        break;
      default:
        showSnackbar({
          kind: 'warning',
          title: 'Generate not available',
          subtitle: `No system generator for ${row.document_type}. Please add a file.`,
        });
        return;
    }

    if (!element) {
      showSnackbar({
        kind: 'error',
        title: 'Generate failed',
        subtitle: 'Document template is not ready. Try again in a moment.',
      });
      return;
    }

    updateRow(row.id, { generating: true });
    try {
      await new Promise((r) => setTimeout(r, 300));
      const pdfBlob = await generatePdfFromElement(element);
      const file = new File([pdfBlob], `${row.document_type.toLowerCase()}.pdf`, { type: 'application/pdf' });
      onChange((prev) =>
        prev.map((r) => {
          if (r.id !== row.id) return r;
          if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
          return {
            ...r,
            file,
            previewUrl: URL.createObjectURL(file),
            source: 'generate' as const,
            document_title: `${row.document_type} (generated)`,
            generating: false,
          };
        }),
      );
      showSnackbar({
        kind: 'success',
        title: `${row.document_type} generated`,
        subtitle: 'It will be sent with Submit preauth.',
      });
    } catch (e: any) {
      updateRow(row.id, { generating: false });
      showSnackbar({
        kind: 'error',
        title: 'Generate failed',
        subtitle: String(e?.message ?? e),
      });
    }
  };

  const addOptional = (document_type: string) => {
    onChange((prev) => {
      if (prev.some((a) => a.document_type === document_type)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          document_type,
          document_title: document_type.replace(/_/g, ' '),
          required: false,
        },
      ];
    });
    setDocTypeToAdd(null);
  };

  const removeOptional = (id: string) => {
    onChange((prev) => {
      const row = prev.find((r) => r.id === id);
      if (!row || row.required) return prev;
      if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
  };

  const readyCount = attachments.filter((a) => a.file).length;

  return (
    <>
      <section className={styles.section}>
        <h5>Attachments</h5>
        <p className={styles.muted}>
          Add or generate all documents here. They are uploaded <strong>together</strong> with Submit preauth (HIE
          preauth multipart) — not via claim-attachment (that only works after preauth is approved). Allowed: PNG, JPG,
          PDF — max 10MB.
          {readyCount > 0 ? ` ${readyCount} file(s) ready.` : ''}
        </p>

        {attachments.map((row) => (
          <div key={row.id} className={styles.attachmentRow}>
            <div className={styles.attachmentMeta}>
              <Tag size="sm" type={row.required ? 'magenta' : 'gray'}>
                {row.required ? 'Required' : 'Optional'} · {row.document_type}
              </Tag>
              {row.file ? (
                <Tag size="sm" type="green">
                  {row.source === 'generate' ? 'Generated' : 'Ready'} · {row.file.name}
                </Tag>
              ) : null}
              {!row.required ? (
                <Button
                  kind="danger--ghost"
                  size="sm"
                  hasIconOnly
                  renderIcon={TrashCan}
                  iconDescription="Remove document type"
                  disabled={disabled}
                  onClick={() => removeOptional(row.id)}
                />
              ) : null}
            </div>

            <div className={styles.row}>
              <Button
                kind="tertiary"
                size="sm"
                disabled={disabled || row.generating || !GENERATABLE_DOC_TYPES.has(row.document_type)}
                onClick={() => handleGenerate(row)}
              >
                {row.generating ? <InlineLoading description="Generating…" /> : 'Generate'}
              </Button>

              <Button
                kind="tertiary"
                size="sm"
                disabled={disabled || row.generating}
                onClick={() => fileInputRefs.current[row.id]?.click()}
              >
                Add file
              </Button>

              {row.file && row.previewUrl ? (
                <>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={View}
                    disabled={disabled}
                    onClick={() => {
                      setPreviewUrl(row.previewUrl);
                      setPreviewOpen(true);
                    }}
                  >
                    View
                  </Button>
                  <Button kind="ghost" size="sm" renderIcon={TrashCan} disabled={disabled} onClick={() => clearRowFile(row.id)}>
                    Remove file
                  </Button>
                </>
              ) : (
                <span className={styles.muted}>
                  <DocumentPdf size={16} /> No file yet
                </span>
              )}

              <input
                ref={(el) => {
                  fileInputRefs.current[row.id] = el;
                }}
                type="file"
                hidden
                accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                disabled={disabled}
                onChange={(e) => {
                  handlePickFile(row.id, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        ))}

        {addableDocTypes.length > 0 ? (
          <Dropdown
            key={`add-doc-${attachments.length}-${addableDocTypes.join('|')}`}
            id="add-optional-doc"
            titleText="Add optional document type"
            label="Select"
            items={addableDocTypes}
            selectedItem={docTypeToAdd}
            disabled={disabled}
            onChange={({ selectedItem }) => {
              if (selectedItem) addOptional(selectedItem);
            }}
          />
        ) : (
          <p className={styles.muted}>All available document types have been added.</p>
        )}
      </section>

      <Modal
        open={previewOpen}
        passiveModal
        modalHeading="Document preview"
        onRequestClose={() => setPreviewOpen(false)}
        size="lg"
      >
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title="Document preview"
            style={{ width: '100%', height: '80vh', border: 'none' }}
          />
        ) : null}
      </Modal>

      <div className={styles.offscreenTemplates} aria-hidden>
        <InvoiceComponent ref={invoiceRef} bill={billItem} />
        <FinalBillComponent ref={finalBillRef} bill={billItem} />
        <DischargeSummaryComponent ref={dischargeRef} bill={billItem} claimIntervention={claimIntervention} />
      </div>
    </>
  );
};

export default PreauthAttachments;
