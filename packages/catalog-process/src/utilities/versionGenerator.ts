import { Descriptor, EService } from "pagopa-interop-models";

export const getLatestDescriptor = (
  eservice: EService
): Descriptor | undefined =>
  [...eservice.descriptors].sort((a, b) => a.version - b.version).at(-1);

export const nextDescriptorVersion = (eservice: EService): number => {
  const currentVersion = getLatestDescriptor(eservice)?.version ?? 0;
  return currentVersion + 1;
};
