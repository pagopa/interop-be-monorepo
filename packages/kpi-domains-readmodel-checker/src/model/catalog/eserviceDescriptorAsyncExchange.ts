import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorAsyncExchangeInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorAsyncExchangeSchema = createSelectSchema(
  eserviceDescriptorAsyncExchangeInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorAsyncExchangeSchema = z.infer<
  typeof EserviceDescriptorAsyncExchangeSchema
>;
