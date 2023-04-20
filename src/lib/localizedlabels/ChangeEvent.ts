import { LocalizedLabel } from './LocalizedLabel';

export default interface ChangeEvent {
  target: 'LocalizedLabelManager',
  type: 'cacheUpdate',
  removedHighestLevelParentId: string[],
  changedLabels: LocalizedLabel[],
  createdLabels: LocalizedLabel[],
}
