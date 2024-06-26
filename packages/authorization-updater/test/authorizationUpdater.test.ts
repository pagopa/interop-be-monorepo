/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { RefreshableInteropToken, genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockClient,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementEventEnvelopeV2,
  Client,
  Descriptor,
  EService,
  EServiceEventEnvelopeV2,
  Purpose,
  PurposeEventEnvelopeV2,
  PurposeVersion,
  descriptorState,
  generateId,
  genericInternalError,
  purposeVersionState,
  toAgreementV2,
  toEServiceV2,
  toPurposeV2,
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
import {
  AuthorizationManagementClient,
  authorizationManagementClientBuilder,
} from "../src/authorizationManagementClient.js";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "../src/authorizationService.js";
import {
  sendAgreementAuthUpdate,
  sendCatalogAuthUpdate,
  sendPurposeAuthUpdate,
} from "../src/index.js";
import { ApiClientComponent } from "../src/model/models.js";
import { agreementStateToClientState } from "../src/utils.js";
import { addOneClient, addOneEService, readModelService } from "./utils.js";

describe("Authorization Updater processMessage", () => {
  const testCorrelationId = generateId();
  const testToken = "mockToken";
  const testHeaders = {
    "X-Correlation-Id": testCorrelationId,
    Authorization: `Bearer ${testToken}`,
  };

  let authorizationManagementClient: AuthorizationManagementClient;
  let mockRefreshableToken: RefreshableInteropToken;
  let authorizationService: AuthorizationService;

  beforeAll(async () => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as RefreshableInteropToken;

    authorizationManagementClient =
      authorizationManagementClientBuilder("mockUrl");
    authorizationService = authorizationServiceBuilder(
      authorizationManagementClient,
      mockRefreshableToken
    );
  });

  beforeEach(async () => {
    authorizationManagementClient.updateEServiceState = vi.fn();
    authorizationManagementClient.updateAgreementState = vi.fn();
    authorizationManagementClient.updateAgreementAndEServiceStates = vi.fn();
    authorizationManagementClient.updatePurposeState = vi.fn();
    authorizationManagementClient.removeClientPurpose = vi.fn();
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
            () => ApiClientComponent.Values.ACTIVE
          )
          .otherwise(() => ApiClientComponent.Values.INACTIVE),
        descriptorId: descriptor.id,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
      };

      expect(
        authorizationManagementClient.updateEServiceState
      ).toHaveBeenCalledTimes(1);
      expect(
        authorizationManagementClient.updateEServiceState
      ).toHaveBeenCalledWith(expectedUpdateEServiceStatePayload, {
        params: { eserviceId: eservice.id },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClient.updateAgreementState
      ).not.toHaveBeenCalled();
      expect(
        authorizationManagementClient.updateAgreementAndEServiceStates
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
        state: agreementStateToClientState(agreement),
        agreementId: agreement.id,
      };

      expect(
        authorizationManagementClient.updateAgreementState
      ).toHaveBeenCalledTimes(1);
      expect(
        authorizationManagementClient.updateAgreementState
      ).toHaveBeenCalledWith(expectedUpdateAgreementStatePayload, {
        params: {
          eserviceId: agreement.eserviceId,
          consumerId: agreement.consumerId,
        },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClient.updateEServiceState
      ).not.toHaveBeenCalled();
      expect(
        authorizationManagementClient.updateAgreementAndEServiceStates
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
      agreementState: agreementStateToClientState(agreement),
      descriptorId: descriptor.id,
      eserviceState: match(descriptor.state)
        .with(
          descriptorState.published,
          descriptorState.deprecated,
          () => ApiClientComponent.Values.ACTIVE
        )
        .otherwise(() => ApiClientComponent.Values.INACTIVE),
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
    };

    expect(
      authorizationManagementClient.updateAgreementAndEServiceStates
    ).toHaveBeenCalledTimes(1);
    expect(
      authorizationManagementClient.updateAgreementAndEServiceStates
    ).toHaveBeenCalledWith(expectedUpdateAgreementAndEServiceStatesPayload, {
      params: {
        eserviceId: agreement.eserviceId,
        consumerId: agreement.consumerId,
      },
      withCredentials: true,
      headers: testHeaders,
    });

    expect(
      authorizationManagementClient.updateAgreementState
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClient.updateEServiceState
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
      authorizationManagementClient.updateAgreementAndEServiceStates
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClient.updateAgreementState
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClient.updateEServiceState
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
      authorizationManagementClient.updateAgreementAndEServiceStates
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClient.updateAgreementState
    ).not.toHaveBeenCalled();
    expect(
      authorizationManagementClient.updateEServiceState
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
        authorizationManagementClient.removeClientPurpose
      ).toHaveBeenCalledTimes(2);

      expect(
        authorizationManagementClient.removeClientPurpose
      ).toHaveBeenCalledWith(undefined, {
        params: { purposeId: purpose.id, clientId: client1.id },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClient.removeClientPurpose
      ).toHaveBeenCalledWith(undefined, {
        params: { purposeId: purpose.id, clientId: client2.id },
        withCredentials: true,
        headers: testHeaders,
      });

      expect(
        authorizationManagementClient.updatePurposeState
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
    "NewPurposeVersionWaitingForApproval",
    "PurposeVersionRejected",
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
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledTimes(1);

      expect(
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledWith(
        { versionId: purposeVersion.id, state: "ACTIVE" },
        {
          params: { purposeId: purpose.id },
          withCredentials: true,
          headers: testHeaders,
        }
      );

      expect(
        authorizationManagementClient.removeClientPurpose
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
    "NewPurposeVersionWaitingForApproval",
    "PurposeVersionRejected",
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
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledTimes(1);

      expect(
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledWith(
        { versionId: purposeVersion.id, state: "INACTIVE" },
        {
          params: { purposeId: purpose.id },
          withCredentials: true,
          headers: testHeaders,
        }
      );

      expect(
        authorizationManagementClient.removeClientPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it.each(["PurposeActivated", "PurposeWaitingForApproval"])(
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
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledTimes(1);

      expect(
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledWith(
        { versionId: purposeVersion.id, state: "ACTIVE" },
        {
          params: { purposeId: purpose.id },
          withCredentials: true,
          headers: testHeaders,
        }
      );

      expect(
        authorizationManagementClient.removeClientPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it.each(["PurposeActivated", "PurposeWaitingForApproval"])(
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
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledTimes(1);

      expect(
        authorizationManagementClient.updatePurposeState
      ).toHaveBeenCalledWith(
        { versionId: purposeVersion.id, state: "INACTIVE" },
        {
          params: { purposeId: purpose.id },
          withCredentials: true,
          headers: testHeaders,
        }
      );

      expect(
        authorizationManagementClient.removeClientPurpose
      ).not.toHaveBeenCalled();
    }
  );
});
