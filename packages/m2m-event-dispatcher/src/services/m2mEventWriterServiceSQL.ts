import {
  eserviceInM2MEvent,
  agreementInM2MEvent,
  purposeInM2MEvent,
  tenantInM2MEvent,
  attributeInM2MEvent,
  consumerDelegationInM2MEvent,
  producerDelegationInM2MEvent,
  clientInM2MEvent,
  keyInM2MEvent,
  producerKeyInM2MEvent,
  eserviceTemplateInM2MEvent,
  producerKeychainInM2MEvent,
  AttributeM2MEventSQL,
  EServiceM2MEventSQL,
  AgreementM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventWriterServiceSQLBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  return {
    async insertEServiceM2MEvent(event: EServiceM2MEventSQL): Promise<void> {
      await m2mEventDB.insert(eserviceInM2MEvent).values(event);
    },
    async insertAgreementM2MEvent(
      agreement: AgreementM2MEventSQL
    ): Promise<void> {
      await m2mEventDB.insert(agreementInM2MEvent).values(agreement);
    },
    async insertPurposeM2MEvent(): Promise<void> {
      await m2mEventDB.insert(purposeInM2MEvent).values([]);
    },
    async insertKeyM2MEvent(): Promise<void> {
      await m2mEventDB.insert(keyInM2MEvent).values([]);
    },
    async insertProducerKeyM2MEvent(): Promise<void> {
      await m2mEventDB.insert(producerKeyInM2MEvent).values([]);
    },
    async insertConsumerDelegationM2MEvent(): Promise<void> {
      await m2mEventDB.insert(consumerDelegationInM2MEvent).values([]);
    },
    async insertProducerDelegationM2MEvent(): Promise<void> {
      await m2mEventDB.insert(producerDelegationInM2MEvent).values([]);
    },
    async insertEServiceTemplateM2MEvent(): Promise<void> {
      await m2mEventDB.insert(eserviceTemplateInM2MEvent).values([]);
    },
    async insertClientM2MEvent(): Promise<void> {
      await m2mEventDB.insert(clientInM2MEvent).values([]);
    },
    async insertProducerKeychainM2MEvent(): Promise<void> {
      await m2mEventDB.insert(producerKeychainInM2MEvent).values([]);
    },
    async insertTenantM2MEvent(): Promise<void> {
      await m2mEventDB.insert(tenantInM2MEvent).values([]);
    },
    async insertAttributeM2MEvent(event: AttributeM2MEventSQL): Promise<void> {
      await m2mEventDB.insert(attributeInM2MEvent).values(event);
    },
  };
}

export type M2MEventWriterServiceSQL = ReturnType<
  typeof m2mEventWriterServiceSQLBuilder
>;
