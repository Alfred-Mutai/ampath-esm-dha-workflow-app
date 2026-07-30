import React from 'react';
import { InlineLoading, Tag } from '@carbon/react';
import { type PreauthCheckKind } from '../../../../claims/claims.resource';

export type PreauthStatusDisplayKind = PreauthCheckKind | 'no_token' | 'loading';

export interface PreauthStatusTagProps {
  kind?: PreauthStatusDisplayKind | null;
  status?: string;
  preauthCode?: string;
  loading?: boolean;
}

/**
 * Shared preauth status Tag for list rows and other callers.
 * Prefer `kind` from `checkPreauthStatus` / `usePreauthPreview`.
 */
const PreauthStatusTag: React.FC<PreauthStatusTagProps> = ({
  kind,
  status,
  preauthCode,
  loading,
}) => {
  if (loading || kind === 'loading') {
    return <InlineLoading description="" />;
  }

  switch (kind) {
    case 'no_token':
      return (
        <Tag size="sm" type="red">
          No claim token
        </Tag>
      );
    case 'finalised':
      return (
        <Tag size="sm" type="green" title={preauthCode ? `Code: ${preauthCode}` : undefined}>
          {preauthCode ? `FINALISED · ${preauthCode}` : 'FINALISED'}
        </Tag>
      );
    case 'pending':
      return (
        <Tag size="sm" type="purple">
          {status?.trim() || 'Pending'}
        </Tag>
      );
    case 'failed':
      return (
        <Tag size="sm" type="red">
          {status?.trim() || 'Failed'}
        </Tag>
      );
    case 'error':
      return (
        <Tag size="sm" type="magenta">
          Error
        </Tag>
      );
    case 'not_raised':
    default:
      return (
        <Tag size="sm" type="gray">
          Not raised
        </Tag>
      );
  }
};

export default PreauthStatusTag;
