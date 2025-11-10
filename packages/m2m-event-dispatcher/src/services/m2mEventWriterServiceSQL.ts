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
  PurposeM2MEventSQL,
  ConsumerDelegationM2MEventSQL,
  ProducerDelegationM2MEventSQL,
  EServiceTemplateM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { SQL, eq } from "drizzle-orm";
import { isResourceVersionPresent } from "../utils/m2mEventSQLUtils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventWriterServiceSQLBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  function insertIfResourceVersionNotPresent(
    event:
      | EServiceM2MEventSQL
      | AgreementM2MEventSQL
      | AttributeM2MEventSQL
      | PurposeM2MEventSQL
      | ConsumerDelegationM2MEventSQL
      | ProducerDelegationM2MEventSQL
      | EServiceTemplateM2MEventSQL,
    table:
      | typeof eserviceInM2MEvent
      | typeof agreementInM2MEvent
      | typeof attributeInM2MEvent
      | typeof purposeInM2MEvent
      | typeof consumerDelegationInM2MEvent
      | typeof producerDelegationInM2MEvent
      | typeof eserviceTemplateInM2MEvent,
    resourceIdFilter: SQL | undefined
  ): Promise<void> {
    return m2mEventDB.transaction(async (tx) => {
      const shouldWrite = !(await isResourceVersionPresent(
        tx,
        event.resourceVersion,
        table,
        resourceIdFilter
      ));

      if (shouldWrite) {
        await tx.insert(table).values(event);
      }
    });
  }

  return {
    async insertEServiceM2MEvent(event: EServiceM2MEventSQL): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        eserviceInM2MEvent,
        eq(eserviceInM2MEvent.eserviceId, event.eserviceId)
      );
    },
    async insertAgreementM2MEvent(event: AgreementM2MEventSQL): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        agreementInM2MEvent,
        eq(agreementInM2MEvent.agreementId, event.agreementId)
      );
    },
    async insertPurposeM2MEvent(event: PurposeM2MEventSQL): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        purposeInM2MEvent,
        eq(purposeInM2MEvent.purposeId, event.purposeId)
      );
    },
    async insertKeyM2MEvent(): Promise<void> {
      await m2mEventDB.insert(keyInM2MEvent).values([]);
    },
    async insertProducerKeyM2MEvent(): Promise<void> {
      await m2mEventDB.insert(producerKeyInM2MEvent).values([]);
    },
    async insertConsumerDelegationM2MEvent(
      event: ConsumerDelegationM2MEventSQL
    ): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        consumerDelegationInM2MEvent,
        eq(consumerDelegationInM2MEvent.delegationId, event.delegationId)
      );
    },
    async insertProducerDelegationM2MEvent(
      event: ProducerDelegationM2MEventSQL
    ): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        producerDelegationInM2MEvent,
        eq(producerDelegationInM2MEvent.delegationId, event.delegationId)
      );
    },
    async insertEServiceTemplateM2MEvent(
      event: EServiceTemplateM2MEventSQL
    ): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        eserviceTemplateInM2MEvent,
        eq(eserviceTemplateInM2MEvent.id, event.eserviceTemplateId)
      );
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
      await insertIfResourceVersionNotPresent(
        event,
        attributeInM2MEvent,
        eq(attributeInM2MEvent.attributeId, event.attributeId)
      );
    },
  };
}

export type M2MEventWriterServiceSQL = ReturnType<
  typeof m2mEventWriterServiceSQLBuilder
>;
