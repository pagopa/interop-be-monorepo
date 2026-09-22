import { createSelectSchema } from "drizzle-zod";
import { producerKeychainEserviceInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ProducerKeychainEServiceSchema = createSelectSchema(
  producerKeychainEserviceInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainEServiceSchema = z.infer<
  typeof ProducerKeychainEServiceSchema
>;
