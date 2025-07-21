import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { producerKeychainKeyInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";

export const ProducerKeychainKeySchema = createSelectSchema(
  producerKeychainKeyInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainKeySchema = z.infer<
  typeof ProducerKeychainKeySchema
>;
