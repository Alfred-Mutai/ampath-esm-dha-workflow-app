import React from 'react';
import { Button, Select, SelectItem, Tag, TextInput } from '@carbon/react';

import styles from './attachments.scss';
import { TrashCan, View } from '@carbon/react/icons';
import { type UploadedFile } from './type';

interface AttachmentComponentProps {
  docTypes: any[];
  files: UploadedFile[];
  removeFile: (id: string) => void;
  addFiles: (selectedFiles: FileList | null) => void;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | undefined>>;
  setPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  removeAttachment: (id: string) => void;
  canDelete: boolean;
  attachmentId: string;
}
const AttachmentComponent: React.FC<AttachmentComponentProps> = ({
  docTypes,
  files,
  removeFile,
  addFiles,
  setPreviewUrl,
  setPreviewOpen,
  removeAttachment,
  canDelete,
  attachmentId,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '2rem',
        }}
      >
        {canDelete && (
          <Button kind="danger--ghost" size="sm" renderIcon={TrashCan} onClick={() => removeAttachment(attachmentId)} />
        )}
      </div>
      <div className={styles.formContent}>
        <div className={styles.subSection}>
          <Select id="doc" labelText="Select Document Type">
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
            defaultValue=""
            id="document-title"
            labelText="Document Title"
            maxCount={10}
            onChange={function Kbe() {}}
            onClick={function Kbe() {}}
            placeholder="Placeholder text"
            size="md"
            type="text"
            warnText="Warning message that is really long can wrap to more lines but should not be excessively long."
          />
        </div>
      </div>
      <div className={styles.uploadSection}>
        <h4>Uploaded Files</h4>

        <div className={styles.fileList}>
          {files.map(({ id, file }) => (
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

              <Button kind="ghost" size="sm" renderIcon={TrashCan} onClick={() => removeFile(id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <Button kind="tertiary" onClick={() => fileInputRef.current?.click()}>
          Add File
        </Button>
        <div className={styles.applicableFiles}>
          Allowed file types: <strong>PNG, JPG, PDF</strong>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </>
  );
};

export default AttachmentComponent;
