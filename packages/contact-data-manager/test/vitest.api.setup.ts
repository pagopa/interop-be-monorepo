import { Request, Response, NextFunction } from "express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { APIEndpoint, AuthRole, authRole } from "pagopa-interop-commons";
import { createPayload, startJwksServer } from "pagopa-interop-commons-test";
import { afterAll, MockInstance, vi } from "vitest";
import winston from "winston";

vi.mock("pagopa-interop-application-audit", async () => ({
  applicationAuditBeginMiddleware: vi.fn(
    async () => (_req: Request, _res: Response, next: NextFunction) => next()
  ),
  applicationAuditEndMiddleware: vi.fn(
    async () => (_req: Request, _res: Response, next: NextFunction) => next()
  ),
}));

import { createApp } from "../src/app.js";
import { config } from "../src/config/config.js";
import { ContactService } from "../src/services/contactService.js";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const kid = "cdm-test-key";
const jwks = await startJwksServer({
  ...(await exportJWK(publicKey)),
  kid,
  alg: "RS256",
  use: "sig",
});

afterAll(() => jwks.close());

export function createTestApp(
  service: ContactService
): ReturnType<typeof createApp> {
  return createApp(service, {
    ...config,
    wellKnownUrls: [APIEndpoint.parse(jwks.url)],
  });
}

export async function createTestToken(
  role: AuthRole = authRole.INTERNAL_ROLE
): Promise<string> {
  return new SignJWT(createPayload(role))
    .setProtectedHeader({ alg: "RS256", kid })
    .setAudience(config.acceptedAudiences[0])
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

export function spyOnLogs(): MockInstance<typeof winston.Logger.prototype.log> {
  return vi.spyOn(winston.Logger.prototype, "log");
}

export const contactService = {
  createContact: vi.fn<ContactService["createContact"]>(),
};

export const api = await createTestApp(contactService);
