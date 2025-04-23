/* eslint-disable prefer-const */
/* eslint-disable functional/no-let */
import {
  vi,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  MockInstance,
  it,
  expect,
} from "vitest";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  userRole,
} from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import { selfcareClientUsersUpdaterProcessorBuilder } from "../src/services/selfcareClientUsersUpdaterProcessor.js";
import { config } from "../src/config/config.js";
import {
  AuthorizationProcessClient,
  authorizationProcessClientBuilder,
} from "../src/clients/authorizationProcessClient.js";
import {
  correctEventPayload,
  generateInternalTokenMock,
  kafkaMessagePayload,
} from "./utils.js";

describe("selfcareClientUsersUpdaterProcessor", () => {
  const authorizationProcessClientMock: AuthorizationProcessClient =
    authorizationProcessClientBuilder(config.authorizationProcessUrl);
  const tokenGeneratorMock = new InteropTokenGenerator(config);
  const refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  let selfcareClientUsersUpdaterProcessor: ReturnType<
    typeof selfcareClientUsersUpdaterProcessorBuilder
  >;

  beforeAll(async () => {
    selfcareClientUsersUpdaterProcessor =
      selfcareClientUsersUpdaterProcessorBuilder(
        refreshableTokenMock,
        authorizationProcessClientMock,
        config.interopProduct
      );
  });

  let refreshableInternalTokenSpy: MockInstance;
  beforeEach(() => {
    vi.spyOn(tokenGeneratorMock, "generateInternalToken").mockImplementation(
      generateInternalTokenMock
    );
    refreshableInternalTokenSpy = vi
      .spyOn(refreshableTokenMock, "get")
      .mockImplementation(generateInternalTokenMock);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("should skip empty message", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: { ...kafkaMessagePayload.message, value: null },
    };

    await selfcareClientUsersUpdaterProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
  });

  it("should throw an error if message is malformed", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from('{ not-a : "correct-json"'),
      },
    };

    await expect(() =>
      selfcareClientUsersUpdaterProcessor.processMessage(message)
    ).rejects.toThrowError(/Error.*partition.*offset.*Reason/);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
  });

  it("should skip message not containing required product", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from(
          JSON.stringify({
            ...correctEventPayload,
            productId: "another-product",
          })
        ),
      },
    };

    await selfcareClientUsersUpdaterProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
  });

  it("should skip message with not required eventType", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from(
          JSON.stringify({
            ...correctEventPayload,
            productId: config.interopProduct,
            eventType: "ADD",
          })
        ),
      },
    };

    await selfcareClientUsersUpdaterProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
  });

  it("should skip message with not allowed origin", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from(
          JSON.stringify({
            ...correctEventPayload,
            institutionId: "not-allowed-uuid",
          })
        ),
      },
    };

    await selfcareClientUsersUpdaterProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
  });

  it("should skip valid admin user with ACTIVE relationshipStatus", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from(
          JSON.stringify({
            ...correctEventPayload,
            user: {
              productRole: userRole.ADMIN_ROLE,
              relationshipStatus: "ACTIVE",
            },
          })
        ),
      },
    };

    await selfcareClientUsersUpdaterProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
  });
});
