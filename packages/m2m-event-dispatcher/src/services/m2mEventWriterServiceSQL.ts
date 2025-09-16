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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventWriterServiceSQLBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  return {
    async insertEServiceM2MEvent(): Promise<void> {
      await m2mEventDB.insert(eserviceM2MEventInM2MEvent).values([]);
    },
    async insertAgreementM2MEvent(): Promise<void> {
      await m2mEventDB.insert(agreementM2MEventInM2MEvent).values([]);
    },
    async insertPurposeM2MEvent(): Promise<void> {
      await m2mEventDB.insert(purposeM2MEventInM2MEvent).values([]);
    },
    async insertKeyM2MEvent(): Promise<void> {
      await m2mEventDB.insert(keyM2MEventInM2MEvent).values([]);
    },
    async insertProducerKeyM2MEvent(): Promise<void> {
      await m2mEventDB.insert(producerKeyM2MEventInM2MEvent).values([]);
    },
    async insertConsumerDelegationM2MEvent(): Promise<void> {
      await m2mEventDB.insert(consumerDelegationM2MEventInM2MEvent).values([]);
    },
    async insertProducerDelegationM2MEvent(): Promise<void> {
      await m2mEventDB.insert(producerDelegationM2MEventInM2MEvent).values([]);
    },
    async insertEServiceTemplateM2MEvent(): Promise<void> {
      await m2mEventDB.insert(eserviceTemplateM2MEventInM2MEvent).values([]);
    },
    async insertClientM2MEvent(): Promise<void> {
      await m2mEventDB.insert(clientM2MEventInM2MEvent).values([]);
    },
    async insertProducerKeychainM2MEvent(): Promise<void> {
      await m2mEventDB.insert(producerKeychainM2MEventInM2MEvent).values([]);
    },
    async insertTenantM2MEvent(): Promise<void> {
      await m2mEventDB.insert(tenantM2MEventInM2MEvent).values([]);
    },
    async insertAttributeM2MEvent(event: AttributeM2MEventSQL): Promise<void> {
      await m2mEventDB.insert(attributeM2MEventInM2MEvent).values(event);
    },
  };
}

export type M2MEventWriterServiceSQL = ReturnType<
  typeof m2mEventWriterServiceSQLBuilder
>;
