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
    ): Promise<unknown[]> {
      return [];
    },
    async getAgreementM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getPurposeM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getTenantM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getAttributeM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getConsumerDelegationM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getProducerDelegationM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getClientM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getProducerKeychainM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getKeyM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getProducerKeyM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
    async getEServiceTemplateM2MEvents(
      _lastEventId: string,
      _limit: number,
      _ctx: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<unknown[]> {
      return [];
    },
  };
}

export type M2MEventService = ReturnType<typeof m2mEventServiceBuilder>;
