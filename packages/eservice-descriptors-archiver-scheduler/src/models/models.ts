import {
  ArchivingScope,
  DescriptorId,
  DescriptorState,
  EServiceId,
} from "pagopa-interop-models";
import { z } from "zod";

const RefsToBeArchived = z.object({
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
});
export type RefsToBeArchived = z.infer<typeof RefsToBeArchived>;

const WrongDescriptor = z.object({
  id: DescriptorId,
  state: DescriptorState,
  scope: ArchivingScope.nullable(),
});
export type WrongDescriptor = z.infer<typeof WrongDescriptor>;

const WrongEService = z.object({
  eserviceId: EServiceId,
  wrongDescriptors: z
    .array(WrongDescriptor)
    .nullish()
    .transform((value): WrongDescriptor[] => value ?? []),
});

type WrongEService = z.infer<typeof WrongEService>;

export const WrongEServices = z.array(WrongEService);

export type WrongEServices = z.infer<typeof WrongEServices>;
