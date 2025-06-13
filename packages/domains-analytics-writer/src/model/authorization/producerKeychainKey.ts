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

export const ProducerKeychainKeyDeletingSchema = ProducerKeychainKeySchema.pick(
  {
    producerKeychainId: true,
    kid: true,
    deleted: true,
  }
);
export type ProducerKeychainKeyDeletingSchema = z.infer<
  typeof ProducerKeychainKeyDeletingSchema
>;
