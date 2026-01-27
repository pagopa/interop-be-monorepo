import { randomInt } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
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
  purposeTemplateInM2MEvent,
  tenantInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { afterEach, inject } from "vitest";
import {
  AgreementM2MEvent,
  AttributeM2MEvent,
  ClientM2MEvent,
  ConsumerDelegationM2MEvent,
  Delegation,
  EService,
  EServiceM2MEvent,
  EServiceTemplateM2MEvent,
  KeyM2MEvent,
  ProducerDelegationM2MEvent,
  ProducerKeyM2MEvent,
  ProducerKeychainM2MEvent,
  PurposeM2MEvent,
  PurposeTemplateM2MEvent,
  TenantM2MEvent,
} from "pagopa-interop-models";
import {
  delegationReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertDelegation,
  upsertEService,
} from "pagopa-interop-readmodel/testUtils";
import { m2mEventWriterServiceSQLBuilder } from "../src/services/m2mEventWriterServiceSQL.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, readModelDB, m2mEventDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig"),
    undefined,
    undefined,
    inject("m2mEventDbConfig")
  );

afterEach(cleanup);

export const testM2mEventWriterService =
  m2mEventWriterServiceSQLBuilder(m2mEventDB);

export const testReadModelService = readModelServiceBuilderSQL({
  delegationReadModelServiceSQL: delegationReadModelServiceBuilder(readModelDB),
  catalogReadModelServiceSQL: catalogReadModelServiceBuilder(readModelDB),
});

export const getMockEventEnvelopeCommons = () => ({
  sequence_num: 1,
  version: randomInt(1, 1000),
  event_version: 2,
  log_date: new Date(),
});

export const addOneDelegationToReadModel = async (
  delegation: Delegation
): Promise<void> => {
  await upsertDelegation(readModelDB, delegation, 0);
};

export const addOneEServiceToReadModel = async (
  eservice: EService
): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export async function retrieveLastAttributeM2MEvent(): Promise<AttributeM2MEvent> {
  return (await retrieveAllAttributeM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllAttributeM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<AttributeM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(attributeInM2MEvent)
    .limit(limit)
    .orderBy(desc(attributeInM2MEvent.id));

  return sqlEvents.map((e) => AttributeM2MEvent.parse(e));
}

export async function retrieveEServiceM2MEventByEServiceIdAndDescriptorId(
  eserviceId: string,
  descriptorId: string | undefined
): Promise<EServiceM2MEvent | undefined> {
  const conditions = [eq(eserviceInM2MEvent.eserviceId, eserviceId)];

  if (descriptorId === undefined) {
    conditions.push(isNull(eserviceInM2MEvent.descriptorId));
  } else {
    conditions.push(eq(eserviceInM2MEvent.descriptorId, descriptorId));
  }

  const sqlEvents = await m2mEventDB
    .select()
    .from(eserviceInM2MEvent)
    .where(and(...conditions))
    .orderBy(desc(eserviceInM2MEvent.id))
    .limit(1);

  if (sqlEvents.length === 0) {
    return undefined;
  }

  return EServiceM2MEvent.parse({
    ...sqlEvents[0],
    descriptorId: sqlEvents[0].descriptorId ?? undefined,
    producerDelegationId: sqlEvents[0].producerDelegationId ?? undefined,
    producerDelegateId: sqlEvents[0].producerDelegateId ?? undefined,
  });
}

export async function retrieveAllEServiceM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<EServiceM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(eserviceInM2MEvent)
    .limit(limit)
    .orderBy(desc(eserviceInM2MEvent.id));

  return sqlEvents.map((e) =>
    EServiceM2MEvent.parse({
      ...e,
      descriptorId: e.descriptorId ?? undefined,
      producerDelegationId: e.producerDelegationId ?? undefined,
      producerDelegateId: e.producerDelegateId ?? undefined,
    })
  );
}

export async function retrieveLastAgreementM2MEvent(): Promise<AgreementM2MEvent> {
  return (await retrieveAllAgreementM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllAgreementM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<AgreementM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(agreementInM2MEvent)
    .limit(limit)
    .orderBy(desc(agreementInM2MEvent.id));

  return sqlEvents.map((e) =>
    AgreementM2MEvent.parse({
      ...e,
      consumerDelegationId: e.consumerDelegationId ?? undefined,
      consumerDelegateId: e.consumerDelegateId ?? undefined,
      producerDelegationId: e.producerDelegationId ?? undefined,
      producerDelegateId: e.producerDelegateId ?? undefined,
    })
  );
}

export async function retrieveAllPurposeM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<PurposeM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(purposeInM2MEvent)
    .limit(limit)
    .orderBy(desc(purposeInM2MEvent.id));

  return sqlEvents.map((e) =>
    PurposeM2MEvent.parse({
      ...e,
      purposeVersionId: e.purposeVersionId ?? undefined,
      consumerDelegationId: e.consumerDelegationId ?? undefined,
      consumerDelegateId: e.consumerDelegateId ?? undefined,
      producerDelegationId: e.producerDelegationId ?? undefined,
      producerDelegateId: e.producerDelegateId ?? undefined,
    })
  );
}

