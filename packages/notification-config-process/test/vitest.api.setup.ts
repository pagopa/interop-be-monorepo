import { vi } from "vitest";
import { FastifyReply, FastifyRequest } from "fastify";

vi.mock("pagopa-interop-application-audit", async () => ({
  fastifyApplicationAuditBeginHook: vi.fn(
    async () => async (_request: FastifyRequest, _reply: FastifyReply) =>
      Promise.resolve()
  ),
  fastifyApplicationAuditEndHook: vi.fn(
    async () => async (_request: FastifyRequest, _reply: FastifyReply) =>
      Promise.resolve()
  ),
}));

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual<typeof import("pagopa-interop-commons")>(
    "pagopa-interop-commons"
  );
  return {
    ...actual,
    fastifyAuthenticationHook: vi.fn(
      () =>
        async (request: FastifyRequest): Promise<void> => {
          try {
            const jwtToken = jwtFromAuthHeader(
              { headers: request.headers } as Parameters<
                typeof jwtFromAuthHeader
              >[0],
              genericLogger
            );
            const decoded = decodeJwtToken(jwtToken, genericLogger);
            const ctx = request.ctx || {};
            // eslint-disable-next-line functional/immutable-data
            ctx.authData = readAuthDataFromJwtToken(
              decoded ??
                (() => {
                  throw new Error(
                    "JWT decoding failed: 'decoded' is null or undefined."
                  );
                })()
            );
          } catch {
            // swallow in test
          }
        }
    ),
  };
});

import {
  jwtFromAuthHeader,
  genericLogger,
  readAuthDataFromJwtToken,
  decodeJwtToken,
} from "pagopa-interop-commons";
import { createApp } from "../src/app.js";
import { NotificationConfigService } from "../src/services/notificationConfigService.js";

export const notificationConfigService = {} as NotificationConfigService;

const app = await createApp(notificationConfigService);
await app.ready();

export { app };
