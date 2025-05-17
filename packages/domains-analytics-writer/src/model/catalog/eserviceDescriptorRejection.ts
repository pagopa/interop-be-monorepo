import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  EServiceDescriptorRejectionReasonSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceDescriptorRejectionReasonSchema = createSelectSchema(
  eserviceDescriptorRejectionReasonInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorRejectionReasonSchema = z.infer<
  typeof EserviceDescriptorRejectionReasonSchema
>;

export type EserviceDescriptorRejectionReasonMapping = {
  [K in keyof EserviceDescriptorRejectionReasonSchema]: (
    record: EServiceDescriptorRejectionReasonSQL
  ) => EserviceDescriptorRejectionReasonSchema[K];
};
