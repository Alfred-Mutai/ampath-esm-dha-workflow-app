import React, { useState } from 'react';
import { Button, ButtonSet, Form, Modal, Select, SelectItem, Tag, TextInput } from '@carbon/react';
import { useSession, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './attachments.scss';
import { type VisitIntervention } from '../../types';
import { type UploadedFile } from './type';
import AttachmentComponent from './attachment.component';
import { sendClaimAttachment } from '../../../../../registry/hie.resource';

interface AddInterventionAttachmentWorkspaceProps extends DefaultWorkspaceProps {
  consentToken: string;
  patientUuid?: string;
  claimInterventions: VisitIntervention[];
}

const AddInterventionAttachmentsWorkspace: React.FC<AddInterventionAttachmentWorkspaceProps> = ({
  closeWorkspace,
  promptBeforeClosing,
  claimInterventions,
  consentToken,
}) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);

  const createAttachment = () => ({
    id: crypto.randomUUID(),
    documentType: '',
    title: '',
    files: [] as UploadedFile[],
  });

  const [attachments, setAttachments] = useState([createAttachment()]);
  const session = useSession();

  const locationUuid = session.sessionLocation?.uuid;

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;

        // Remove the data:...;base64, prefix if the API expects raw base64
        resolve(result.split(',')[1]);
      };

      reader.onerror = reject;

      reader.readAsDataURL(file);
    });

  const handleSubmit = async () => {
    if (!attachments.some((a) => a.files.length > 0)) {
      return;
    }

    try {
      for (const attachment of attachments) {
        const fileBlobs = await Promise.all(attachment.files.map(({ file }) => fileToBase64(file)));
        // for (const attachment of attachments) {
        //   for (const { file } of attachment.files) {
        //     const fileBlob = await fileToBase64(file);

        //     await sendClaimAttachment(
        //       consentToken,
        //       attachment.documentType,
        //       interventionCode,
        //       [fileBlob],
        //       locationUuid,
        //     );
        //   }
        // }

        await sendClaimAttachment(
          consentToken,
          attachment.documentType,
          claimInterventions[0].intervention_code,
          fileBlobs,
          'locationUuid',
        );
      }

      closeWorkspace();
    } catch (error) {
      console.error(error);
    }
  };
  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];

  const handleDiscard = () => {
    closeWorkspace();
  };

  if (!claimInterventions || claimInterventions.length === 0) return null;

  const docTypes = claimInterventions[0].applicable_document_types;

  const addFiles = (attachmentId: string, selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const uploaded: UploadedFile[] = Array.from(selectedFiles)
      .filter((file) => allowedTypes.includes(file.type))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
      }));

    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              files: [...attachment.files, ...uploaded],
            }
          : attachment,
      ),
    );
  };

  const removeFile = (attachmentId: string, fileId: string) => {
    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              files: attachment.files.filter((f) => f.id !== fileId),
            }
          : attachment,
      ),
    );
  };

  const updateAttachment = (attachmentId: string, field: 'title' | 'documentType', value: string) => {
    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              [field]: value,
            }
          : attachment,
      ),
    );
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((attachment) => attachment.id !== id);
    });
  };

  const totalFiles = attachments.reduce((count, attachment) => count + attachment.files.length, 0);

  return (
    <>
      <Form className={styles.form}>
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
        {attachments.map((attachment) => (
          <AttachmentComponent
            key={attachment.id}
            attachment={attachment}
            docTypes={docTypes}
            addFiles={addFiles}
            removeFile={removeFile}
            updateAttachment={updateAttachment}
            setPreviewUrl={setPreviewUrl}
            setPreviewOpen={setPreviewOpen}
            removeAttachment={removeAttachment}
            canDelete={attachments.length > 1}
          />
        ))}
        <Button
          className={styles.addAttachment}
          kind="secondary"
          onClick={() => setAttachments((prev) => [...prev, createAttachment()])}
        >
          Add Attachment
        </Button>
        <ButtonSet className={styles.buttonSet}>
          <Button kind="secondary" onClick={handleDiscard}>
            {t('discard', 'Discard')}
          </Button>
          <Button disabled={totalFiles === 0} kind="primary" onClick={handleSubmit}>
            {t('upload', `Upload ${totalFiles} File${totalFiles === 1 ? '' : 's'}`)}
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
            style={{
              width: '100%',
              height: '80vh',
              border: 'none',
            }}
            title="Document Preview"
          />
        )}
      </Modal>
    </>
  );
};

export default AddInterventionAttachmentsWorkspace;
