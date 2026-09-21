import { createSelectSchema } from "drizzle-zod";
import { eserviceDescriptorRejectionReasonInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorRejectionReasonSchema = createSelectSchema(
  eserviceDescriptorRejectionReasonInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorRejectionReasonSchema = z.infer<
  typeof EserviceDescriptorRejectionReasonSchema
>;
