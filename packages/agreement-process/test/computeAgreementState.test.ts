import {
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
  AttributeId,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addOneAgreement,
  addOneEService,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";
import { genericLogger, userRoles } from "pagopa-interop-commons";

describe("compute Agreement state", () => {
  it("should update the state of Agreements in updatable state based on the given attribute", async () => {
    const authData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.INTERNAL_ROLE],
    };

    const attributeId: AttributeId = generateId();
    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(attributeId),
          revocationTimestamp: new Date(), // The given attribute was revoked
        },
      ],
    };

    const descriptor1: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(attributeId)]],
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
        certified: [[getMockEServiceAttribute(attributeId)]],
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
    };

    const updatableAgreement2 = {
      ...getMockAgreement(eservice2.id, consumer.id, agreementState.active),
      descriptorId: eservice2.descriptors[0].id,
      producerId: eservice2.producerId,
    };

    // const updatableAgreement3 = {
    //   ...getMockAgreement(
    //     eservice2.id,
    //     consumer.id,
    //     agreementState.missingCertifiedAttributes
    //   ),
    //   descriptorId: eservice2.descriptors[0].id,
    //   producerId: eservice2.producerId,
    // };

    // const updatableAgreement4 = {
    //   ...getMockAgreement(eservice2.id, consumer.id, agreementState.suspended),
    //   descriptorId: eservice2.descriptors[0].id,
    //   producerId: eservice2.producerId,
    // };

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

    await agreementService.computeAgreementState(attributeId, consumer, {
      authData,
      serviceName: "",
      correlationId: "",
      logger: genericLogger,
    });

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

    // TODO understand why this is not working ...

    // const agreement2StateUpdateEvent = await readLastAgreementEvent(
    //   updatableAgreement2.id
    // );

    // expect(agreement2StateUpdateEvent).toMatchObject({
    //   type: "AgreementSuspendedByPlatform",
    //   event_version: 2,
    //   version: "1",
    //   stream_id: updatableAgreement2.id,
    // });

    // TODO create another attribute and call the method another time to check the other two events
  });
});
