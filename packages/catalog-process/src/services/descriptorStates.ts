import { DescriptorState, descriptorState } from "pagopa-interop-models";

export const activeDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
  descriptorState.archived,
];

export const catalogVisibleDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
];

export const catalogRelevantDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
];
