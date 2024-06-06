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
} from "pagopa-interop-models";
import { UserResponse } from "pagopa-interop-selfcare-v2-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addOneAttribute,
  addOneEService,
  addOneTenant,
  agreementService,
  agreements,
  eservices,
  selfcareV2ClientMock,
  tenants,
} from "./utils.js";

describe("Upgrade suspended agreement activation", () => {
  const mockSelfcareUserResponse: UserResponse = {
    email: "test@test.com",
    name: "Test Name",
    surname: "Test Surname",
    id: generateId(),
    taxCode: "TSTTSTTSTTSTTSTT",
  };
  beforeEach(async () => {
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
      async () => mockSelfcareUserResponse
    );
  });

  async function updateAgreementInReadModel(
    agreement: Agreement,
    currentVersion: number
  ): Promise<void> {
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

  it("should keep an agreement suspended if it was already suspended", async () => {
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
      attributes: [
        validCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
        // validVerifiedTenantAttribute,
      ],
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
      creationTime: new Date(new Date().getFullYear() - 1),
    });
    await addOneAttribute({
      id: validDeclaredEserviceAttribute.id,
      kind: attributeKind.declared,
      description: "A declared attribute",
      name: "A declared attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    });

    /* ================================= 
        1) Consumer creates an Agreement
    ================================= */
    const consumerAuthData = getRandomAuthData(consumer.id);
    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId,
        descriptorId,
      },
      {
        authData: consumerAuthData,
        serviceName: "",
        correlationId: "",
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
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    expect(submittedAgreement.state).toEqual(agreementState.active);
    await updateAgreementInReadModel(submittedAgreement, 0);

    /* ================================= 
        3) Consumer suspends agreement
    ================================= */
    const suspendedAgreement = await agreementService.suspendAgreement(
      submittedAgreement.id,
      {
        authData: consumerAuthData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    expect(suspendedAgreement.state).toEqual(agreementState.suspended);
    expect(suspendedAgreement.suspendedByConsumer).toEqual(true);
    expect(suspendedAgreement.suspendedByProducer).toEqual(undefined);
    expect(suspendedAgreement.suspendedByPlatform).toEqual(false);
    await updateAgreementInReadModel(suspendedAgreement, 1);

    /* ================================= 
        4) creazione nuovo descriptor V2
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
        5) upgrade da parte del fruitore
    ================================= */

    const upgradedAgreement = await agreementService.upgradeAgreement(
      suspendedAgreement.id,
      {
        authData: consumerAuthData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    expect(upgradedAgreement.state).toEqual(agreementState.draft);
    expect(upgradedAgreement.suspendedByConsumer).toEqual(true);
    expect(upgradedAgreement.suspendedByProducer).toEqual(undefined);
    expect(upgradedAgreement.suspendedByPlatform).toEqual(false);
    await writeInReadmodel(toReadModelAgreement(upgradedAgreement), agreements);

    /* ================================= 
      6) Submit da parte del fruitore per far andare l'agreement in stato di PENDING
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
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    expect(submittedUpgradedAgreement.state).toEqual(agreementState.pending);
    await updateAgreementInReadModel(submittedUpgradedAgreement, 0);

    /* ================================= 
      7) Verifica attributi da parte dell'erogatore
    ================================= */

    const validVerifiedTenantAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(validVerifiedEserviceAttribute.id),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
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
          data: updatedConsumer,
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
      creationTime: new Date(new Date().getFullYear() - 1),
    });

    /* ================================= 
      7) Attivazione dell'Agreement da parte dell'erogatore
    ================================= */

    const producerAuthData = getRandomAuthData(producer.id);

    const activatedAgreement = await agreementService.activateAgreement(
      submittedUpgradedAgreement.id,
      {
        authData: producerAuthData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    await updateAgreementInReadModel(activatedAgreement, 1);

    // Expected
    // Perché era stato sospeso dal fruitore, e ad attivarlo è stato l'erogatore
    expect(activatedAgreement.state).toEqual(agreementState.suspended);

    // Actual
    // expect(activatedAgreement.state).toEqual(agreementState.active);
  });
});
