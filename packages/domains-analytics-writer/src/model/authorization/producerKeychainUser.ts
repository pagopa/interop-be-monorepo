import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { producerKeychainUserInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";

export const ProducerKeychainUserSchema = createSelectSchema(
  producerKeychainUserInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainUserSchema = z.infer<
  typeof ProducerKeychainUserSchema
>;

export const ProducerKeychainUserDeletingSchema =
  ProducerKeychainUserSchema.pick({
    producerKeychainId: true,
    userId: true,
    deleted: true,
  });
export type ProducerKeychainUserDeletingSchema = z.infer<
  typeof ProducerKeychainUserDeletingSchema
>;
