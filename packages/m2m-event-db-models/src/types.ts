import { InferSelectModel } from "drizzle-orm";
import {
  agreementInM2MEvent,
  attributeInM2MEvent,
  clientInM2MEvent,
  consumerDelegationInM2MEvent,
  eserviceInM2MEvent,
  eserviceTemplateInM2MEvent,
  keyInM2MEvent,
  producerDelegationInM2MEvent,
  producerKeyInM2MEvent,
  producerKeychainInM2MEvent,
  purposeInM2MEvent,
  tenantInM2MEvent,
  purposeTemplateInM2MEvent,
} from "./drizzle/schema.js";

export type EServiceM2MEventSQL = InferSelectModel<typeof eserviceInM2MEvent>;
export type EServiceTemplateM2MEventSQL = InferSelectModel<
  typeof eserviceTemplateInM2MEvent
>;
export type AgreementM2MEventSQL = InferSelectModel<typeof agreementInM2MEvent>;
export type PurposeM2MEventSQL = InferSelectModel<typeof purposeInM2MEvent>;
export type TenantM2MEventSQL = InferSelectModel<typeof tenantInM2MEvent>;
export type AttributeM2MEventSQL = InferSelectModel<typeof attributeInM2MEvent>;
export type ConsumerDelegationM2MEventSQL = InferSelectModel<
  typeof consumerDelegationInM2MEvent
>;
export type ProducerDelegationM2MEventSQL = InferSelectModel<
  typeof producerDelegationInM2MEvent
>;
export type ClientM2MEventSQL = InferSelectModel<typeof clientInM2MEvent>;
export type ProducerKeychainM2MEventSQL = InferSelectModel<
  typeof producerKeychainInM2MEvent
>;
export type KeyM2MEventSQL = InferSelectModel<typeof keyInM2MEvent>;
export type ProducerKeyM2MEventSQL = InferSelectModel<
  typeof producerKeyInM2MEvent
>;
export type PurposeTemplateM2MEventSQL = InferSelectModel<
  typeof purposeTemplateInM2MEvent
>;
