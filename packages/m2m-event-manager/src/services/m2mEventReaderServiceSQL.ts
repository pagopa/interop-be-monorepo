import {
  agreementInM2MEvent,
  attributeInM2MEvent,
  consumerDelegationInM2MEvent,
  eserviceInM2MEvent,
  purposeInM2MEvent,
  producerDelegationInM2MEvent,
  keyInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  AgreementM2MEvent,
  AgreementM2MEventId,
  AttributeM2MEvent,
  AttributeM2MEventId,
  ConsumerDelegationM2MEvent,
  DelegationM2MEventId,
  EServiceM2MEvent,
  EServiceM2MEventId,
  PurposeM2MEvent,
  PurposeM2MEventId,
  ProducerDelegationM2MEvent,
  KeyM2MEvent,
  KeyM2MEventId,
  TenantId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { and, asc, eq, or } from "drizzle-orm";
import {
  afterEventIdFilter,
  delegationIdFilter,
  visibilityFilter,
} from "../utilities/m2mEventSQLUtils.js";
import { fromAttributeM2MEventSQL } from "../model/attributeM2MEventAdapterSQL.js";
import { fromEServiceM2MEventSQL } from "../model/eserviceM2MEventAdapterSQL.js";
import { fromAgreementM2MEventSQL } from "../model/agreementM2MEventAdapterSQL.js";
import { DelegationIdParam } from "../model/types.js";
import { fromPurposeM2MEventSQL } from "../model/purposeM2MEventAdapterSQL.js";
import {
  fromConsumerDelegationM2MEventSQL,
  fromProducerDelegationM2MEventSQL,
} from "../model/delegationM2MEventAdapterSQL.js";
import { fromKeyM2MEventSQL } from "../model/keyM2MEventAdapterSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventReaderServiceSQLBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  /**
   * Event queries in this file MUST order by event ID ascending
   * to ensure user does not miss events.
   *
   * Example (with numerical IDs for simplicity):
   *  - User fetched events up to ID 100.
   *  - 900 more events occurred, latest ID is 1000.
   *  - User requests next events after lastEventId=100, limit=500 (max limit).
   *  - If ordered by descending ID, events from 1000 to 501 would be returned.
   *  - User misses events from 101 to 500, which cannot be fetched again.
   */

  return {
    async getAttributeM2MEvents(
      lastEventId: AttributeM2MEventId | undefined,
      limit: number
    ): Promise<AttributeM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(attributeInM2MEvent)
        .where(afterEventIdFilter(attributeInM2MEvent, lastEventId))
        .orderBy(asc(attributeInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromAttributeM2MEventSQL);
    },

    async getEServiceM2MEvents(
      lastEventId: EServiceM2MEventId | undefined,
      limit: number,
      delegationId: DelegationIdParam,
      requester: TenantId
    ): Promise<EServiceM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(eserviceInM2MEvent)
        .where(
          and(
            afterEventIdFilter(eserviceInM2MEvent, lastEventId),
            visibilityFilter(eserviceInM2MEvent, {
              ownerFilter: or(
                eq(eserviceInM2MEvent.producerId, requester),
                eq(eserviceInM2MEvent.producerDelegateId, requester)
              ),
              restrictedFilter: undefined,
            }),
            delegationIdFilter(eserviceInM2MEvent, delegationId, {
              nullFilter: or(
                eq(eserviceInM2MEvent.visibility, m2mEventVisibility.public),
                eq(eserviceInM2MEvent.producerId, requester)
              ),
            })
          )
        )
        .orderBy(asc(eserviceInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromEServiceM2MEventSQL);
    },

    async getAgreementM2MEvents(
      lastEventId: AgreementM2MEventId | undefined,
      limit: number,
      delegationId: DelegationIdParam,
      requester: TenantId
    ): Promise<AgreementM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(agreementInM2MEvent)
        .where(
          and(
            afterEventIdFilter(agreementInM2MEvent, lastEventId),
            visibilityFilter(agreementInM2MEvent, {
              ownerFilter: or(
                eq(agreementInM2MEvent.consumerId, requester),
                eq(agreementInM2MEvent.consumerDelegateId, requester)
              ),
              restrictedFilter: or(
                eq(agreementInM2MEvent.consumerId, requester),
                eq(agreementInM2MEvent.consumerDelegateId, requester),
                eq(agreementInM2MEvent.producerId, requester),
                eq(agreementInM2MEvent.producerDelegateId, requester)
              ),
            }),
            delegationIdFilter(agreementInM2MEvent, delegationId, {
              nullFilter: or(
                eq(agreementInM2MEvent.producerId, requester),
                eq(agreementInM2MEvent.consumerId, requester)
              ),
            })
          )
        )
        .orderBy(asc(agreementInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromAgreementM2MEventSQL);
    },

    async getPurposeM2MEvents(
      lastEventId: PurposeM2MEventId | undefined,
      limit: number,
      delegationId: DelegationIdParam,
      requester: TenantId
    ): Promise<PurposeM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(purposeInM2MEvent)
        .where(
          and(
            afterEventIdFilter(purposeInM2MEvent, lastEventId),
            visibilityFilter(purposeInM2MEvent, {
              ownerFilter: or(
                eq(purposeInM2MEvent.consumerId, requester),
                eq(purposeInM2MEvent.consumerDelegateId, requester)
              ),
              restrictedFilter: or(
                eq(purposeInM2MEvent.consumerId, requester),
                eq(purposeInM2MEvent.consumerDelegateId, requester),
                eq(purposeInM2MEvent.producerId, requester),
                eq(purposeInM2MEvent.producerDelegateId, requester)
              ),
            }),
            delegationIdFilter(purposeInM2MEvent, delegationId, {
              nullFilter: or(
                eq(purposeInM2MEvent.producerId, requester),
                eq(purposeInM2MEvent.consumerId, requester)
              ),
            })
          )
        )
        .orderBy(asc(purposeInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromPurposeM2MEventSQL);
    },
    async getProducerDelegationM2MEvents(
      lastEventId: DelegationM2MEventId | undefined,
      limit: number
    ): Promise<ProducerDelegationM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(producerDelegationInM2MEvent)
        .where(afterEventIdFilter(producerDelegationInM2MEvent, lastEventId))
        .orderBy(asc(producerDelegationInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromProducerDelegationM2MEventSQL);
    },

    async getConsumerDelegationM2MEvents(
      lastEventId: DelegationM2MEventId | undefined,
      limit: number
    ): Promise<ConsumerDelegationM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(consumerDelegationInM2MEvent)
        .where(afterEventIdFilter(consumerDelegationInM2MEvent, lastEventId))
        .orderBy(asc(consumerDelegationInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromConsumerDelegationM2MEventSQL);
    },
    async getKeyM2MEvents(
      lastEventId: KeyM2MEventId | undefined,
      limit: number
    ): Promise<KeyM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(keyInM2MEvent)
        .where(afterEventIdFilter(keyInM2MEvent, lastEventId))
        .orderBy(asc(keyInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromKeyM2MEventSQL);
    },
  };
}

export type M2MEventReaderServiceSQL = ReturnType<
  typeof m2mEventReaderServiceSQLBuilder
>;
