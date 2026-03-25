import { QueueEntryPriority, type TagColor, type TagType } from '../../types/types';

export function getTagType(val: number | string): TagType {
  if (val === 1 || val === '1') {
    return 'green';
  } else {
    return 'red';
  }
}

export const getTagTypeByPriority = (priority: string): TagColor => {
  let type: TagColor;
  switch (priority) {
    case QueueEntryPriority.Emergency:
      type = 'red';
      break;
    case QueueEntryPriority.Priority:
      type = 'blue';
      break;
    case QueueEntryPriority.NonUrgent:
      type = 'green';
      break;
    case `${QueueEntryPriority.Emergency} PRIORITY`:
      type = 'red';
      break;
    case `${QueueEntryPriority.NonUrgent} PRIORITY`:
      type = 'green';
      break;
    default:
      type = 'gray';
  }
  return type;
};

export const getTagClassByPriority = (priority: string): string => {
  let className: string;
  switch (priority) {
    case QueueEntryPriority.Emergency:
      className = 'emergencyTag';
      break;
    case QueueEntryPriority.Priority:
      className = 'priorityTag';
      break;
    case QueueEntryPriority.NonUrgent:
      className = 'nonUrgentTag';
      break;
    case `${QueueEntryPriority.Emergency} PRIORITY`:
      className = 'emergencyTag';
      break;
    case `${QueueEntryPriority.NonUrgent} PRIORITY`:
      className = 'nonUrgentTag';
      break;
    case `${QueueEntryPriority.Priority} PRIORITY`:
      className = 'priorityTag';
      break;
    case 'NORMAL PRIORITY':
      className = 'priorityTag';
      break;
    case 'NOT URGENT':
      className = 'nonUrgentTag';
      break;
    default:
      className = 'gray';
  }
  return className;
};
