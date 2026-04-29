import {
  Descriptor,
  descriptorState,
  DescriptorState,
  EService,
  genericError,
} from "pagopa-interop-models";

const activeDescriptorStatesFilter: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
];

export function getLatestActiveDescriptor(eservice: EService): Descriptor {
  const descriptor = eservice.descriptors
    .filter((d) => activeDescriptorStatesFilter.includes(d.state))
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);

  if (!descriptor) {
    throw genericError(`EService ${eservice.id} has no active descriptor`);
  }

  return descriptor;
}
