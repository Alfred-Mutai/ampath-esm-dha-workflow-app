import { type ClaimStatus } from './claims-accounting.resource';

type TagType = 'gray' | 'blue' | 'green' | 'teal' | 'red' | 'magenta' | 'purple' | 'cyan' | 'warm-gray';

/** Human label + Carbon Tag colour for each claim status. */
export function statusMeta(status: ClaimStatus): { label: string; tag: TagType } {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', tag: 'gray' };
    case 'PREAUTH_PENDING':
      return { label: 'Preauth pending', tag: 'purple' };
    case 'SUBMITTED':
      return { label: 'Submitted', tag: 'blue' };
    case 'APPROVED':
      return { label: 'Approved', tag: 'teal' };
    case 'REJECTED':
      return { label: 'Rejected', tag: 'red' };
    case 'RECALLED':
      return { label: 'Recalled', tag: 'magenta' };
    case 'PAID':
      return { label: 'Paid', tag: 'green' };
    default:
      return { label: status, tag: 'gray' };
  }
}
