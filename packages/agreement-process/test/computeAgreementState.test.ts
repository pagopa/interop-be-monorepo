import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementSuspendedByPlatformV2,
  AttributeId,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger, userRoles } from "pagopa-interop-commons";
import {
  addOneAgreement,
  addOneEService,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";

describe("compute Agreement state", () => {
  it("should update the state of Agreements to Suspended or MissingCertifiedAttributs when the given attribute is not satisfied", async () => {
    const authData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.INTERNAL_ROLE],
    };

    // Create a consumer with a certified attribute that has been invalidated,
    // and use this attribute and consumer as input to computeAgreementState
    const invalidatedAttributeId: AttributeId = generateId();
    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(invalidatedAttributeId),
          revocationTimestamp: new Date(),
        },
      ],
    };

    const descriptor1: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(invalidatedAttributeId)]],
        declared: [[getMockEServiceAttribute()]],
        verified: [[getMockEServiceAttribute()]],
      },
    };
    const eservice1: EService = {
      ...getMockEService(),
      producerId: generateId(),
      descriptors: [descriptor1],
    };

    const descriptor2: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(invalidatedAttributeId)]],
        declared: [[getMockEServiceAttribute()]],
        verified: [[getMockEServiceAttribute()]],
      },
    };

    const eservice2: EService = {
      ...getMockEService(),
      producerId: generateId(),
      descriptors: [descriptor2],
    };

    const updatableAgreement1: Agreement = {
      ...getMockAgreement(
        eservice1.id,
        consumer.id,
        randomArrayItem([agreementState.draft, agreementState.pending])
      ),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
      suspendedByPlatform: false,
    };

    const updatableAgreement2: Agreement = {
      ...getMockAgreement(eservice2.id, consumer.id, agreementState.active),
      descriptorId: eservice2.descriptors[0].id,
      producerId: eservice2.producerId,
      suspendedByPlatform: false,
    };

    const nonUpdatableAgreement = {
      ...getMockAgreement(
        eservice1.id,
        consumer.id,
        randomArrayItem([agreementState.archived, agreementState.rejected])
      ),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
    };

    await addOneEService(eservice1);
    await addOneEService(eservice2);
    await addOneAgreement(updatableAgreement1);
    await addOneAgreement(updatableAgreement2);
    await addOneAgreement(nonUpdatableAgreement);
    // await addOneAgreement(updatableAgreement3);
    // await addOneAgreement(updatableAgreement4);

    await agreementService.computeAgreementsStateByAttribute(
      invalidatedAttributeId,
      consumer,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    const nonUpdatableAgreementStateUpdateEvent = await readLastAgreementEvent(
      nonUpdatableAgreement.id
    );

    expect(nonUpdatableAgreementStateUpdateEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: nonUpdatableAgreement.id,
    });

    const agreement1StateUpdateEvent = await readLastAgreementEvent(
      updatableAgreement1.id
    );

    expect(agreement1StateUpdateEvent).toMatchObject({
      type: "AgreementPutInMissingCertifiedAttributesByPlatform",
      event_version: 2,
      version: "1",
      stream_id: updatableAgreement1.id,
    });

    const agreement1StateUpdateEventData = decodeProtobufPayload({
      messageType: AgreementSuspendedByPlatformV2,
      payload: agreement1StateUpdateEvent.data,
    });

    expect(agreement1StateUpdateEventData).toMatchObject({
      agreement: toAgreementV2({
        ...updatableAgreement1,
        state: agreementState.missingCertifiedAttributes,
        suspendedByPlatform: true,
      }),
    });

    const agreement2StateUpdateEvent = await readLastAgreementEvent(
      updatableAgreement2.id
    );

    expect(agreement2StateUpdateEvent).toMatchObject({
      type: "AgreementSuspendedByPlatform",
      event_version: 2,
      version: "1",
      stream_id: updatableAgreement2.id,
    });

    const agreement2StateUpdateEventData = decodeProtobufPayload({
      messageType: AgreementSuspendedByPlatformV2,
      payload: agreement2StateUpdateEvent.data,
    });

    expect(agreement2StateUpdateEventData).toMatchObject({
      agreement: toAgreementV2({
        ...updatableAgreement2,
        state: agreementState.suspended,
        suspendedByPlatform: true,
      }),
    });
  });
});
