import {
  eserviceInM2MEvent,
  agreementInM2MEvent,
  purposeInM2MEvent,
  tenantInM2MEvent,
  attributeInM2MEvent,
  consumerDelegationInM2MEvent,
  producerDelegationInM2MEvent,
  clientInM2MEvent,
  producerKeychainInM2MEvent,
  keyInM2MEvent,
  producerKeyInM2MEvent,
  eserviceTemplateInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TODO_Type = any;
function TODO_Converter(input: TODO_Type): TODO_Type {
  return input;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventServiceBuilderSQL(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  return {
    async insertEServiceM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB.insert(eserviceInM2MEvent).values(TODO_Converter(event));
    },
    async insertAgreementM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(agreementInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertPurposeM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB.insert(purposeInM2MEvent).values(TODO_Converter(event));
    },
    async insertKeyM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB.insert(keyInM2MEvent).values(TODO_Converter(event));
    },
    async insertProducerKeyM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(producerKeyInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertConsumerDelegationM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(consumerDelegationInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertProducerDelegationM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(producerDelegationInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertEServiceTemplateM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(eserviceTemplateInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertClientM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB.insert(clientInM2MEvent).values(TODO_Converter(event));
    },
    async insertProducerKeychainM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(producerKeychainInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertTenantM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB.insert(tenantInM2MEvent).values(TODO_Converter(event));
    },
    async insertAttributeM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(attributeInM2MEvent)
        .values(TODO_Converter(event));
    },
  };
}

export type M2MEventServiceSQL = ReturnType<typeof m2mEventServiceBuilderSQL>;
