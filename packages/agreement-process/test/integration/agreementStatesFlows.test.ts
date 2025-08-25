/* eslint-disable functional/immutable-data */
import {
  getMockCertifiedTenantAttribute,
  getMockContext,
  getMockDeclaredTenantAttribute,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getMockAuthData,
  getMockDescriptorPublished,
} from "pagopa-interop-commons-test";
import {
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
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { addDays, subDays } from "date-fns";
import {
  writeOnlyOneAgreement,
  updateAgreementInReadModel,
  updateOneEService,
  updateOneTenant,
  addOneAttribute,
  addOneEService,
  addOneTenant,
  agreementService,
} from "../integrationUtils.js";

describe("Agreement states flows", () => {
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
    const consumerAuthData = getMockAuthData(consumer.id);
    const { data: createdAgreement } = await agreementService.createAgreement(
      {
        eserviceId,
        descriptorId,
      },
      getMockContext({ authData: consumerAuthData })
    );

    expect(createdAgreement.state).toEqual(agreementState.draft);
    await writeOnlyOneAgreement(createdAgreement);

    /* =================================
      2) Consumer submits the agreement (making it Active)
    ================================= */
    const { data: submittedAgreement } = await agreementService.submitAgreement(
      createdAgreement.id,
      {
        consumerNotes: "Some notes here!",
      },
      getMockContext({ authData: consumerAuthData })
    );

    expect(submittedAgreement.state).toEqual(agreementState.active);
    await updateAgreementInReadModel(submittedAgreement);

    /* =================================
      3) Consumer suspends the agreement (make it SUSPENDED byConsumer)
    ================================= */
    const { data: suspendedAgreement } =
      await agreementService.suspendAgreement(
        { agreementId: submittedAgreement.id, delegationId: undefined },
        getMockContext({ authData: consumerAuthData })
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
    await updateOneEService(updatedEservice);

    /* =================================
      5) Consumer upgrades the Agreement
    ================================= */
    const { data: upgradedAgreement } = await agreementService.upgradeAgreement(
      suspendedAgreement.id,
      getMockContext({ authData: consumerAuthData })
    );

    expect(upgradedAgreement.state).toEqual(agreementState.draft);
    expect(upgradedAgreement.suspendedByConsumer).toEqual(true);
    expect(upgradedAgreement.suspendedByProducer).toEqual(undefined);
    expect(upgradedAgreement.suspendedByPlatform).toEqual(undefined);
    await writeOnlyOneAgreement(upgradedAgreement);

    /* =================================
      6) Producer submits the agreement to make it PENDING
      (valid att CERTIFIED and DECLARED)
    ================================= */
    const { data: submittedUpgradedAgreement } =
      await agreementService.submitAgreement(
        upgradedAgreement.id,
        {
          consumerNotes:
            "This upgrade is for transit agreement state to PENDING!",
        },
        getMockContext({ authData: consumerAuthData })
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

    await updateOneTenant(updatedConsumer);

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

    const producerAuthData = getMockAuthData(producer.id);

    const { data: activatedAgreement } =
      await agreementService.activateAgreement(
        { agreementId: submittedUpgradedAgreement.id, delegationId: undefined },
        getMockContext({ authData: producerAuthData })
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
    const consumerAuthData = getMockAuthData(consumer.id);
    const { data: createdAgreement } = await agreementService.createAgreement(
      {
        eserviceId,
        descriptorId,
      },
      getMockContext({ authData: consumerAuthData })
    );

    expect(createdAgreement.state).toEqual(agreementState.draft);
    await writeOnlyOneAgreement(createdAgreement);

    /* =================================
      2) Consumer submits the agreement (making it Active)
    ================================= */
    const { data: submittedAgreement } = await agreementService.submitAgreement(
      createdAgreement.id,
      {
        consumerNotes: "Some notes here!",
      },
      getMockContext({ authData: consumerAuthData })
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

    await updateOneEService(updatedEservice);

    /* =================================
      5) Consumer upgrades the Agreement
    ================================= */
    const { data: upgradedAgreement } = await agreementService.upgradeAgreement(
      submittedAgreement.id,
      getMockContext({ authData: consumerAuthData })
    );

    expect(upgradedAgreement.state).toEqual(agreementState.draft);
    expect(upgradedAgreement.suspendedByConsumer).toEqual(undefined);
    expect(upgradedAgreement.suspendedByProducer).toEqual(undefined);
    expect(upgradedAgreement.suspendedByPlatform).toEqual(undefined);
    await writeOnlyOneAgreement(upgradedAgreement);

    /* =================================
      6) Producer submits the agreement to make it PENDING
      (valid att CERTIFIED and DECLARED)
    ================================= */
    const { data: submittedUpgradedAgreement } =
      await agreementService.submitAgreement(
        upgradedAgreement.id,
        {
          consumerNotes:
            "This upgrade is for transit agreement state to PENDING!",
        },
        getMockContext({ authData: consumerAuthData })
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

    await updateOneTenant(updatedConsumer);

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

    const producerAuthData = getMockAuthData(producer.id);

    const { data: activatedAgreement } =
      await agreementService.activateAgreement(
        { agreementId: submittedUpgradedAgreement.id, delegationId: undefined },
        getMockContext({ authData: producerAuthData })
      );

    await updateAgreementInReadModel(activatedAgreement);

    expect(activatedAgreement.state).toEqual(agreementState.active);
  });
});
