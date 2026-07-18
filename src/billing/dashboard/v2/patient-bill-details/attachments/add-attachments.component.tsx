import React, { useState } from 'react';
import { Button, ButtonSet, Form, Modal, Select, SelectItem, Tag, TextInput } from '@carbon/react';
import { type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './attachments.scss';
import { type VisitIntervention } from '../../types';
import { type UploadedFile } from './type';
import AttachmentComponent from './attachment.component';

interface AddInterventionAttachmentWorkspaceProps extends DefaultWorkspaceProps {
  patientUuid?: string;
  claimInterventions: VisitIntervention[];
}

const AddInterventionAttachmentsWorkspace: React.FC<AddInterventionAttachmentWorkspaceProps> = ({
  closeWorkspace,
  promptBeforeClosing,
  claimInterventions,
}) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);

  const createAttachment = () => ({
    id: crypto.randomUUID(),
    documentType: '',
    title: '',
    files: [],
  });

  const [attachments, setAttachments] = useState([createAttachment()]);

  const handleSubmit = () => {
    if (files.length === 0) return;
    closeWorkspace();
  };

  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];

  const handleDiscard = () => {
    closeWorkspace();
  };

  if (!claimInterventions || claimInterventions.length === 0) return null;

  const docTypes = claimInterventions[0].applicable_document_types;

  const addFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const uploaded: UploadedFile[] = Array.from(selectedFiles)
      .filter((file) => allowedTypes.includes(file.type))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
      }));

    setFiles((prev) => [...prev, ...uploaded]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((attachment) => attachment.id !== id);
    });
  };

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
            attachmentId={attachment.id}
            docTypes={docTypes}
            files={files}
            removeFile={removeFile}
            addFiles={addFiles}
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
          <Button disabled={files.length === 0} kind="primary" onClick={handleSubmit}>
            {t('upload', `Upload ${files.length} Files`)}
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
