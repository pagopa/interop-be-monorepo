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
