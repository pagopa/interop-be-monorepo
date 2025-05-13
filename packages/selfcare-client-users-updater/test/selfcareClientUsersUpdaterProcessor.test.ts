/* eslint-disable prefer-const */
/* eslint-disable functional/no-let */
import { randomUUID, UUID } from "node:crypto";
import {
  vi,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  MockInstance,
  it,
  expect,
  inject,
} from "vitest";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  userRole,
} from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import {
  getMockClient,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import {
  Client,
  clientKind,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { selfcareClientUsersUpdaterProcessorBuilder } from "../src/services/selfcareClientUsersUpdaterProcessor.js";
import { config } from "../src/config/config.js";
import { AuthorizationProcessClient } from "../src/clients/authorizationProcessClient.js";
import { relationshipStatus } from "../src/model/UsersEventPayload.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import {
  correctEventPayload,
  generateInternalTokenMock,
  kafkaMessagePayload,
} from "./utils.js";

export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

describe("selfcareClientUsersUpdaterProcessor", () => {
  const readModelService = readModelServiceBuilder(readModelRepository);

  async function seedCollection(data: Array<{ data: Client }>): Promise<void> {
    await readModelRepository.clients.insertMany(data as never);
  }

  const userId: UUID = randomUUID();
  const clientMock = {
    ...getMockClient(),
    adminId: userId,
    kind: clientKind.api,
  };
  const clientMock2 = {
    ...getMockClient(),
    adminId: userId,
    kind: clientKind.api,
  };
  const authorizationProcessClientMock = {
    client: {
      internalRemoveClientAdmin: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as AuthorizationProcessClient;
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

  it.each([relationshipStatus.suspended, relationshipStatus.deleted])(
    "should remove admin when user has relationshipStatus %s",
    async (status) => {
      const message: EachMessagePayload = {
        ...kafkaMessagePayload,
        message: {
          ...kafkaMessagePayload.message,
          value: Buffer.from(
            JSON.stringify({
              ...correctEventPayload,
              productId: config.interopProduct,
              user: {
                userId,
                name: "Test Name",
                familyName: "Test FamilyName",
                email: "test@example.com",
                role: "Test Role",
                productRole: userRole.ADMIN_ROLE,
                relationshipStatus: status,
                mobilePhone: "1234567890",
              },
            })
          ),
        },
      };

      await seedCollection([
        {
          data: {
            ...clientMock,
            consumerId: unsafeBrandId(correctEventPayload.institutionId),
            adminId: unsafeBrandId<UserId>(userId),
          },
        },
        {
          data: {
            ...clientMock2,
            consumerId: unsafeBrandId(correctEventPayload.institutionId),
            adminId: unsafeBrandId<UserId>(userId),
          },
        },
      ]);

      await selfcareClientUsersUpdaterProcessor.processMessage(message);

      expect(
        authorizationProcessClientMock.client.internalRemoveClientAdmin
      ).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          params: {
            clientId: clientMock.id,
            adminId: clientMock.adminId,
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
            adminId: clientMock2.adminId,
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
