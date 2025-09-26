import {
  AppContext,
  M2MAdminAuthData,
  M2MAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { AttributeM2MEvent, AttributeM2MEventId } from "pagopa-interop-models";
import { M2MEventReaderServiceSQL } from "./m2mEventReaderServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventServiceBuilder(
  m2mEventReaderServiceBuilder: M2MEventReaderServiceSQL
) {
  return {
    async getEServiceM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getAgreementM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getPurposeM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
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
      return m2mEventReaderServiceBuilder.getAttributeM2MEvents(
        lastEventId,
        limit
      );
    },
    async getConsumerDelegationM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getProducerDelegationM2MEvents(
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
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
      _lastEventId: string | undefined,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
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
