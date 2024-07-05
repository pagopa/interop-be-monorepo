/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorQuotasUpdatedV2,
  toEServiceV2,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
  inconsistentDailyCalls,
} from "../src/model/domain/errors.js";
import { UpdateEServiceDescriptorQuotasSeed } from "../src/model/domain/models.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  readLastEserviceEvent,
} from "./utils.js";

describe("update descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of a published descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        },
      ],
    };
    const returnedEService = await catalogService.updateDescriptor(
      eservice.id,
      descriptor.id,
      updatedDescriptorQuotasSeed,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorQuotasUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should write on event-store for the update of a suspended descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.suspended,
      interface: mockDocument,
      publishedAt: new Date(),
      suspendedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        },
      ],
    };
    const returnedEService = await catalogService.updateDescriptor(
      eservice.id,
      descriptor.id,
      updatedDescriptorQuotasSeed,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorQuotasUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should write on event-store for the update of an deprecated descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
      interface: mockDocument,
      publishedAt: new Date(),
      deprecatedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        },
      ],
    };
    const returnedEService = await catalogService.updateDescriptor(
      eservice.id,
      descriptor.id,
      updatedDescriptorQuotasSeed,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorQuotasUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
    };
    expect(
      catalogService.updateDescriptor(
        mockEService.id,
        mockDescriptor.id,
        updatedDescriptorQuotasSeed,
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
    };

    expect(
      catalogService.updateDescriptor(
        mockEService.id,
        mockDescriptor.id,
        updatedDescriptorQuotasSeed,
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw notValidDescriptor if the descriptor is in draft state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };

    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        updatedDescriptorQuotasSeed,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(mockDescriptor.id, descriptorState.draft)
    );
  });

  it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archived,
      archivedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        updatedDescriptorQuotasSeed,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(mockDescriptor.id, descriptorState.archived)
    );
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        updatedDescriptorQuotasSeed,
        {
          authData: getMockAuthData(),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        updatedDescriptorQuotasSeed,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
