import { createSelectSchema } from "drizzle-zod";
import { producerKeychainKeyInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ProducerKeychainKeySchema = createSelectSchema(
  producerKeychainKeyInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainKeySchema = z.infer<
  typeof ProducerKeychainKeySchema
>;