export async function retrieveLastPurposeM2MEvent(): Promise<PurposeM2MEvent> {
  return (await retrieveAllPurposeM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllConsumerDelegationM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<ConsumerDelegationM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(consumerDelegationInM2MEvent)
    .limit(limit)
    .orderBy(desc(consumerDelegationInM2MEvent.id));

  return sqlEvents.map((e) => ConsumerDelegationM2MEvent.parse(e));
}

export async function retrieveLastConsumerDelegationM2MEvent(): Promise<ConsumerDelegationM2MEvent> {
  return (await retrieveAllConsumerDelegationM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllProducerDelegationM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<ProducerDelegationM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(producerDelegationInM2MEvent)
    .limit(limit)
    .orderBy(desc(producerDelegationInM2MEvent.id));

  return sqlEvents.map((e) => ProducerDelegationM2MEvent.parse(e));
}

export async function retrieveLastProducerDelegationM2MEvent(): Promise<ProducerDelegationM2MEvent> {
  return (await retrieveAllProducerDelegationM2MEvents({ limit: 1 }))[0];
}

export async function retrieveLastEServiceTemplateM2MEvent(): Promise<EServiceTemplateM2MEvent> {
  return (await retrieveAllEServiceTemplateM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllEServiceTemplateM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<EServiceTemplateM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(eserviceTemplateInM2MEvent)
    .limit(limit)
    .orderBy(desc(eserviceTemplateInM2MEvent.id));

  return sqlEvents.map((e) =>
    EServiceTemplateM2MEvent.parse({
      ...e,
      eserviceTemplateVersionId: e.eserviceTemplateVersionId ?? undefined,
    })
  );
}

export async function retrieveLastClientM2MEvent(): Promise<ClientM2MEvent> {
  return (await retrieveAllClientM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllClientM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<ClientM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(clientInM2MEvent)
    .limit(limit)
    .orderBy(desc(clientInM2MEvent.id));

  return sqlEvents.map((e) => ClientM2MEvent.parse(e));
}

export async function retrieveLastKeyM2MEvent(): Promise<KeyM2MEvent> {
  return (await retrieveAllKeyM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllKeyM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<KeyM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(keyInM2MEvent)
    .limit(limit)
    .orderBy(desc(keyInM2MEvent.id));

  return sqlEvents.map((e) => KeyM2MEvent.parse(e));
}

export async function retrieveLastProducerKeyM2MEvent(): Promise<ProducerKeyM2MEvent> {
  return (await retrieveAllProducerKeyM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllProducerKeyM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<ProducerKeyM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(producerKeyInM2MEvent)
    .limit(limit)
    .orderBy(desc(producerKeyInM2MEvent.id));

  return sqlEvents.map((e) => ProducerKeyM2MEvent.parse(e));
}

export async function retrieveLastProducerKeychainM2MEvent(): Promise<ProducerKeychainM2MEvent> {
  return (await retrieveAllProducerKeychainM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllProducerKeychainM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<ProducerKeychainM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(producerKeychainInM2MEvent)
    .limit(limit)
    .orderBy(desc(producerKeychainInM2MEvent.id));

  return sqlEvents.map((e) => ProducerKeychainM2MEvent.parse(e));
}

export async function retrieveLastTenantM2MEvent(): Promise<TenantM2MEvent> {
  return (await retrieveAllTenantM2MEvents({ limit: 1 }))[0];
}

export async function retrieveAllTenantM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<TenantM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(tenantInM2MEvent)
    .limit(limit)
    .orderBy(desc(tenantInM2MEvent.id));

  return sqlEvents.map((e) => TenantM2MEvent.parse(e));
}

export async function retrieveAllPurposeTemplateM2MEvents({
  limit,
}: {
  limit: number;
}): Promise<PurposeTemplateM2MEvent[]> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(purposeTemplateInM2MEvent)
    .limit(limit)
    .orderBy(desc(purposeTemplateInM2MEvent.id));

  return sqlEvents.map((e) => PurposeTemplateM2MEvent.parse(e));
}

export async function retrieveLastPurposeTemplateM2MEvent(): Promise<PurposeTemplateM2MEvent> {
  return (await retrieveAllPurposeTemplateM2MEvents({ limit: 1 }))[0];
}
