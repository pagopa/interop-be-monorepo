import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { producerKeychainInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";

export const ProducerKeychainSchema = createSelectSchema(
  producerKeychainInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainSchema = z.infer<typeof ProducerKeychainSchema>;
