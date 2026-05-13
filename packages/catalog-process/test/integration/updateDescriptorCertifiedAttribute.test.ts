/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAttribute,
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  attributeKind,
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorAttributeDailyCallsPerConsumerUpdatedV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  attributeNotFound,
  certifiedAttributeGroupNotFoundInSeed,
  inconsistentDailyCalls,
  unchangedAttributes,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("update descriptor certified attribute", () => {
  it("should update dailyCallsPerConsumer and write a dedicated event", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      dailyCallsTotal: 200,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 50,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          attributes: {
            ...descriptor.attributes,
            certified: [
              [
                {
                  id: certifiedAttribute.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 100,
                },
              ],
            ],
          },
        },
      ],
    };

    const returnedEService =
      await catalogService.updateDescriptorCertifiedAttribute(
        eservice.id,
        descriptor.id,
        0,
        certifiedAttribute.id,
        { dailyCallsPerConsumer: 100 },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAttributeDailyCallsPerConsumerUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAttributeDailyCallsPerConsumerUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      descriptorId: descriptor.id,
      attributeId: certifiedAttribute.id,
      dailyCallsPerConsumer: 100,
      eservice: toEServiceV2(updatedEService),
    });
    expect(returnedEService).toEqual({
      data: updatedEService,
      metadata: { version: 1 },
    });
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer exceeds dailyCallsTotal", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      dailyCallsTotal: 100,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 50,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.updateDescriptorCertifiedAttribute(
        eservice.id,
        descriptor.id,
        0,
        certifiedAttribute.id,
        { dailyCallsPerConsumer: 200 },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw unchangedAttributes if the value is identical to the current one", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      dailyCallsTotal: 200,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 50,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.updateDescriptorCertifiedAttribute(
        eservice.id,
        descriptor.id,
        0,
        certifiedAttribute.id,
        { dailyCallsPerConsumer: 50 },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(unchangedAttributes(eservice.id, descriptor.id));
  });

  it("should throw certifiedAttributeGroupNotFoundInSeed if groupIndex is out of range", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      dailyCallsTotal: 200,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              explicitAttributeVerification: false,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.updateDescriptorCertifiedAttribute(
        eservice.id,
        descriptor.id,
        99,
        certifiedAttribute.id,
        { dailyCallsPerConsumer: 100 },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      certifiedAttributeGroupNotFoundInSeed(eservice.id, descriptor.id)
    );
  });

  it("should throw attributeNotFound if attributeId is not in the group", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    const otherAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(otherAttribute);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      dailyCallsTotal: 200,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              explicitAttributeVerification: false,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.updateDescriptorCertifiedAttribute(
        eservice.id,
        descriptor.id,
        0,
        otherAttribute.id,
        { dailyCallsPerConsumer: 100 },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(attributeNotFound(otherAttribute.id));
  });
});
