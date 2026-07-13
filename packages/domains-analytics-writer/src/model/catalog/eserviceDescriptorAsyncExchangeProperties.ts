import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorAsyncExchangePropertiesInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorAsyncExchangePropertiesSchema =
  createSelectSchema(
    eserviceDescriptorAsyncExchangePropertiesInReadmodelCatalog
  ).extend({
    deleted: z.boolean().default(false).optional(),
  });
export type EserviceDescriptorAsyncExchangePropertiesSchema = z.infer<
  typeof EserviceDescriptorAsyncExchangePropertiesSchema
>;
