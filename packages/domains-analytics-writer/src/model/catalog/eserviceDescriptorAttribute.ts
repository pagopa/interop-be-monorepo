import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  EServiceDescriptorAttributeSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceDescriptorAttributeSchema = createSelectSchema(
  eserviceDescriptorAttributeInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorAttributeSchema = z.infer<
  typeof EserviceDescriptorAttributeSchema
>;

export type EserviceDescriptorAttributeMapping = {
  [K in keyof EserviceDescriptorAttributeSchema]: (
    record: EServiceDescriptorAttributeSQL
  ) => EserviceDescriptorAttributeSchema[K];
};
