import {
  AppContext,
  M2MAdminAuthData,
  M2MAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  AgreementM2MEvent,
  AgreementM2MEventId,
  AttributeM2MEvent,
  AttributeM2MEventId,
  EServiceM2MEvent,
  EServiceM2MEventId,
  PurposeM2MEvent,
  PurposeM2MEventId,
  ConsumerDelegationM2MEvent,
  DelegationM2MEventId,
  ProducerDelegationM2MEvent,
  KeyM2MEvent,
  KeyM2MEventId,
} from "pagopa-interop-models";
import { DelegationIdParam } from "../model/types.js";
import { M2MEventReaderServiceSQL } from "./m2mEventReaderServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventServiceBuilder(
  m2mEventReaderService: M2MEventReaderServiceSQL
) {
  return {
    async getEServiceM2MEvents(
      lastEventId: EServiceM2MEventId | undefined,
      limit: number,
      delegationId: DelegationIdParam,
      {
        logger,
        authData,
      }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<EServiceM2MEvent[]> {
      logger.info(
        `Getting e-service M2M events with lastEventId=${lastEventId}, limit=${limit}, delegationId=${delegationId}`
      );
      return m2mEventReaderService.getEServiceM2MEvents(
        lastEventId,
        limit,
        delegationId,
        authData.organizationId
      );
    },
    async getAgreementM2MEvents(
      lastEventId: AgreementM2MEventId | undefined,
      limit: number,
      delegationId: DelegationIdParam,
      {
        logger,
        authData,
      }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<AgreementM2MEvent[]> {
      logger.info(
        `Getting agreement M2M events with lastEventId=${lastEventId}, limit=${limit}, delegationId=${delegationId}`
      );
      return m2mEventReaderService.getAgreementM2MEvents(
        lastEventId,
        limit,
        delegationId,
        authData.organizationId
      );
    },
    async getPurposeM2MEvents(
      lastEventId: PurposeM2MEventId | undefined,
      limit: number,
      delegationId: DelegationIdParam,
      {
        logger,
        authData,
      }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<PurposeM2MEvent[]> {
      logger.info(
        `Getting purpose M2M events with lastEventId=${lastEventId}, limit=${limit}, delegationId=${delegationId}`
      );
      return m2mEventReaderService.getPurposeM2MEvents(
        lastEventId,
        limit,
        delegationId,
        authData.organizationId
      );
    },
    async getTenantM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getAttributeM2MEvents(
      lastEventId: AttributeM2MEventId | undefined,
      limit: number,
      { logger }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<AttributeM2MEvent[]> {
      logger.info(
        `Getting attribute M2M events with lastEventId=${lastEventId}, limit=${limit}`
      );
      return m2mEventReaderService.getAttributeM2MEvents(lastEventId, limit);
    },
    async getConsumerDelegationM2MEvents(
      lastEventId: DelegationM2MEventId | undefined,
      limit: number,
      { logger }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<ConsumerDelegationM2MEvent[]> {
      logger.info(
        `Getting consumer delegation M2M events with lastEventId=${lastEventId}, limit=${limit}`
      );
      return m2mEventReaderService.getConsumerDelegationM2MEvents(
        lastEventId,
        limit
      );
    },
    async getProducerDelegationM2MEvents(
      lastEventId: DelegationM2MEventId | undefined,
      limit: number,
      { logger }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<ProducerDelegationM2MEvent[]> {
      logger.info(
        `Getting producer delegation M2M events with lastEventId=${lastEventId}, limit=${limit}`
      );
      return m2mEventReaderService.getProducerDelegationM2MEvents(
        lastEventId,
        limit
      );
    },
    async getClientM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getProducerKeychainM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getKeyM2MEvents(
      lastEventId: KeyM2MEventId | undefined,
      limit: number,
      { logger }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<KeyM2MEvent[]> {
      logger.info(
        `Getting key M2M events with lastEventId=${lastEventId}, limit=${limit}`
      );
      return m2mEventReaderService.getKeyM2MEvents(lastEventId, limit);
    },
    async getProducerKeyM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getEServiceTemplateM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
  };
}

export type M2MEventService = ReturnType<typeof m2mEventServiceBuilder>;
