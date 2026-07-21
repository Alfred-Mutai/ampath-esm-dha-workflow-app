import React, { useRef, useState } from 'react';

import { useSession, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { type VisitIntervention } from '../../types';

import styles from './attachments.scss';
import { Button, ButtonSet, Form, Modal, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { type GeneratedDocument } from './type';
import { DocumentPdf, TrashCan, View } from '@carbon/react/icons';
import InvoiceComponent from './invoice.component';
import DischargeSummaryComponent from './discharge-summary';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sendClaimAttachment } from '../../../../../registry/hie.resource';
import FinalBillComponent from './final-bill.component';

interface GenerateAttachmentsProps extends DefaultWorkspaceProps {
  claimInterventions: VisitIntervention[];
  bill: any;
  consentToken: string;
}

const GenerateAttachments: React.FC<GenerateAttachmentsProps> = ({
  closeWorkspace,
  promptBeforeClosing,
  claimInterventions,
  bill,
  consentToken,
}) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([
    {
      id: crypto.randomUUID(),
      name: 'DISCHARGE_SUMMARY',
      generated: false,
    },
    {
      id: crypto.randomUUID(),
      name: 'INVOICE',
      generated: false,
    },
    {
      id: crypto.randomUUID(),
      name: 'FINAL_BILL',
      generated: false,
    },
  ]);
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid;

  const invoiceRef = useRef<HTMLDivElement>(null);
  const dischargeRef = useRef<HTMLDivElement>(null);
  const finalBillRef = useRef<HTMLDivElement>(null);

  console.log('BILL: ', bill);

  if (!claimInterventions?.length) return null;

  const generatePdf = async (element: HTMLElement): Promise<Blob> => {
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
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    return pdf.output('blob');
  };

  const docTypes = claimInterventions[0].applicable_document_types;

  const handleSubmit = async (document: GeneratedDocument) => {
    if (!document.file) {
      return;
    }

    try {
      await sendClaimAttachment(
        consentToken,
        document.name,
        claimInterventions[0].intervention_code,
        document.file,
        locationUuid!,
      );

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === document.id
            ? {
                ...d,
                uploaded: true,
              }
            : d,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDiscard = () => {
    closeWorkspace();
  };

  const deleteDocument = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;

        if (d.url) {
          URL.revokeObjectURL(d.url);
        }

        return {
          ...d,
          generated: false,
          uploaded: false,
          file: undefined,
          url: undefined,
        };
      }),
    );
  };

  const generateDocument = async (document: GeneratedDocument) => {
    let element: HTMLDivElement | null = null;

    if (document.name === 'INVOICE') {
      element = invoiceRef.current;
    } else if (document.name === 'FINAL_BILL') {
      element = finalBillRef.current;
    } else {
      element = dischargeRef.current;
    }

    if (!element) {
      console.error('PDF element not found');
      return;
    }

    const pdfBlob = await generatePdf(element);

    const url = URL.createObjectURL(pdfBlob);

    const file = new File([pdfBlob], `${document.name}.pdf`, {
      type: 'application/pdf',
    });

    setDocuments((prev) =>
      prev.map((d) =>
        d.id === document.id
          ? {
              ...d,
              generated: true,
              uploaded: false,
              file,
              url,
            }
          : d,
      ),
    );
  };

  const generatedCount = documents.filter((d) => d.generated).length;
  return (
    <>
      <Form className={styles.form}>
        <div className={styles.formContent}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: '1rem',
              justifyContent: 'center',
            }}
          >
            <div className={styles.interventionSection}>
              <span>Intervention name</span>
              <Tag type="blue">{claimInterventions[0].intervention_name}</Tag>
            </div>
            <div className={styles.interventionSection}>
              <span>Intervention code</span>
              <Tag type="blue">{claimInterventions[0].intervention_code}</Tag>
            </div>
          </div>
        </div>
        <div className={styles.fileList}>
          {documents.map((document) => (
            <div key={document.id} className={styles.fileItem}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flex: 1,
                }}
              >
                <DocumentPdf size={20} />
                <span>{document.name}</span>
              </div>

              {!document.generated ? (
                <Button kind="ghost" size="sm" onClick={() => generateDocument(document)}>
                  Generate
                </Button>
              ) : !document.uploaded ? (
                <Button kind="primary" size="sm" onClick={() => handleSubmit(document)}>
                  Upload
                </Button>
              ) : (
                <>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={View}
                    onClick={() => {
                      setPreviewUrl(document.url);
                      setPreviewOpen(true);
                    }}
                  >
                    View
                  </Button>

                  <Button kind="ghost" size="sm" renderIcon={TrashCan} onClick={() => deleteDocument(document.id)}>
                    Delete
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <ButtonSet className={styles.buttonSet}>
          <Button kind="secondary" onClick={handleDiscard}>
            {t('close', 'Close')}
          </Button>
        </ButtonSet>
      </Form>
      <Modal
        open={previewOpen}
        passiveModal
        modalHeading="Document Preview"
        onRequestClose={() => setPreviewOpen(false)}
        size="lg"
      >
        {previewUrl && (
          <iframe
            src={previewUrl}
            title="Preview"
            style={{
              width: '100%',
              height: '80vh',
              border: 'none',
            }}
          />
        )}
      </Modal>
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <InvoiceComponent ref={invoiceRef} bill={bill} />

        <DischargeSummaryComponent ref={dischargeRef} claimIntervention={claimInterventions} bill={bill} />

        <FinalBillComponent ref={finalBillRef} bill={bill} />
      </div>
    </>
  );
};

export default GenerateAttachments;
