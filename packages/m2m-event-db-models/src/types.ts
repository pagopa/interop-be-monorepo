import { InferSelectModel } from "drizzle-orm";
import {
  agreementM2MEventInM2MEvent,
  attributeM2MEventInM2MEvent,
  clientM2MEventInM2MEvent,
  consumerDelegationM2MEventInM2MEvent,
  eserviceM2MEventInM2MEvent,
  eserviceTemplateM2MEventInM2MEvent,
  keyM2MEventInM2MEvent,
  producerDelegationM2MEventInM2MEvent,
  producerKeyM2MEventInM2MEvent,
  producerKeychainM2MEventInM2MEvent,
  purposeM2MEventInM2MEvent,
  tenantM2MEventInM2MEvent,
} from "./drizzle/schema.js";

export type EServiceM2MEventSQL = InferSelectModel<
  typeof eserviceM2MEventInM2MEvent
>;
export type EServiceTemplateM2MEventSQL = InferSelectModel<
  typeof eserviceTemplateM2MEventInM2MEvent
>;
export type AgreementM2MEventSQL = InferSelectModel<
  typeof agreementM2MEventInM2MEvent
>;
export type PurposeM2MEventSQL = InferSelectModel<
  typeof purposeM2MEventInM2MEvent
>;
export type TenantM2MEventSQL = InferSelectModel<
  typeof tenantM2MEventInM2MEvent
>;
export type AttributeM2MEventSQL = InferSelectModel<
  typeof attributeM2MEventInM2MEvent
>;
export type ConsumerDelegationM2MEventSQL = InferSelectModel<
  typeof consumerDelegationM2MEventInM2MEvent
>;
export type ProducerDelegationM2MEventSQL = InferSelectModel<
  typeof producerDelegationM2MEventInM2MEvent
>;
export type ClientM2MEventSQL = InferSelectModel<
  typeof clientM2MEventInM2MEvent
>;
export type ProducerKeychaM2MEventinM2MEventSQL = InferSelectModel<
  typeof producerKeychainM2MEventInM2MEvent
>;
export type KeyM2MEventSQL = InferSelectModel<typeof keyM2MEventInM2MEvent>;
export type ProducerKeyM2MEventSQL = InferSelectModel<
  typeof producerKeyM2MEventInM2MEvent
>;
