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
  ClientM2MEventSQL,
  ProducerKeychainM2MEventSQL,
  ProducerKeyM2MEventSQL,
  KeyM2MEventSQL,
  TenantM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { SQL, eq, and } from "drizzle-orm";
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
      | EServiceTemplateM2MEventSQL
      | ClientM2MEventSQL
      | ProducerKeychainM2MEventSQL
      | ProducerKeyM2MEventSQL
      | KeyM2MEventSQL
      | TenantM2MEventSQL,
    table:
      | typeof eserviceInM2MEvent
      | typeof agreementInM2MEvent
      | typeof attributeInM2MEvent
      | typeof purposeInM2MEvent
      | typeof consumerDelegationInM2MEvent
      | typeof producerDelegationInM2MEvent
      | typeof eserviceTemplateInM2MEvent
      | typeof clientInM2MEvent
      | typeof producerKeychainInM2MEvent
      | typeof producerKeyInM2MEvent
      | typeof keyInM2MEvent
      | typeof tenantInM2MEvent,
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
    async insertKeyM2MEvent(event: KeyM2MEventSQL): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        keyInM2MEvent,
        and(
          eq(keyInM2MEvent.kid, event.kid),
          eq(keyInM2MEvent.clientId, event.clientId)
        )
      );
    },
    async insertProducerKeyM2MEvent(
      event: ProducerKeyM2MEventSQL
    ): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        producerKeyInM2MEvent,
        and(
          eq(producerKeyInM2MEvent.kid, event.kid),
          eq(producerKeyInM2MEvent.producerKeychainId, event.producerKeychainId)
        )
      );
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
        eq(
          eserviceTemplateInM2MEvent.eserviceTemplateId,
          event.eserviceTemplateId
        )
      );
    },
    async insertClientM2MEvent(event: ClientM2MEventSQL): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        clientInM2MEvent,
        eq(clientInM2MEvent.clientId, event.clientId)
      );
    },
    async insertProducerKeychainM2MEvent(
      event: ProducerKeychainM2MEventSQL
    ): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        producerKeychainInM2MEvent,
        eq(
          producerKeychainInM2MEvent.producerKeychainId,
          event.producerKeychainId
        )
      );
    },
    async insertTenantM2MEvent(event: TenantM2MEventSQL): Promise<void> {
      await insertIfResourceVersionNotPresent(
        event,
        tenantInM2MEvent,
        eq(tenantInM2MEvent.tenantId, event.tenantId)
      );
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
