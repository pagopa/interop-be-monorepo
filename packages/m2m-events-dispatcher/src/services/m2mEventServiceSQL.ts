import {
  eserviceM2MEvent,
  agreementM2MEvent,
  purposeM2MEvent,
  keyM2MEvent,
  producerKeyM2MEvent,
  consumerDelegationM2MEvent,
  producerDelegationM2MEvent,
  eserviceTemplateM2MEvent,
  clientM2MEvent,
  producerKeychainM2MEvent,
  tenantM2MEvent,
  attributeM2MEvent,
} from "pagopa-interop-m2m-events-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  EServiceM2MEvent,
  toEServiceM2MEventSQL,
  AgreementM2MEvent,
  toAgreementM2MEventSQL,
  PurposeM2MEvent,
  toPurposeM2MEventSQL,
  KeyM2MEvent,
  toKeyM2MEventSQL,
  ProducerKeyM2MEvent,
  toProducerKeyM2MEventSQL,
  ConsumerDelegationM2MEvent,
  toConsumerDelegationM2MEventSQL,
  ProducerDelegationM2MEvent,
  toProducerDelegationM2MEventSQL,
  EServiceTemplateM2MEvent,
  toEServiceTemplateM2MEventSQL,
  ClientM2MEvent,
  toClientM2MEventSQL,
  ProducerKeychainM2MEvent,
  toProducerKeychainM2MEventSQL,
  TenantM2MEvent,
  toTenantM2MEventSQL,
  AttributeM2MEvent,
  toAttributeM2MEventSQL,
} from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventServiceBuilderSQL(
  m2mEventsDB: ReturnType<typeof drizzle>
) {
  return {
    async insertEServiceM2MEvent(event: EServiceM2MEvent): Promise<void> {
      await m2mEventsDB
        .insert(eserviceM2MEvent)
        .values(toEServiceM2MEventSQL(event));
    },
    async insertAgreementM2MEvent(event: AgreementM2MEvent): Promise<void> {
      await m2mEventsDB
        .insert(agreementM2MEvent)
        .values(toAgreementM2MEventSQL(event));
    },
    async insertPurposeM2MEvent(event: PurposeM2MEvent): Promise<void> {
      await m2mEventsDB
        .insert(purposeM2MEvent)
        .values(toPurposeM2MEventSQL(event));
    },
    async insertKeyM2MEvent(event: KeyM2MEvent): Promise<void> {
      await m2mEventsDB.insert(keyM2MEvent).values(toKeyM2MEventSQL(event));
    },
    async insertProducerKeyM2MEvent(event: ProducerKeyM2MEvent): Promise<void> {
      await m2mEventsDB
        .insert(producerKeyM2MEvent)
        .values(toProducerKeyM2MEventSQL(event));
    },
    async insertConsumerDelegationM2MEvent(
      event: ConsumerDelegationM2MEvent
    ): Promise<void> {
      await m2mEventsDB
        .insert(consumerDelegationM2MEvent)
        .values(toConsumerDelegationM2MEventSQL(event));
    },
    async insertProducerDelegationM2MEvent(
      event: ProducerDelegationM2MEvent
    ): Promise<void> {
      await m2mEventsDB
        .insert(producerDelegationM2MEvent)
        .values(toProducerDelegationM2MEventSQL(event));
    },
    async insertEServiceTemplateM2MEvent(
      event: EServiceTemplateM2MEvent
    ): Promise<void> {
      await m2mEventsDB
        .insert(eserviceTemplateM2MEvent)
        .values(toEServiceTemplateM2MEventSQL(event));
    },
    async insertClientM2MEvent(event: ClientM2MEvent): Promise<void> {
      await m2mEventsDB
        .insert(clientM2MEvent)
        .values(toClientM2MEventSQL(event));
    },
    async insertProducerKeychainM2MEvent(
      event: ProducerKeychainM2MEvent
    ): Promise<void> {
      await m2mEventsDB
        .insert(producerKeychainM2MEvent)
        .values(toProducerKeychainM2MEventSQL(event));
    },
    async insertTenantM2MEvent(event: TenantM2MEvent): Promise<void> {
      await m2mEventsDB
        .insert(tenantM2MEvent)
        .values(toTenantM2MEventSQL(event));
    },
    async insertAttributeM2MEvent(event: AttributeM2MEvent): Promise<void> {
      await m2mEventsDB
        .insert(attributeM2MEvent)
        .values(toAttributeM2MEventSQL(event));
    },
  };
}

export type M2MEventServiceSQL = ReturnType<typeof m2mEventServiceBuilderSQL>;
