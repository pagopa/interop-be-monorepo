import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  AgreementM2MEvent,
  AttributeM2MEvent,
  ConsumerDelegationM2MEvent,
  ClientM2MEvent,
  EServiceM2MEvent,
  PurposeM2MEvent,
  ProducerDelegationM2MEvent,
  KeyM2MEvent,
  ProducerKeyM2MEvent,
  ProducerKeychainM2MEvent,
  TenantM2MEvent,
  dateToString,
} from "pagopa-interop-models";
import {
  agreementInM2MEvent,
  attributeInM2MEvent,
  consumerDelegationInM2MEvent,
  clientInM2MEvent,
  eserviceInM2MEvent,
  purposeInM2MEvent,
  producerDelegationInM2MEvent,
  keyInM2MEvent,
  producerKeychainInM2MEvent,
  producerKeyInM2MEvent,
  tenantInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { m2mEventServiceBuilder } from "../src/services/m2mEventService.js";
import { m2mEventReaderServiceSQLBuilder } from "../src/services/m2mEventReaderServiceSQL.js";

export const { cleanup, m2mEventDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("m2mEventDbConfig")
);

afterEach(cleanup);

const m2mEventReaderServiceSQL = m2mEventReaderServiceSQLBuilder(m2mEventDB);
export const m2mEventService = m2mEventServiceBuilder(m2mEventReaderServiceSQL);

export async function writeAttributeM2MEvent(event: AttributeM2MEvent): Promise<void> {
  await m2mEventDB.insert(attributeInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}

export async function writeEServiceM2MEvent(event: EServiceM2MEvent) {
  await m2mEventDB.insert(eserviceInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
      descriptorId: event.descriptorId ?? null,
      producerDelegateId: event.producerDelegateId ?? null,
      producerDelegationId: event.producerDelegationId ?? null,
    },
  ]);
}

export async function writeAgreementM2MEvent(event: AgreementM2MEvent) {
  await m2mEventDB.insert(agreementInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
      consumerDelegateId: event.consumerDelegateId ?? null,
      consumerDelegationId: event.consumerDelegationId ?? null,
      producerDelegateId: event.producerDelegateId ?? null,
      producerDelegationId: event.producerDelegationId ?? null,
    },
  ]);
}

export async function writePurposeM2MEvent(event: PurposeM2MEvent) {
  await m2mEventDB.insert(purposeInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
      purposeVersionId: event.purposeVersionId ?? null,
      consumerDelegateId: event.consumerDelegateId ?? null,
      consumerDelegationId: event.consumerDelegationId ?? null,
      producerDelegateId: event.producerDelegateId ?? null,
      producerDelegationId: event.producerDelegationId ?? null,
    },
  ]);
}

export async function writeProducerDelegationM2MEvent(event: ProducerDelegationM2MEvent): Promise<void> {
  await m2mEventDB.insert(producerDelegationInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}

export async function writeConsumerDelegationM2MEvent(event: ConsumerDelegationM2MEvent): Promise<void> {
  await m2mEventDB.insert(consumerDelegationInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}

export async function writeKeyM2MEvent(event: KeyM2MEvent): Promise<void> {
  await m2mEventDB.insert(keyInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}

export async function writeProducerKeyM2MEvent(event: ProducerKeyM2MEvent): Promise<void> {
  await m2mEventDB.insert(producerKeyInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}

export async function writeClientM2MEvent(event: ClientM2MEvent): Promise<void> {
  await m2mEventDB.insert(clientInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}

export async function writeProducerKeychainM2MEvent(event: ProducerKeychainM2MEvent): Promise<void> {
  await m2mEventDB.insert(producerKeychainInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}

export async function writeTenantM2MEvent(event: TenantM2MEvent): Promise<void> {
  await m2mEventDB.insert(tenantInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}
