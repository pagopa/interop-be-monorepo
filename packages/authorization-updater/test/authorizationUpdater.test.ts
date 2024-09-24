/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { RefreshableInteropToken, genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockClient,
  getMockDescriptor,
  getMockDescriptorPublished,
  getMockEService,
  getMockKey,
  getMockPurpose,
  getMockPurposeVersion,
  randomArrayItem,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementEventEnvelopeV2,
  AuthorizationEventEnvelopeV2,
  Client,
  ClientId,
  Descriptor,
  EService,
  EServiceEventEnvelopeV2,
  Purpose,
  PurposeEventEnvelopeV2,
  PurposeId,
  PurposeVersion,
  TenantId,
  UserId,
  agreementState,
  descriptorState,
  generateId,
  genericInternalError,
  purposeVersionState,
  toAgreementV2,
  toClientV2,
  toEServiceV2,
  toPurposeV2,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { authorizationManagementApi } from "pagopa-interop-api-clients";
import {
  AuthorizationManagementClients,
  buildAuthorizationManagementClients,
} from "../src/authorizationManagementClient.js";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "../src/authorizationService.js";
import {
  sendAgreementAuthUpdate,
  sendAuthorizationAuthUpdate,
  sendCatalogAuthUpdate,
  sendPurposeAuthUpdate,
} from "../src/index.js";
import {
  agreementStateToClientState,
  clientKindToApiClientKind,
  keyUseToApiKeyUse,
} from "../src/utils.js";
import {
  addOneClient,
  addOneEService,
  agreements,
  eservices,
  purposes,
  readModelService,
} from "./utils.js";

describe("Authorization Updater processMessage", () => {
  const testCorrelationId = generateId();
  const testToken = "mockToken";
  const testHeaders = {
    "X-Correlation-Id": testCorrelationId,
    Authorization: `Bearer ${testToken}`,
  };

  let authorizationManagementClients: AuthorizationManagementClients;
  let mockRefreshableToken: RefreshableInteropToken;
  let authorizationService: AuthorizationService;

  beforeAll(async () => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as RefreshableInteropToken;

    authorizationManagementClients =
      buildAuthorizationManagementClients("mockUrl");
    authorizationService = authorizationServiceBuilder(
      authorizationManagementClients,
      mockRefreshableToken
    );
  });

  beforeEach(async () => {
    authorizationManagementClients.purposeApiClient.updateEServiceState =
      vi.fn();
    authorizationManagementClients.purposeApiClient.updateAgreementState =
      vi.fn();
    authorizationManagementClients.purposeApiClient.updateAgreementAndEServiceStates =
      vi.fn();
    authorizationManagementClients.purposeApiClient.updatePurposeState =
      vi.fn();
    authorizationManagementClients.purposeApiClient.removeClientPurpose =
      vi.fn();
    authorizationManagementClients.clientApiClient.createClient = vi.fn();
    authorizationManagementClients.clientApiClient.deleteClient = vi.fn();
    authorizationManagementClients.keyApiClient.createKeys = vi.fn();
    authorizationManagementClients.keyApiClient.deleteClientKeyById = vi.fn();
    authorizationManagementClients.clientApiClient.addUser = vi.fn();
    authorizationManagementClients.clientApiClient.removeClientUser = vi.fn();
    authorizationManagementClients.purposeApiClient.addClientPurpose = vi.fn();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it.each([
    "EServiceDescriptorPublished",
    "EServiceDescriptorArchived",
    "EServiceDescriptorSuspended",
    "EServiceDescriptorActivated",
  ])(
    "should correctly process a catalog message with type %t and call updateEServiceState",
    async (eventType) => {
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        version: "1",
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const message: EServiceEventEnvelopeV2 = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 1,
        type: eventType,
        event_version: 2,
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: descriptor.id,
        },
        log_date: new Date(),
      } as EServiceEventEnvelopeV2;

      await sendCatalogAuthUpdate(
        message,
        authorizationService,
        genericLogger,
        testCorrelationId
      );

      const expectedUpdateEServiceStatePayload = {
        state: match(message)
          .with(
            { type: "EServiceDescriptorPublished" },
            { type: "EServiceDescriptorActivated" },
            () => authorizationManagementApi.ClientComponentState.Values.ACTIVE
          )
          .otherwise(
            () =>
              authorizationManagementApi.ClientComponentState.Values.INACTIVE
          ),
        descriptorId: descriptor.id,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
      };

      expect(
        authorizationManagementClients.purposeApiClient.updateEServiceState
      ).toHaveBeenCalledTimes(1);
      expect(
        authorizationManagementClients.purposeApiClient.updateEServiceState
      ).toHaveBeenCalledWith(expectedUpdateEServiceStatePayload, {
        params: { eserviceId: eservice.id },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClients.purposeApiClient.updateAgreementState
      ).not.toHaveBeenCalled();
      expect(
        authorizationManagementClients.purposeApiClient
          .updateAgreementAndEServiceStates
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    "AgreementSubmitted",
    "AgreementActivated",
    "AgreementSuspendedByPlatform",
    "AgreementSuspendedByConsumer",
    "AgreementSuspendedByProducer",
    "AgreementUnsuspendedByPlatform",
    "AgreementUnsuspendedByConsumer",
    "AgreementUnsuspendedByProducer",
    "AgreementArchivedByConsumer",
    "AgreementArchivedByUpgrade",
  ])(
    "Should correctly process an agreement messages with type %t and call updateAgreementState",
    async (eventType) => {
      const agreement: Agreement = getMockAgreement();

      const message: AgreementEventEnvelopeV2 = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: eventType,
        event_version: 2,
        data: {
          agreement: toAgreementV2(agreement),
        },
        log_date: new Date(),
      } as AgreementEventEnvelopeV2;

      await sendAgreementAuthUpdate(
        message,
        readModelService,
        authorizationService,
        genericLogger,
        testCorrelationId
      );

      const expectedUpdateAgreementStatePayload = {
        state: agreementStateToClientState(agreement.state),
        agreementId: agreement.id,
      };

      expect(
        authorizationManagementClients.purposeApiClient.updateAgreementState
      ).toHaveBeenCalledTimes(1);
      expect(
        authorizationManagementClients.purposeApiClient.updateAgreementState
      ).toHaveBeenCalledWith(expectedUpdateAgreementStatePayload, {
        params: {
          eserviceId: agreement.eserviceId,
          consumerId: agreement.consumerId,
        },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClients.purposeApiClient.updateEServiceState
      ).not.toHaveBeenCalled();
      expect(
        authorizationManagementClients.purposeApiClient
          .updateAgreementAndEServiceStates
      ).not.toHaveBeenCalled();
    }
  );

  it("Should correctly process an agreement message with type AgreementUpgraded and call updateAgreementAndEServiceStates", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "1",
      state: randomArrayItem(Object.values(descriptorState)),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
    };

    await addOneEService(eservice);
    const message: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementUpgraded",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
      log_date: new Date(),
    } as AgreementEventEnvelopeV2;

    await sendAgreementAuthUpdate(
      message,
      readModelService,
      authorizationService,
      genericLogger,
      testCorrelationId
    );

    const expectedUpdateAgreementAndEServiceStatesPayload = {
      agreementId: agreement.id,
      agreementState: agreementStateToClientState(agreement.state),
      descriptorId: descriptor.id,
      eserviceState: match(descriptor.state)
        .with(
          descriptorState.published,
          descriptorState.deprecated,
          () => authorizationManagementApi.ClientComponentState.Values.ACTIVE
        )
        .otherwise(
          () => authorizationManagementApi.ClientComponentState.Values.INACTIVE
        ),
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
    };

    expect(
      authorizationManagementClients.purposeApiClient
        .updateAgreementAndEServiceStates
    ).toHaveBeenCalledTimes(1);
    expect(
      authorizationManagementClients.purposeApiClient
        .updateAgreementAndEServiceStates
    ).toHaveBeenCalledWith(expectedUpdateAgreementAndEServiceStatesPayload, {
      params: {
        eserviceId: agreement.eserviceId,
        consumerId: agreement.consumerId,
      },
      withCredentials: true,
      headers: testHeaders,
    });

    expect(
      authorizationManagementClients.purposeApiClient.updateAgreementState
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClients.purposeApiClient.updateEServiceState
    ).not.toHaveBeenCalled();
  });

  it("Should throw when processing AgreementUpgraded messages if the EService for the agreement is not found", async () => {
    const agreement: Agreement = getMockAgreement();
    const message: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementUpgraded",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
      log_date: new Date(),
    } as AgreementEventEnvelopeV2;

    await expect(
      sendAgreementAuthUpdate(
        message,
        readModelService,
        authorizationService,
        genericLogger,
        testCorrelationId
      )
    ).rejects.toThrow(
      genericInternalError(
        `Unable to find EService with id ${agreement.eserviceId}`
      )
    );

    expect(
      authorizationManagementClients.purposeApiClient
        .updateAgreementAndEServiceStates
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClients.purposeApiClient.updateAgreementState
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClients.purposeApiClient.updateEServiceState
    ).not.toHaveBeenCalled();
  });

  it("Should throw when processing AgreementUpgraded messages if the EService descriptor for the agreement is not found", async () => {
    const eservice: EService = getMockEService();
    const agreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
    };
    await addOneEService(eservice);

    const message: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementUpgraded",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
      log_date: new Date(),
    } as AgreementEventEnvelopeV2;

    await expect(
      sendAgreementAuthUpdate(
        message,
        readModelService,
        authorizationService,
        genericLogger,
        testCorrelationId
      )
    ).rejects.toThrow(
      genericInternalError(
        `Unable to find descriptor with id ${agreement.descriptorId}`
      )
    );

    expect(
      authorizationManagementClients.purposeApiClient
        .updateAgreementAndEServiceStates
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClients.purposeApiClient.updateAgreementState
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClients.purposeApiClient.updateEServiceState
    ).not.toHaveBeenCalled();
  });

  it.each(["DraftPurposeDeleted", "WaitingForApprovalPurposeDeleted"])(
    "should correctly process purposes message with type %t and call deletePurposeFromClient",
    async (eventType) => {
      const purpose: Purpose = {
        ...getMockPurpose(),
      };

      const message = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: 1,
        type: eventType,
        event_version: 2,
        data: {
          purpose: toPurposeV2(purpose),
        },
        log_date: new Date(),
      } as PurposeEventEnvelopeV2;

      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
      };
      const client2: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
      };
      const client3: Client = {
        ...getMockClient(),
        purposes: [generateId()],
      };

      await addOneClient(client1);
      await addOneClient(client2);
      await addOneClient(client3);

      await sendPurposeAuthUpdate(
        message,
        readModelService,
        authorizationService,
        genericLogger,
        testCorrelationId
      );

      expect(
        authorizationManagementClients.purposeApiClient.removeClientPurpose
      ).toHaveBeenCalledTimes(2);

      expect(
        authorizationManagementClients.purposeApiClient.removeClientPurpose
      ).toHaveBeenCalledWith(undefined, {
        params: { purposeId: purpose.id, clientId: client1.id },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClients.purposeApiClient.removeClientPurpose
      ).toHaveBeenCalledWith(undefined, {
        params: { purposeId: purpose.id, clientId: client2.id },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClients.purposeApiClient.updatePurposeState
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    "PurposeVersionSuspendedByConsumer",
    "PurposeVersionSuspendedByProducer",
    "PurposeVersionUnsuspendedByConsumer",
    "PurposeVersionUnsuspendedByProducer",
    "PurposeVersionOverQuotaUnsuspended",
    "NewPurposeVersionActivated",
    "PurposeVersionActivated",
    "PurposeArchived",
  ])(
    "should correctly process purposes message with type %t and call updatePurposeState with ACTIVE state",
    async (eventType) => {
      const purposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [purposeVersion],
      };

      const message = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: 1,
        type: eventType,
        event_version: 2,
        data: {
          purpose: toPurposeV2(purpose),
          versionId: purposeVersion.id,
        },
        log_date: new Date(),
      } as PurposeEventEnvelopeV2;

      await sendPurposeAuthUpdate(
        message,
        readModelService,
        authorizationService,
        genericLogger,
        testCorrelationId
      );

      expect(
        authorizationManagementClients.purposeApiClient.updatePurposeState
      ).toHaveBeenCalledTimes(1);

      expect(
        authorizationManagementClients.purposeApiClient.updatePurposeState
      ).toHaveBeenCalledWith(
        { versionId: purposeVersion.id, state: "ACTIVE" },
        {
          params: { purposeId: purpose.id },
          withCredentials: true,
          headers: testHeaders,
        }
      );

      expect(
        authorizationManagementClients.purposeApiClient.removeClientPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    "PurposeVersionSuspendedByConsumer",
    "PurposeVersionSuspendedByProducer",
    "PurposeVersionUnsuspendedByConsumer",
    "PurposeVersionUnsuspendedByProducer",
    "PurposeVersionOverQuotaUnsuspended",
    "NewPurposeVersionActivated",
    "PurposeVersionActivated",
    "PurposeArchived",
  ])(
    "should correctly process purposes message with type %t and call updatePurposeState with INACTIVE state",
    async (eventType) => {
      const purposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.suspended,
      };
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [purposeVersion],
      };

      const message = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: 1,
        type: eventType,
        event_version: 2,
        data: {
          purpose: toPurposeV2(purpose),
          versionId: purposeVersion.id,
        },
        log_date: new Date(),
      } as PurposeEventEnvelopeV2;

      await sendPurposeAuthUpdate(
        message,
        readModelService,
        authorizationService,
        genericLogger,
        testCorrelationId
      );

      expect(
        authorizationManagementClients.purposeApiClient.updatePurposeState
      ).toHaveBeenCalledTimes(1);

      expect(
        authorizationManagementClients.purposeApiClient.updatePurposeState
      ).toHaveBeenCalledWith(
        { versionId: purposeVersion.id, state: "INACTIVE" },
        {
          params: { purposeId: purpose.id },
          withCredentials: true,
          headers: testHeaders,
        }
      );

      expect(
        authorizationManagementClients.purposeApiClient.removeClientPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it("should correctly process purposes message with type PurposeActivated and call updatePurposeState with ACTIVE state", async () => {
    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [purposeVersion],
    };

    const message = {
      sequence_num: 1,
      stream_id: purpose.id,
      version: 1,
      type: "PurposeActivated",
      event_version: 2,
      data: {
        purpose: toPurposeV2(purpose),
      },
      log_date: new Date(),
    } as PurposeEventEnvelopeV2;

    await sendPurposeAuthUpdate(
      message,
      readModelService,
      authorizationService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.purposeApiClient.updatePurposeState
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.purposeApiClient.updatePurposeState
    ).toHaveBeenCalledWith(
      { versionId: purposeVersion.id, state: "ACTIVE" },
      {
        params: { purposeId: purpose.id },
        withCredentials: true,
        headers: testHeaders,
      }
    );

    expect(
      authorizationManagementClients.purposeApiClient.removeClientPurpose
    ).not.toHaveBeenCalled();
  });

  it("should correctly process purposes message with type PurposeActivated and call updatePurposeState with INACTIVE state", async () => {
    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.suspended,
    };
    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [purposeVersion],
    };

    const message = {
      sequence_num: 1,
      stream_id: purpose.id,
      version: 1,
      type: "PurposeActivated",
      event_version: 2,
      data: {
        purpose: toPurposeV2(purpose),
      },
      log_date: new Date(),
    } as PurposeEventEnvelopeV2;

    await sendPurposeAuthUpdate(
      message,
      readModelService,
      authorizationService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.purposeApiClient.updatePurposeState
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.purposeApiClient.updatePurposeState
    ).toHaveBeenCalledWith(
      { versionId: purposeVersion.id, state: "INACTIVE" },
      {
        params: { purposeId: purpose.id },
        withCredentials: true,
        headers: testHeaders,
      }
    );

    expect(
      authorizationManagementClients.purposeApiClient.removeClientPurpose
    ).not.toHaveBeenCalled();
  });
  it("should correctly process an authorization message of type ClientAdded", async () => {
    const client = getMockClient();
    const message = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "ClientAdded",
      event_version: 2,
      data: {
        client: toClientV2(client),
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.clientApiClient.createClient
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.clientApiClient.createClient
    ).toHaveBeenCalledWith(
      {
        clientId: client.id,
        name: client.name,
        description: client.description,
        consumerId: client.consumerId,
        createdAt: client.createdAt.toISOString(),
        kind: clientKindToApiClientKind(client.kind),
        users: client.users,
      },
      {
        withCredentials: true,
        headers: testHeaders,
      }
    );
  });
  it("should correctly process an authorization message of type ClientDeleted", async () => {
    const clientId: ClientId = generateId();
    const message = {
      sequence_num: 1,
      stream_id: clientId,
      version: 1,
      type: "ClientDeleted",
      event_version: 2,
      data: {
        clientId,
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.clientApiClient.deleteClient
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.clientApiClient.deleteClient
    ).toHaveBeenCalledWith(undefined, {
      params: { clientId },
      withCredentials: true,
      headers: testHeaders,
    });
  });
  it("should correctly process an authorization message of type ClientKeyAdded", async () => {
    const mockKey = getMockKey();
    const mockClient = { ...getMockClient(), keys: [mockKey] };
    const message = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientKeyAdded",
      event_version: 2,
      data: {
        client: toClientV2(mockClient),
        kid: mockKey.kid,
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.keyApiClient.createKeys
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.keyApiClient.createKeys
    ).toHaveBeenCalledWith(
      [
        {
          name: mockKey.name,
          createdAt: mockKey.createdAt.toISOString(),
          userId: mockKey.userId,
          key: mockKey.encodedPem,
          use: keyUseToApiKeyUse(mockKey.use),
          alg: mockKey.algorithm,
        },
      ],
      {
        params: { clientId: mockClient.id },
        withCredentials: true,
        headers: testHeaders,
      }
    );
  });
  it("should correctly process an authorization message of type ClientKeyDeleted", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = { ...getMockClient(), keys: [] };
    const message = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientKeyDeleted",
      event_version: 2,
      data: {
        client: toClientV2(mockClient),
        kid: mockKey.kid,
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.keyApiClient.deleteClientKeyById
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.keyApiClient.deleteClientKeyById
    ).toHaveBeenCalledWith(undefined, {
      params: { clientId: mockClient.id, keyId: mockKey.kid },
      withCredentials: true,
      headers: testHeaders,
    });
  });
  it("should correctly process an authorization message of type ClientUserAdded", async () => {
    const userId: UserId = generateId();
    const mockClient = { ...getMockClient(), userIds: [userId] };
    const message = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientUserAdded",
      event_version: 2,
      data: {
        client: toClientV2(mockClient),
        userId,
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.clientApiClient.addUser
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.clientApiClient.addUser
    ).toHaveBeenCalledWith(
      { userId },
      {
        params: { clientId: mockClient.id },
        withCredentials: true,
        headers: testHeaders,
      }
    );
  });
  it("should correctly process an authorization message of type ClientUserDeleted", async () => {
    const userId: UserId = generateId();
    const mockClient = { ...getMockClient(), userIds: [] };
    const message = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientUserDeleted",
      event_version: 2,
      data: {
        client: toClientV2(mockClient),
        userId,
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.clientApiClient.removeClientUser
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.clientApiClient.removeClientUser
    ).toHaveBeenCalledWith(undefined, {
      params: { clientId: mockClient.id, userId },
      withCredentials: true,
      headers: testHeaders,
    });
  });
  it("should correctly process an authorization message of type ClientPurposeAdded", async () => {
    const mockConsumerId: TenantId = generateId();
    const mockDescriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };
    const mockEservice: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockArchivedAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.archived,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
      createdAt: new Date()
    };
    const mockActiveAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
      createdAt: new Date(mockArchivedAgreement.createdAt.getTime() + 10000)
    };
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.active
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: mockConsumerId,
      eserviceId: mockEservice.id,
      versions: [mockPurposeVersion],
    };
    const mockClient = { ...getMockClient(), purposes: [mockPurpose.id] };

    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockArchivedAgreement), agreements);
    await writeInReadmodel(toReadModelAgreement(mockActiveAgreement), agreements);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);

    const message = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientPurposeAdded",
      event_version: 2,
      data: {
        client: toClientV2(mockClient),
        purposeId: mockPurpose.id,
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.purposeApiClient.addClientPurpose
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.purposeApiClient.addClientPurpose
    ).toHaveBeenCalledWith(
      {
        states: {
          eservice: {
            state:
              authorizationManagementApi.ClientComponentState.Values.ACTIVE,
            eserviceId: mockEservice.id,
            descriptorId: mockDescriptor.id,
            audience: mockDescriptor.audience,
            voucherLifespan: mockDescriptor.voucherLifespan,
          },
          agreement: {
            agreementId: mockActiveAgreement.id,
            state:
              authorizationManagementApi.ClientComponentState.Values.ACTIVE,
            eserviceId: mockEservice.id,
            consumerId: mockConsumerId,
          },
          purpose: {
            state:
              authorizationManagementApi.ClientComponentState.Values.ACTIVE,
            versionId: mockPurposeVersion.id,
            purposeId: mockPurpose.id,
          },
        },
      },
      {
        params: { clientId: mockClient.id },
        withCredentials: true,
        headers: testHeaders,
      }
    );
  });
  it("should correctly process an authorization message of type ClientPurposeRemoved", async () => {
    const purposeId: PurposeId = generateId();
    const mockClient = { ...getMockClient(), userIds: [] };
    const message = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientPurposeRemoved",
      event_version: 2,
      data: {
        client: toClientV2(mockClient),
        purposeId,
      },
      log_date: new Date(),
    } as AuthorizationEventEnvelopeV2;

    await sendAuthorizationAuthUpdate(
      message,
      authorizationService,
      readModelService,
      genericLogger,
      testCorrelationId
    );

    expect(
      authorizationManagementClients.purposeApiClient.removeClientPurpose
    ).toHaveBeenCalledTimes(1);

    expect(
      authorizationManagementClients.purposeApiClient.removeClientPurpose
    ).toHaveBeenCalledWith(undefined, {
      params: { clientId: mockClient.id, purposeId },
      withCredentials: true,
      headers: testHeaders,
    });
  });
});
