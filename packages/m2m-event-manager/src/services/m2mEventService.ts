import { drizzle } from "drizzle-orm/node-postgres";
import {
  AppContext,
  M2MAdminAuthData,
  M2MAuthData,
  WithLogger,
} from "pagopa-interop-commons";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventServiceBuilder(_db: ReturnType<typeof drizzle>) {
  return {
    async getEServiceM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getAgreementM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getPurposeM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getTenantM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getAttributeM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getConsumerDelegationM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getProducerDelegationM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getClientM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getProducerKeychainM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getKeyM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getProducerKeyM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
    async getEServiceTemplateM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown> {
      return { results: [], pagination: {} };
    },
  };
}

export type M2MEventService = ReturnType<typeof m2mEventServiceBuilder>;
