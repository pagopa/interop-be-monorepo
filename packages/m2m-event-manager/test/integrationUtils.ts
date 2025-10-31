import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  AgreementM2MEvent,
  AttributeM2MEvent,
  EServiceM2MEvent,
  dateToString,
} from "pagopa-interop-models";
import {
  agreementInM2MEvent,
  attributeInM2MEvent,
  eserviceInM2MEvent,
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

export async function writeAttributeM2MEvent(
  event: AttributeM2MEvent
): Promise<void> {
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
