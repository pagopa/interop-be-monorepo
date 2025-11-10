import { randomInt } from "crypto";
import { desc } from "drizzle-orm";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  agreementInM2MEvent,
  attributeInM2MEvent,
  consumerDelegationInM2MEvent,
  eserviceInM2MEvent,
  producerDelegationInM2MEvent,
  purposeInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { afterEach, inject } from "vitest";
import {
  AgreementM2MEvent,
  AttributeM2MEvent,
  Delegation,
  DelegationM2MEvent,
  EService,
  EServiceM2MEvent,
  PurposeM2MEvent,
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
  return (await retrieveAllAttributeM2MEvents())[0];
}

export async function retrieveAllAttributeM2MEvents(): Promise<
  AttributeM2MEvent[]
> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(attributeInM2MEvent)
    .orderBy(desc(attributeInM2MEvent.id));

  return sqlEvents.map((e) => AttributeM2MEvent.parse(e));
}

export async function retrieveLastEServiceM2MEvent(): Promise<EServiceM2MEvent> {
  return (await retrieveAllEServiceM2MEvents())[0];
}

export async function retrieveAllEServiceM2MEvents(): Promise<
  EServiceM2MEvent[]
> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(eserviceInM2MEvent)
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
  return (await retrieveAllAgreementM2MEvents())[0];
}

export async function retrieveAllAgreementM2MEvents(): Promise<
  AgreementM2MEvent[]
> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(agreementInM2MEvent)
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

export async function retrieveAllPurposeM2MEvents(): Promise<
  PurposeM2MEvent[]
> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(purposeInM2MEvent)
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
  return (await retrieveAllPurposeM2MEvents())[0];
}

export async function retrieveAllConsumerDelegationM2MEvents(): Promise<
  DelegationM2MEvent[]
> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(consumerDelegationInM2MEvent)
    .orderBy(desc(consumerDelegationInM2MEvent.id));

  return sqlEvents.map((e) => DelegationM2MEvent.parse(e));
}

export async function retrieveLastConsumerDelegationM2MEvent(): Promise<DelegationM2MEvent> {
  return (await retrieveAllConsumerDelegationM2MEvents())[0];
}

export async function retrieveAllProducerDelegationM2MEvents(): Promise<
  DelegationM2MEvent[]
> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(producerDelegationInM2MEvent)
    .orderBy(desc(producerDelegationInM2MEvent.id));

  return sqlEvents.map((e) => DelegationM2MEvent.parse(e));
}

export async function retrieveLastProducerDelegationM2MEvent(): Promise<DelegationM2MEvent> {
  return (await retrieveAllProducerDelegationM2MEvents())[0];
}
