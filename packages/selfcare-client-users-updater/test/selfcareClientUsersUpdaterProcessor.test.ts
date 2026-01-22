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
import { getMockClient, getMockTenant } from "pagopa-interop-commons-test";
import { clientKind, relationshipStatus, Tenant } from "pagopa-interop-models";
import { authorizationApi } from "pagopa-interop-api-clients";
import { selfcareClientUsersUpdaterProcessorBuilder } from "../src/services/selfcareClientUsersUpdaterProcessor.js";
import { config } from "../src/config/config.js";
import {
  addOneClient,
  addOneTenant,
  correctEventPayload,
  generateInternalTokenMock,
  kafkaMessagePayload,
  readModelService,
} from "./utils.js";

describe("selfcareClientUsersUpdaterProcessor", () => {
  const authorizationProcessClientMock = {
    client: {
      internalRemoveClientAdmin: vi.fn().mockResolvedValue(undefined),
    },
    producerKeychain: {},
    user: {},
    token: {},
  } as unknown as authorizationApi.AuthorizationProcessClient;
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
        readModelService,
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

  it.each(
    Object.values(relationshipStatus).filter(
      (status) => status !== relationshipStatus.active
    )
  )(
    "should remove admin when event has productRole admin and relationshipStatus %s",
    async (status) => {
      const tenantMock: Tenant = {
        ...getMockTenant(),
        selfcareId: correctEventPayload.institutionId,
      };
      const clientMock = {
        ...getMockClient(),
        consumerId: tenantMock.id,
        adminId: correctEventPayload.user.userId,
        kind: clientKind.api,
      };
      const clientMock2 = {
        ...getMockClient(),
        consumerId: tenantMock.id,
        adminId: correctEventPayload.user.userId,
        kind: clientKind.api,
      };

      const message: EachMessagePayload = {
        ...kafkaMessagePayload,
        message: {
          ...kafkaMessagePayload.message,
          value: Buffer.from(
            JSON.stringify({
              ...correctEventPayload,
              productId: config.interopProduct,
              user: {
                ...correctEventPayload.user,
                productRole: userRole.ADMIN_ROLE,
                relationshipStatus: status,
              },
            })
          ),
        },
      };

      await addOneTenant(tenantMock);
      await addOneClient(clientMock);
      await addOneClient(clientMock2);

      await selfcareClientUsersUpdaterProcessor.processMessage(message);

      expect(
        authorizationProcessClientMock.client.internalRemoveClientAdmin
      ).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          params: {
            clientId: clientMock.id,
            adminId: correctEventPayload.user.userId,
          },
          headers: expect.any(Object),
        })
      );
      expect(
        authorizationProcessClientMock.client.internalRemoveClientAdmin
      ).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          params: {
            clientId: clientMock2.id,
            adminId: correctEventPayload.user.userId,
          },
          headers: expect.any(Object),
        })
      );
    }
  );

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

  it("should skip valid admin user with ACTIVE relationshipStatus", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from(
          JSON.stringify({
            ...correctEventPayload,
            user: {
              ...correctEventPayload.user,
              relationshipStatus: relationshipStatus.active,
            },
          })
        ),
      },
    };

    await selfcareClientUsersUpdaterProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
  });
});
