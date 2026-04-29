import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { z } from "zod";

const RefsToBeArchived = z.object({
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
});
export type RefsToBeArchived = z.infer<typeof RefsToBeArchived>;
