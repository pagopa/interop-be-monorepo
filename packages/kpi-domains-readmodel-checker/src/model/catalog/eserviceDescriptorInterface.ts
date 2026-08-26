import { createSelectSchema } from "drizzle-zod";
import { eserviceDescriptorInterfaceInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorInterfaceSchema = createSelectSchema(
  eserviceDescriptorInterfaceInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorInterfaceSchema = z.infer<
  typeof EserviceDescriptorInterfaceSchema
>;
