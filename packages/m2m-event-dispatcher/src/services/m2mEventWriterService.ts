import {
  eserviceM2MEventInM2MEvent,
  agreementM2MEventInM2MEvent,
  purposeM2MEventInM2MEvent,
  tenantM2MEventInM2MEvent,
  attributeM2MEventInM2MEvent,
  consumerDelegationM2MEventInM2MEvent,
  producerDelegationM2MEventInM2MEvent,
  clientM2MEventInM2MEvent,
  keyM2MEventInM2MEvent,
  producerKeyM2MEventInM2MEvent,
  eserviceTemplateM2MEventInM2MEvent,
  producerKeychainM2MEventInM2MEvent,
  AttributeM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TODO_Type = any;
function TODO_Converter(input: TODO_Type): TODO_Type {
  return input;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventWriterServiceBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  return {
    async insertEServiceM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(eserviceM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertAgreementM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(agreementM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertPurposeM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(purposeM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertKeyM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(keyM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertProducerKeyM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(producerKeyM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertConsumerDelegationM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(consumerDelegationM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertProducerDelegationM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(producerDelegationM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertEServiceTemplateM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(eserviceTemplateM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertClientM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(clientM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertProducerKeychainM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(producerKeychainM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertTenantM2MEvent(event: TODO_Type): Promise<void> {
      await m2mEventDB
        .insert(tenantM2MEventInM2MEvent)
        .values(TODO_Converter(event));
    },
    async insertAttributeM2MEvent(event: AttributeM2MEventSQL): Promise<void> {
      await m2mEventDB.insert(attributeM2MEventInM2MEvent).values(event);
    },
  };
}

export type M2MEventWriterService = ReturnType<
  typeof m2mEventWriterServiceBuilder
>;
