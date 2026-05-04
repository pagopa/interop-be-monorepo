import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { z } from "zod";

const RefsToBeArchived = z.object({
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
});
export type RefsToBeArchived = z.infer<typeof RefsToBeArchived>;

export const TestQueryModel = z.object({
  eserviceId: z.string(),
  wrongDescriptorIds: z.array(z.string()),
  scope: z.string().optional(),
  archivableOnMax: z.coerce.date(),
  wrongStates: z.number(),
})

export type TestQueryModel = z.infer<typeof TestQueryModel>;