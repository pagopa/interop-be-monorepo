import { DescriptorState, descriptorState } from "pagopa-interop-models";

export const activeDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
  descriptorState.archived,
];
