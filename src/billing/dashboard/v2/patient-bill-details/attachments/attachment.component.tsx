import React from 'react';
import { Button, Select, SelectItem, Tag, TextInput } from '@carbon/react';

import styles from './attachments.scss';
import { TrashCan, View } from '@carbon/react/icons';
import { type Attachment, type UploadedFile } from './type';

interface AttachmentComponentProps {
  attachment: Attachment;
  docTypes: string[];
  addFiles: (attachmentId: string, selectedFiles: FileList | null) => void;
  removeFile: (attachmentId: string, fileId: string) => void;
  updateAttachment: (attachmentId: string, field: 'documentType' | 'title', value: string) => void;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | undefined>>;
  setPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  removeAttachment: (id: string) => void;
  canDelete: boolean;
  uploadFile: (attachmentId: string, fileId: string) => Promise<void>;
}
const AttachmentComponent: React.FC<AttachmentComponentProps> = ({
  attachment,
  docTypes,
  addFiles,
  removeFile,
  updateAttachment,
  setPreviewUrl,
  setPreviewOpen,
  removeAttachment,
  canDelete,
  uploadFile,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  return (
    <div className={styles.attachment}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '2rem',
        }}
      >
        {canDelete && (
          <Button
            kind="danger--ghost"
            size="sm"
            renderIcon={TrashCan}
            onClick={() => removeAttachment(attachment.id)}
          />
        )}
      </div>
      <div className={styles.formContent}>
        <div className={styles.subSection}>
          <Select
            id={`doc-${attachment.id}`}
            labelText="Document Type"
            value={attachment.documentType}
            onChange={(e) => updateAttachment(attachment.id, 'documentType', e.target.value)}
          >
            <SelectItem value="" text="Select" />

            {docTypes.map((document) => (
              <SelectItem key={document} value={document} text={document} />
            ))}
          </Select>
        </div>
        <div
          style={{
            width: 300,
            margin: '2rem',
          }}
        >
          <TextInput
            id={`title-${attachment.id}`}
            labelText="Document Title"
            value={attachment.title}
            onChange={(e) => updateAttachment(attachment.id, 'title', e.target.value)}
          />
        </div>
      </div>
      <div className={styles.uploadSection}>
        <h4>Uploaded Files</h4>

        <div className={styles.fileList}>
          {attachment.files.map(({ id, file, uploaded }) => (
            <div key={id} className={styles.fileItem}>
              <span>{file.name}</span>

              <Button
                kind="ghost"
                size="sm"
                renderIcon={View}
                onClick={() => {
                  setPreviewUrl(URL.createObjectURL(file));
                  setPreviewOpen(true);
                }}
              >
                View
              </Button>

              {!uploaded ? (
                <Button kind="primary" size="sm" onClick={() => uploadFile(attachment.id, id)}>
                  Upload
                </Button>
              ) : (
                <Tag type="green">Uploaded</Tag>
              )}

              <Button kind="ghost" size="sm" renderIcon={TrashCan} onClick={() => removeFile(attachment.id, id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <Button kind="tertiary" onClick={() => fileInputRef.current?.click()}>
          Add File
        </Button>
        <div className={styles.applicableFiles}>
          Allowed file types: <strong>PNG, JPG, PDF - max 10MB</strong>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          onChange={(e) => {
            const selectedFiles = e.target.files;

            if (!selectedFiles) return;

            const oversizedFiles = Array.from(selectedFiles).filter((file) => file.size > MAX_FILE_SIZE);

            if (oversizedFiles.length > 0) {
              alert(
                `The following file(s) exceed the maximum size of 10 MB:\n\n${oversizedFiles
                  .map((f) => f.name)
                  .join('\n')}`,
              );

              e.target.value = '';
              return;
            }

            addFiles(attachment.id, selectedFiles);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};

export default AttachmentComponent;
