import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorInterfaceInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorInterfaceSchema = createSelectSchema(
  eserviceDescriptorInterfaceInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorInterfaceSchema = z.infer<
  typeof EserviceDescriptorInterfaceSchema
>;
