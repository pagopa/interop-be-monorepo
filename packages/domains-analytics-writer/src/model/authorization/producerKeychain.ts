import { z } from "zod";
import { ProducerKeychainSchema } from "pagopa-interop-kpi-models";

export const ProducerKeychainDeletingSchema = ProducerKeychainSchema.pick({
  id: true,
  deleted: true,
});
export type ProducerKeychainDeletingSchema = z.infer<
  typeof ProducerKeychainDeletingSchema
>;
