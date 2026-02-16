import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import express, { Request, Response } from "express";
import request, { Response as SupertestResponse } from "supertest";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  PutItemCommandOutput,
  GetItemCommandOutput,
  AttributeValue,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { APIEndpoint } from "pagopa-interop-commons";
import {
  generateM2MAdminAccessTokenWithDPoPProof,
  JwksServer,
  startJwksServer,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { authenticationDPoPMiddleware } from "../../src/utils/middlewares.js";

type Item = Record<string, AttributeValue>;

export function createInMemoryDynamoDBClient(): DynamoDBClient {
  const table = new Map<string, Item>();

  const send = vi.fn(async (command): Promise<unknown> => {
    // ---------------------------
    // PUT ITEM
    // ---------------------------
    if (command instanceof PutItemCommand) {
      const input = command.input;
      const jti = input.Item?.jti?.S;

      if (!jti) {
        throw new Error("Missing jti");
      }

      if (table.has(jti)) {
        throw new ConditionalCheckFailedException({
          message: "Conditional check failed",
          $metadata: {},
        });
      }

      if (!input.Item) {
        throw new Error("Missing item");
      }
      table.set(jti, input.Item);

      const output: PutItemCommandOutput = {
        $metadata: {},
      };
      return output;
    }

    // ---------------------------
    // GET ITEM
    // ---------------------------
    if (command instanceof GetItemCommand) {
      const jti = command.input.Key?.jti?.S;

      if (!jti) {
        throw new Error("Missing jti");
      }

      const item = table.get(jti);

      const output: GetItemCommandOutput = {
        Item: item,
        $metadata: {},
      };

      return output;
    }

    throw new Error(`Unsupported command: ${command.constructor.name}`);
  });

  return { send } as unknown as DynamoDBClient;
}

const dynamoClient = {
  send: vi.fn().mockResolvedValue({
    Item: undefined,
  }),
} as unknown as DynamoDBClient;

const inMemeryDynamoClient = createInMemoryDynamoDBClient();

function buildTestApp(wellKnownUrl: string, useInMemoryDynamoClient = false) {
  const app = express();

  // minimal ctx bootstrap middleware
  app.use((req: Request & { ctx?: unknown }, _res, next) => {
    req.ctx = {
      correlationId: "test",
      serviceName: "test",
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      rateLimiter: undefined,
    };
    next();
  });

  // codeql[js/missing-rate-limiting]: test-only fake API, not exposed in production
  app.use(
    // codeql[js/missing-rate-limiting]: test-only fake API, not exposed in production
    authenticationDPoPMiddleware(
      { ...config, wellKnownUrls: [APIEndpoint.parse(wellKnownUrl)] },
      useInMemoryDynamoClient ? inMemeryDynamoClient : dynamoClient
    )
  );

  type RequestWithCtx = Request & {
    ctx?: {
      authData?: unknown;
    };
  };

  // codeql[js/missing-rate-limiting]: test-only fake API, not exposed in production
  app.get("/test", (req: RequestWithCtx, res: Response) => {
    try {
      res.status(200).json({ authData: req.ctx?.authData });
    } catch (error) {
      res.status(500).json({ error });
    }
  });

  return app;
}

export function expectResponseToContainErrorCodeMatching(
  response: SupertestResponse,
  regex: RegExp
): void {
  // Ensure body exists
  expect(response).toBeDefined();
  expect(response.body).toBeDefined();

  const body: unknown = response.body;

  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();

  const errors: unknown = (body as { errors?: unknown }).errors;

  expect(Array.isArray(errors)).toBe(true);

  const errorArray: unknown[] = errors as unknown[];

  const hasMatchingCode: boolean = errorArray.some(
    (error: unknown): boolean => {
      if (
        typeof error !== "object" ||
        error === null ||
        typeof (error as { code?: unknown }).code !== "string"
      ) {
        return false;
      }

      const code = (error as { code: string }).code;

      return regex.test(code);
    }
  );

  expect(hasMatchingCode).toBe(true);
}

describe("authenticationDPoPMiddleware", () => {
  let jwksServer: JwksServer;
  let mockDPoPData: Awaited<
    ReturnType<typeof generateM2MAdminAccessTokenWithDPoPProof>
  >;

  beforeAll(async () => {
    mockDPoPData = await generateM2MAdminAccessTokenWithDPoPProof({
      htu: `${config.dpopHtuBase}/test`,
      htm: "GET",
    });
    jwksServer = await startJwksServer(mockDPoPData.authServerPublicJwk);
  });

  afterAll(async () => {
    await jwksServer.close();
  });

  beforeEach(() => {
    vi.unmock("../../src/utils/middlewares.js");
  });

  it("Should return 200 and call next when the token and the DPoP proof are valid", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res.body).toEqual({ authData: mockDPoPData.expectedAuthData });
    expect(res.status).toBe(200);
  });

  it("Should return 401 if the same token is used more than once", async () => {
    const app = buildTestApp(jwksServer.url, true);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res.body).toEqual({ authData: mockDPoPData.expectedAuthData });
    expect(res.status).toBe(200);

    const res2 = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res2.body.title).toEqual("DPoP proof JTI already in cache");
    expect(res2.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res2, /-0044$/g);
  });

  it("Should return 400 if the Authorization token is Bearer", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", "Bearer " + mockDPoPData.accessToken)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res.body.title).toEqual("Bad DPoP Token format");
    expect(res.status).toBe(400);
    expectResponseToContainErrorCodeMatching(res, /-10028$/g);
  });

  it("Should return 200 if the Authorization token is dpop (lowercase)", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", "dpop " + mockDPoPData.accessToken)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res.body).toEqual({ authData: mockDPoPData.expectedAuthData });
    expect(res.status).toBe(200);
  });

  it("Should return 400 if the Authorization token is Bearer and no DPoP proof is passed", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", "Bearer " + mockDPoPData.accessToken);

    expect(res.body.title).toEqual("Bad DPoP Token format");
    expect(res.status).toBe(400);
    expectResponseToContainErrorCodeMatching(res, /-10028$/g);
  });

  it("Should return 400 if no authorization header or DPoP proof is passed", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app).get("/test");

    expect(res.body.title).toEqual("Header has not been passed");
    expect(res.status).toBe(400);
    expectResponseToContainErrorCodeMatching(res, /-9994$/g);
  });

  it("Should return 400 if DPoP proof is missing", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`);

    expect(res.body.title).toEqual("Header has not been passed");
    expect(res.status).toBe(400);
    expectResponseToContainErrorCodeMatching(res, /-9994$/g);
  });

  it("Should return 400 if DPoP proof is invalid for this token", async () => {
    const app = buildTestApp(jwksServer.url);
    const secondDPoPData = await generateM2MAdminAccessTokenWithDPoPProof({
      htu: `${config.dpopHtuBase}/test`,
      htm: "GET",
    });
    const secondDPoPProof = secondDPoPData.dpopProof;

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", secondDPoPProof);

    expect(res.body.title).toEqual("DPoP Token Binding Mismatch");
    expect(res.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res, /-0045$/g);
  });

  it("Should return 401 if cnf is missing", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessTokenWithoutCnf}`)
      .set("DPoP", `DPoP ${mockDPoPData.dpopProof}`);

    expect(res.body.title).toEqual("Token verification failed");
    expect(res.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res, /-10014$/g);
  });

  it("Should return 401 if cnf is different", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessTokenWithDifferentCnf}`)
      .set("DPoP", `DPoP ${mockDPoPData.dpopProof}`);

    expect(res.body.title).toEqual("DPoP proof validation failed");
    expect(res.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res, /-0041$/g);
  });

  it("Should return 401 if the token is expired", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.expiredDpopProof}`)
      .set("DPoP", `DPoP ${mockDPoPData.dpopProof}`);

    expect(res.body.title).toEqual("Token verification failed");
    expect(res.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res, /-10014$/g);
  });

  it("Should return 401 if the DPoP proof is expired", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.expiredAccessToken}`)
      .set("DPoP", `DPoP ${mockDPoPData.expiredDpopProof}`);

    expect(res.body.title).toEqual("Token verification failed");
    expect(res.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res, /-10014$/g);
  });

  it("Should return 401 if the htu is wrong", async () => {
    const wrongHtuData = await generateM2MAdminAccessTokenWithDPoPProof({
      htu: `${config.dpopHtuBase}/wrong`,
      htm: "GET",
    });
    const wrongHtuDpopProof = wrongHtuData.dpopProof;

    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${wrongHtuData.accessToken}`)
      .set("DPoP", wrongHtuDpopProof);

    expect(res.body.title).toEqual("Token verification failed");
    expect(res.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res, /-10014$/g);
  });

  it("Should return 401 if the htm is wrong", async () => {
    const wrongHtmData = await generateM2MAdminAccessTokenWithDPoPProof({
      htu: `${config.dpopHtuBase}/test`,
      htm: "POST",
    });
    const wrongHtmDpopProof = wrongHtmData.dpopProof;

    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${wrongHtmData.accessToken}`)
      .set("DPoP", wrongHtmDpopProof);

    expect(res.body.title).toEqual("Token verification failed");
    expect(res.status).toBe(401);
    expectResponseToContainErrorCodeMatching(res, /-10014$/g);
  });
});
