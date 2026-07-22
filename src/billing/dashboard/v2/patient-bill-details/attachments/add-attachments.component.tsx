import React, { useState } from 'react';
import { Button, ButtonSet, Form, Modal, Select, SelectItem, Tag, TextInput } from '@carbon/react';
import { showSnackbar, useSession, type DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './attachments.scss';
import { type VisitIntervention } from '../../types';
import { type UploadedFile } from './type';
import AttachmentComponent from './attachment.component';
import { sendClaimAttachment } from '../../../../../registry/hie.resource';

interface AddInterventionAttachmentWorkspaceProps extends DefaultWorkspaceProps {
  consentToken: string;
  claimInterventions: VisitIntervention;
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

  const uploadFile = async (attachmentId: string, fileId: string) => {
    const attachment = attachments.find((a) => a.id === attachmentId);
    if (!attachment) return;

    const uploadedFile = attachment.files.find((f) => f.id === fileId);
    if (!uploadedFile) return;

    try {
      const response = await sendClaimAttachment(
        consentToken,
        attachment.documentType,
        claimInterventions.intervention_code,
        uploadedFile.file,
        locationUuid!,
      );

      if (response.error) {
        showSnackbar({
          kind: 'error',
          title: 'Error Uploading Attachment',
          subtitle: response.message,
        });

        return;
      }

      setAttachments((prev) =>
        prev.map((a) =>
          a.id !== attachmentId
            ? a
            : {
                ...a,
                files: a.files.map((f) =>
                  f.id !== fileId
                    ? f
                    : {
                        ...f,
                        uploaded: true,
                      },
                ),
              },
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };
  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];

  const handleDiscard = () => {
    closeWorkspace();
  };

  const allUploaded =
    attachments.length > 0 && attachments.every((a) => a.files.length > 0 && a.files.every((f) => f.uploaded));

  if (!claimInterventions) return null;

  const docTypes = claimInterventions.applicable_document_types;

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
            <Tag type="blue">{claimInterventions.intervention_name}</Tag>
          </div>
          <div className={styles.interventionSection}>
            <span>Intervention code</span>
            <Tag type="blue">{claimInterventions.intervention_code}</Tag>
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
            uploadFile={uploadFile}
          />
        ))}
        <Button
          className={styles.addAttachment}
          kind="secondary"
          onClick={() => setAttachments((prev) => [...prev, createAttachment()])}
        >
          Add Attachment
        </Button>
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
