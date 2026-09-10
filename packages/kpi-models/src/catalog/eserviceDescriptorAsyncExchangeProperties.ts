import { createSelectSchema } from "drizzle-zod";
import { eserviceDescriptorAsyncExchangePropertiesInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorAsyncExchangePropertiesSchema =
  createSelectSchema(
    eserviceDescriptorAsyncExchangePropertiesInReadmodelCatalog
  ).extend({
    deleted: z.boolean().default(false).optional(),
  });
export type EserviceDescriptorAsyncExchangePropertiesSchema = z.infer<
  typeof EserviceDescriptorAsyncExchangePropertiesSchema
>;
