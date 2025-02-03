/* eslint-disable functional/immutable-data */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Tenant,
  VerifiedTenantAttribute,
  agreementState,
  attributeKind,
  descriptorState,
  generateId,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { addDays, subDays } from "date-fns";
import {
  addOneAttribute,
  addOneEService,
  addOneTenant,
  agreementService,
  agreements,
  eservices,
  tenants,
} from "./utils.js";

describe("Agreeement states flows", () => {
  async function updateAgreementInReadModel(
    agreement: Agreement
  ): Promise<void> {
    const currentVersion = (
      await agreements.findOne({
        "data.id": agreement.id,
      })
    )?.metadata.version;

    if (currentVersion === undefined) {
      throw new Error("Agreement not found in read model. Cannot update.");
    }

    await agreements.updateOne(
      {
        "data.id": agreement.id,
        "metadata.version": currentVersion,
      },
      {
        $set: {
          data: toReadModelAgreement(agreement),
          metadata: {
            version: currentVersion + 1,
          },
        },
      }
    );
  }

  it("agreement for descriptor V1 >> suspended by consumer >> V2 with new verified attributes >> upgrade >> producer verifies attributes and activates >> should still be SUSPENDED by consumer", async () => {
    /* Test added in https://github.com/pagopa/interop-be-monorepo/pull/619 to
    verify the fix for https://pagopa.atlassian.net/browse/IMN-587 -- before the fix,
    the resulting final state was ACTIVE, instead of SUSPENDED by consumer. */

    const producer = getMockTenant();

    const validCertifiedTenantAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const validDeclaredTenantAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validDeclaredEserviceAttribute = getMockEServiceAttribute(
      validDeclaredTenantAttribute.id
    );

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [validCertifiedTenantAttribute, validDeclaredTenantAttribute],
      selfcareId: generateId(),
      mails: [
        {
          id: "521467f9-bdc7-41e3-abf1-49c8c174e1ac",
          kind: "CONTACT_EMAIL",
          address: "testerforAgreementimpossibile@testbug.pagopa.org",
          createdAt: new Date(),
        },
      ],
    };

    const descriptorId = generateId<DescriptorId>();
    const descriptorV1: Descriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]]
        // No verified attributes required in V1
      ),
      version: "1",
      agreementApprovalPolicy: "Automatic",
    };

    const eserviceId = generateId<EServiceId>();
    const eservice: EService = {
      ...getMockEService(eserviceId, producer.id, [descriptorV1]),
    };

    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAttribute({
      id: validCertifiedEserviceAttribute.id,
      kind: attributeKind.certified,
      description: "A certified attribute",
      name: "A certified attribute name",
      creationTime: subDays(new Date(), 1),
    });
    await addOneAttribute({
      id: validDeclaredEserviceAttribute.id,
      kind: attributeKind.declared,
      description: "A declared attribute",
      name: "A declared attribute name",
      creationTime: subDays(new Date(), 1),
    });

    /* =================================
      1) Consumer creates the agreement (state DRAFT)
    ================================= */
    const consumerAuthData = getRandomAuthData(consumer.id);
    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId,
        descriptorId,
      },
      {
        authData: consumerAuthData,
        serviceName: "AgreementService",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(createdAgreement.state).toEqual(agreementState.draft);
    await writeInReadmodel(toReadModelAgreement(createdAgreement), agreements);

    /* =================================
      2) Consumer submits the agreement (making it Active)
    ================================= */
    const submittedAgreement = await agreementService.submitAgreement(
      createdAgreement.id,
      {
        consumerNotes: "Some notes here!",
      },
      {
        authData: consumerAuthData,
        serviceName: "AgreementService",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(submittedAgreement.state).toEqual(agreementState.active);
    await updateAgreementInReadModel(submittedAgreement);

    /* =================================
      3) Consumer suspends the agreement (make it SUSPENDED byConsumer)
    ================================= */
    const suspendedAgreement = await agreementService.suspendAgreement(
      submittedAgreement.id,
      {
        authData: consumerAuthData,
        serviceName: "Agreement Service",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(suspendedAgreement.state).toEqual(agreementState.suspended);
    expect(suspendedAgreement.suspendedByConsumer).toEqual(true);
    expect(suspendedAgreement.suspendedByProducer).toEqual(undefined);
    expect(suspendedAgreement.suspendedByPlatform).toEqual(false);
    await updateAgreementInReadModel(suspendedAgreement);

    /* =================================
      4) Someone adds a new descriptor (V2) with verified attributes
    ================================= */
    const validVerifiedEserviceAttribute = getMockEServiceAttribute();

    const descriptorV2: Descriptor = {
      ...descriptorV1,
      id: generateId(),
      version: "2",
      attributes: {
        certified: descriptorV1.attributes.certified,
        declared: descriptorV1.attributes.declared,
        verified: [[validVerifiedEserviceAttribute]],
      },
    };

    const updatedEservice: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptorV1,
          state: descriptorState.suspended,
        },
        descriptorV2,
      ],
    };

    await eservices.updateOne(
      {
        "data.id": updatedEservice.id,
        "metadata.version": 0,
      },
      {
        $set: {
          data: toReadModelEService(updatedEservice),
          metadata: {
            version: 1,
          },
        },
      }
    );

    /* =================================
      5) Consumer upgrades the Agreement
    ================================= */
    const upgradedAgreement = await agreementService.upgradeAgreement(
      suspendedAgreement.id,
      {
        authData: consumerAuthData,
        serviceName: "Agreement Service",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(upgradedAgreement.state).toEqual(agreementState.draft);
    expect(upgradedAgreement.suspendedByConsumer).toEqual(true);
    expect(upgradedAgreement.suspendedByProducer).toEqual(undefined);
    expect(upgradedAgreement.suspendedByPlatform).toEqual(undefined);
    await writeInReadmodel(toReadModelAgreement(upgradedAgreement), agreements);

    /* =================================
      6) Producer submits the agreement to make it PENDING
      (valid att CERTIFIED and DECLARED)
    ================================= */
    const submittedUpgradedAgreement = await agreementService.submitAgreement(
      upgradedAgreement.id,
      {
        consumerNotes:
          "This upgrade is for transit agreement state to PENDING!",
      },
      {
        authData: consumerAuthData,
        serviceName: "Agreement Service",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(submittedUpgradedAgreement.state).toEqual(agreementState.pending);
    await updateAgreementInReadModel(submittedUpgradedAgreement);

    /* =================================
      7) Producer updates Verified Attributes
    ================================= */
    const validVerifiedTenantAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(validVerifiedEserviceAttribute.id),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: subDays(new Date(), 1),
          expirationDate: addDays(new Date(), 30),
          extensionDate: undefined,
        },
      ],
      revokedBy: [],
    };

    const updatedConsumer = {
      ...consumer,
      attributes: [...consumer.attributes, validVerifiedTenantAttribute],
    };

    await tenants.updateOne(
      {
        "data.id": updatedConsumer.id,
        "metadata.version": 0,
      },
      {
        $set: {
          data: toReadModelTenant(updatedConsumer),
          metadata: {
            version: 1,
          },
        },
      }
    );

    await addOneAttribute({
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: subDays(new Date(), 1),
    });

    /* =================================
      8) Agreement activation by producer (state remains SUSPENDED)

      After the producer attempted to activate the upgraded agreement,
      it was expected that the state would remain SUSPENDED.
      In this case, the agreement was originally suspended by the consumer,
      but the activation was performed by the producer, so it must remain suspended.
      During this execution flow, the newly created draft agreement still preserves the suspension flags and PENDING state.
    ================================= */

    const producerAuthData = getRandomAuthData(producer.id);

    const activatedAgreement = await agreementService.activateAgreement(
      submittedUpgradedAgreement.id,
      {
        authData: producerAuthData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    await updateAgreementInReadModel(activatedAgreement);

    expect(activatedAgreement.state).toEqual(agreementState.suspended);
  });

  it("agreement for descriptor V1 >> suspended by producer >> V2 with new verified attributes >> upgrade >> producer verifies attributes and activates >> should become ACTIVE", async () => {
    const producer = getMockTenant();

    const validCertifiedTenantAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const validDeclaredTenantAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validDeclaredEserviceAttribute = getMockEServiceAttribute(
      validDeclaredTenantAttribute.id
    );

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [validCertifiedTenantAttribute, validDeclaredTenantAttribute],
      selfcareId: generateId(),
      mails: [
        {
          id: "521467f9-bdc7-41e3-abf1-49c8c174e1ac",
          kind: "CONTACT_EMAIL",
          address: "testerforAgreementimpossibile@testbug.pagopa.org",
          createdAt: new Date(),
        },
      ],
    };

    const descriptorId = generateId<DescriptorId>();
    const descriptorV1: Descriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]]
        // No verified attributes required in V1
      ),
      version: "1",
      agreementApprovalPolicy: "Automatic",
    };

    const eserviceId = generateId<EServiceId>();
    const eservice: EService = {
      ...getMockEService(eserviceId, producer.id, [descriptorV1]),
    };

    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAttribute({
      id: validCertifiedEserviceAttribute.id,
      kind: attributeKind.certified,
      description: "A certified attribute",
      name: "A certified attribute name",
      creationTime: subDays(new Date(), 1),
    });
    await addOneAttribute({
      id: validDeclaredEserviceAttribute.id,
      kind: attributeKind.declared,
      description: "A declared attribute",
      name: "A declared attribute name",
      creationTime: subDays(new Date(), 1),
    });

    /* =================================
      1) Consumer creates the agreement (state DRAFT)
    ================================= */
    const consumerAuthData = getRandomAuthData(consumer.id);
    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId,
        descriptorId,
      },
      {
        authData: consumerAuthData,
        serviceName: "AgreementService",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(createdAgreement.state).toEqual(agreementState.draft);
    await writeInReadmodel(toReadModelAgreement(createdAgreement), agreements);

    /* =================================
      2) Consumer submits the agreement (making it Active)
    ================================= */
    const submittedAgreement = await agreementService.submitAgreement(
      createdAgreement.id,
      {
        consumerNotes: "Some notes here!",
      },
      {
        authData: consumerAuthData,
        serviceName: "AgreementService",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(submittedAgreement.state).toEqual(agreementState.active);
    await updateAgreementInReadModel(submittedAgreement);

    /* =================================
      4) Someone adds a new descriptor (V2) with verified attributes
    ================================= */
    const validVerifiedEserviceAttribute = getMockEServiceAttribute();

    const descriptorV2: Descriptor = {
      ...descriptorV1,
      id: generateId(),
      version: "2",
      attributes: {
        certified: descriptorV1.attributes.certified,
        declared: descriptorV1.attributes.declared,
        verified: [[validVerifiedEserviceAttribute]],
      },
    };

    const updatedEservice: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptorV1,
          state: descriptorState.suspended,
        },
        descriptorV2,
      ],
    };

    await eservices.updateOne(
      {
        "data.id": updatedEservice.id,
        "metadata.version": 0,
      },
      {
        $set: {
          data: toReadModelEService(updatedEservice),
          metadata: {
            version: 1,
          },
        },
      }
    );

    /* =================================
      5) Consumer upgrades the Agreement
    ================================= */
    const upgradedAgreement = await agreementService.upgradeAgreement(
      submittedAgreement.id,
      {
        authData: consumerAuthData,
        serviceName: "Agreement Service",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(upgradedAgreement.state).toEqual(agreementState.draft);
    expect(upgradedAgreement.suspendedByConsumer).toEqual(undefined);
    expect(upgradedAgreement.suspendedByProducer).toEqual(undefined);
    expect(upgradedAgreement.suspendedByPlatform).toEqual(undefined);
    await writeInReadmodel(toReadModelAgreement(upgradedAgreement), agreements);

    /* =================================
      6) Producer submits the agreement to make it PENDING
      (valid att CERTIFIED and DECLARED)
    ================================= */
    const submittedUpgradedAgreement = await agreementService.submitAgreement(
      upgradedAgreement.id,
      {
        consumerNotes:
          "This upgrade is for transit agreement state to PENDING!",
      },
      {
        authData: consumerAuthData,
        serviceName: "Agreement Service",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    expect(submittedUpgradedAgreement.state).toEqual(agreementState.pending);
    await updateAgreementInReadModel(submittedUpgradedAgreement);

    /* =================================
      7) Producer updates Verified Attributes
    ================================= */
    const validVerifiedTenantAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(validVerifiedEserviceAttribute.id),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: subDays(new Date(), 1),
          expirationDate: addDays(new Date(), 30),
          extensionDate: undefined,
        },
      ],
      revokedBy: [],
    };

    const updatedConsumer = {
      ...consumer,
      attributes: [...consumer.attributes, validVerifiedTenantAttribute],
    };

    await tenants.updateOne(
      {
        "data.id": updatedConsumer.id,
        "metadata.version": 0,
      },
      {
        $set: {
          data: toReadModelTenant(updatedConsumer),
          metadata: {
            version: 1,
          },
        },
      }
    );

    await addOneAttribute({
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: subDays(new Date(), 1),
    });

    /* =================================
      8) Agreement activation by producer (state becomes ACTIVE)
    ================================= */

    const producerAuthData = getRandomAuthData(producer.id);

    const activatedAgreement = await agreementService.activateAgreement(
      submittedUpgradedAgreement.id,
      {
        authData: producerAuthData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    await updateAgreementInReadModel(activatedAgreement);

    expect(activatedAgreement.state).toEqual(agreementState.active);
  });
});
