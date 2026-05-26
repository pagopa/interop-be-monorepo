import {
  ArchivingScope,
  DescriptorId,
  DescriptorState,
  EServiceId,
} from "pagopa-interop-models";
import { z } from "zod";

const ArchivableDescriptorRef = z.object({
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
});
export type ArchivableDescriptorRef = z.infer<typeof ArchivableDescriptorRef>;

const UnarchivableDescriptor = z.object({
  id: DescriptorId,
  state: DescriptorState,
  scope: ArchivingScope.nullable(),
});
export type UnarchivableDescriptor = z.infer<typeof UnarchivableDescriptor>;

const EServiceWithUnarchivableDescriptors = z.object({
  eserviceId: EServiceId,
  unarchivableDescriptors: z
    .array(UnarchivableDescriptor)
    .nullish()
    .transform((value): UnarchivableDescriptor[] => value ?? []),
});

type EServiceWithUnarchivableDescriptors = z.infer<
  typeof EServiceWithUnarchivableDescriptors
>;

export const EServicesWithUnarchivableDescriptors = z.array(
  EServiceWithUnarchivableDescriptors
);

export type EServicesWithUnarchivableDescriptors = z.infer<
  typeof EServicesWithUnarchivableDescriptors
>;
