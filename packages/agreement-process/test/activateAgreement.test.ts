/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fileURLToPath } from "url";
import path from "path";
import {
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  genericLogger,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  randomArrayItem,
  randomBoolean,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementActivatedV2,
  AgreementContractPDFPayload,
  AgreementId,
  AgreementSetMissingCertifiedAttributesByPlatformV2,
  AgreementSuspendedByPlatformV2,
  AgreementUnsuspendedByConsumerV2,
  AgreementUnsuspendedByPlatformV2,
  AgreementUnsuspendedByProducerV2,
  Attribute,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  TenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  attributeKind,
  delegationKind,
  delegationState,
  descriptorState,
  fromAgreementV2,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { addDays } from "date-fns";
import {
  agreementActivableStates,
  agreementActivationAllowedDescriptorStates,
  agreementArchivableStates,
} from "../src/model/domain/agreement-validators.js";
import {
  agreementActivationFailed,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementStampNotFound,
  attributeNotFound,
  descriptorNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  operationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  fileManager,
  pdfGenerator,
  readAgreementEventByVersion,
  readLastAgreementEvent,
} from "./utils.js";

describe("activate agreement", () => {
  async function addRelatedAgreements(agreement: Agreement): Promise<{
    archivableRelatedAgreement1: Agreement;
    archivableRelatedAgreement2: Agreement;
    nonArchivableRelatedAgreement: Agreement;
  }> {
    const archivableRelatedAgreement1: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(agreementArchivableStates),
    };

    const archivableRelatedAgreement2: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(agreementArchivableStates),
    };

    const nonArchivableRelatedAgreement: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementArchivableStates.includes(state)
        )
      ),
    };

    await addOneAgreement(archivableRelatedAgreement1);
    await addOneAgreement(archivableRelatedAgreement2);
    await addOneAgreement(nonArchivableRelatedAgreement);
    return {
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    };
  }

  async function testRelatedAgreementsArchiviation(relatedAgreements: {
    archivableRelatedAgreement1: Agreement;
    archivableRelatedAgreement2: Agreement;
    nonArchivableRelatedAgreement: Agreement;
  }): Promise<void> {
    // Verifying archiviation relating agreements
    const archiveEvent1 = await readLastAgreementEvent(
      relatedAgreements.archivableRelatedAgreement1.id
    );
    const archiveEvent2 = await readLastAgreementEvent(
      relatedAgreements.archivableRelatedAgreement2.id
    );
    const nonArchivedAgreementEvent = await readLastAgreementEvent(
      relatedAgreements.nonArchivableRelatedAgreement.id
    );

    expect(archiveEvent1).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: relatedAgreements.archivableRelatedAgreement1.id,
    });

    expect(archiveEvent2).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: relatedAgreements.archivableRelatedAgreement2.id,
    });

    expect(nonArchivedAgreementEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: relatedAgreements.nonArchivableRelatedAgreement.id,
    });
  }

  describe("Agreement Pending", () => {
    it("Agreement Pending, Requester === Producer, valid attributes -- success case: Pending >> Activated", async () => {
      vi.spyOn(pdfGenerator, "generate");
      const producer: Tenant = getMockTenant();

      const certifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Certified",
      };

      const declaredAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Declared",
      };

      const verifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Verified",
      };

      const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
        revocationTimestamp: undefined,
      };

      const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(declaredAttribute.id),
        revocationTimestamp: undefined,
      };

      const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
        verifiedBy: [
          {
            id: producer.id,
            verificationDate: new Date(),
            extensionDate: addDays(new Date(), 30),
          },
        ],
      };

      const consumer: Tenant = {
        ...getMockTenant(),
        selfcareId: generateId(),
        attributes: [
          validTenantCertifiedAttribute,
          validTenantDeclaredAttribute,
          validTenantVerifiedAttribute,
        ],
      };

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified: [
            [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
          ],
          declared: [
            [getMockEServiceAttribute(validTenantDeclaredAttribute.id)],
          ],
          verified: [
            [getMockEServiceAttribute(validTenantVerifiedAttribute.id)],
          ],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
        suspendedByProducer: randomBoolean(), // will be set to false by the activation
        stamps: {
          submission: {
            who: authData.userId,
            when: new Date(),
          },
          activation: undefined,
        },

        // Adding some random attributes to check that they are overwritten by the activation
        certifiedAttributes: [getMockAgreementAttribute()],
        declaredAttributes: [getMockAgreementAttribute()],
        verifiedAttributes: [getMockAgreementAttribute()],
      };

      await addOneAgreement(agreement);
      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAttribute(certifiedAttribute);
      await addOneAttribute(declaredAttribute);
      await addOneAttribute(verifiedAttribute);
      const relatedAgreements = await addRelatedAgreements(agreement);

      const acrivateAgreementReturnValue =
        await agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        });

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: "AgreementActivated",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreementActivated = fromAgreementV2(
        decodeProtobufPayload({
          messageType: AgreementActivatedV2,
          payload: agreementEvent.data,
        }).agreement!
      );

      const contractDocumentId = actualAgreementActivated.contract!.id;
      const contractCreatedAt = actualAgreementActivated.contract!.createdAt;
      const contractDocumentName = `${consumer.id}_${
        producer.id
      }_${formatDateyyyyMMddHHmmss(contractCreatedAt)}_agreement_contract.pdf`;

      const expectedContract = {
        id: contractDocumentId,
        contentType: "application/pdf",
        createdAt: contractCreatedAt,
        path: `${config.agreementContractsPath}/${agreement.id}/${contractDocumentId}/${contractDocumentName}`,
        prettyName: "Richiesta di fruizione",
        name: contractDocumentName,
      };

      const expectedActivatedAgreement: Agreement = {
        ...agreement,
        state: agreementState.active,
        stamps: {
          ...agreement.stamps,
          activation: {
            who: authData.userId,
            when: actualAgreementActivated.stamps.activation!.when,
          },
        },
        certifiedAttributes: [{ id: certifiedAttribute.id }],
        declaredAttributes: [{ id: declaredAttribute.id }],
        verifiedAttributes: [{ id: verifiedAttribute.id }],
        contract: expectedContract,
        suspendedByProducer: false,
        suspendedByConsumer: false,
        suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
      };

      expect(actualAgreementActivated).toMatchObject(
        expectedActivatedAgreement
      );

      expect(pdfGenerator.generate).toHaveBeenCalledWith(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../src",
          "resources/templates/documents/",
          "agreementContractTemplate.html"
        ),
        {
          todayDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
          todayTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
          agreementId: expectedActivatedAgreement.id,
          submitterId: expectedActivatedAgreement.stamps.submission!.who,
          submissionDate: dateAtRomeZone(
            expectedActivatedAgreement.stamps.submission!.when
          ),
          submissionTime: timeAtRomeZone(
            expectedActivatedAgreement.stamps.submission!.when
          ),
          activatorId: expectedActivatedAgreement.stamps.activation!.who,
          activationDate: dateAtRomeZone(
            expectedActivatedAgreement.stamps.activation!.when
          ),
          activationTime: timeAtRomeZone(
            expectedActivatedAgreement.stamps.activation!.when
          ),
          eserviceId: eservice.id,
          eserviceName: eservice.name,
          descriptorId: eservice.descriptors[0].id,
          descriptorVersion: eservice.descriptors[0].version,
          producerName: producer.name,
          producerIpaCode: producer.externalId.value,

          consumerName: consumer.name,
          consumerIpaCode: consumer.externalId.value,
          certifiedAttributes: [
            {
              assignmentDate: dateAtRomeZone(
                validTenantCertifiedAttribute.assignmentTimestamp
              ),
              assignmentTime: timeAtRomeZone(
                validTenantCertifiedAttribute.assignmentTimestamp
              ),
              attributeName: certifiedAttribute.name,
              attributeId: validTenantCertifiedAttribute.id,
            },
          ],
          declaredAttributes: [
            {
              assignmentDate: dateAtRomeZone(
                validTenantDeclaredAttribute.assignmentTimestamp
              ),
              assignmentTime: timeAtRomeZone(
                validTenantDeclaredAttribute.assignmentTimestamp
              ),
              attributeName: declaredAttribute.name,
              attributeId: validTenantDeclaredAttribute.id,
            },
          ],
          verifiedAttributes: [
            {
              assignmentDate: dateAtRomeZone(
                validTenantVerifiedAttribute.assignmentTimestamp
              ),
              assignmentTime: timeAtRomeZone(
                validTenantVerifiedAttribute.assignmentTimestamp
              ),
              attributeName: verifiedAttribute.name,
              attributeId: validTenantVerifiedAttribute.id,
              expirationDate: dateAtRomeZone(
                validTenantVerifiedAttribute.verifiedBy[0].extensionDate!
              ),
            },
          ],
        }
      );

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(expectedContract.path);

      await testRelatedAgreementsArchiviation(relatedAgreements);
      expect(acrivateAgreementReturnValue).toMatchObject(
        expectedActivatedAgreement
      );
    });

    it("Agreement Pending, Requester === Producer, invalid certified attributes -- error case: throws agreementActivationFailed and sets the agreement to MissingCertifiedAttributes", async () => {
      const producer: Tenant = getMockTenant();

      const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        revocationTimestamp: undefined,
      };

      const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: producer.id,
            verificationDate: new Date(),
            extensionDate: addDays(new Date(), 30),
          },
        ],
      };

      const consumer: Tenant = {
        ...getMockTenant(),
        attributes: [
          revokedTenantCertifiedAttribute,
          validTenantDeclaredAttribute,
          validTenantVerifiedAttribute,
        ],
      };

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified: [
            [getMockEServiceAttribute(revokedTenantCertifiedAttribute.id)],
          ],
          declared: [
            [getMockEServiceAttribute(validTenantDeclaredAttribute.id)],
          ],
          verified: [
            [getMockEServiceAttribute(validTenantVerifiedAttribute.id)],
          ],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedByPlatform: false, // Must be false, otherwise no event is created
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementActivationFailed(agreement.id));

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: "AgreementSetMissingCertifiedAttributesByPlatform",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreement = fromAgreementV2(
        decodeProtobufPayload({
          messageType: AgreementSetMissingCertifiedAttributesByPlatformV2,
          payload: agreementEvent.data,
        }).agreement!
      );

      const expectedAgreement: Agreement = {
        ...agreement,
        state: agreementState.missingCertifiedAttributes,
        suspendedByPlatform: true,
      };

      expect(actualAgreement).toMatchObject(expectedAgreement);
    });

    it("Agreement Pending, Requester === Producer, invalid attributes -- error case: throws agreementActivationFailed", async () => {
      const producer: Tenant = getMockTenant();

      const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute =
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            { id: generateId<TenantId>(), verificationDate: new Date() },
          ],
        };

      const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producer.id,
              verificationDate: new Date(),
              extensionDate: new Date(),
            },
          ],
        };

      const consumerInvalidAttribute: TenantAttribute = randomArrayItem([
        revokedTenantCertifiedAttribute,
        revokedTenantDeclaredAttribute,
        tenantVerifiedAttributeByAnotherProducer,
        tenantVerfiedAttributeWithExpiredExtension,
      ]);

      const consumer: Tenant = {
        ...getMockTenant(),
        attributes: [consumerInvalidAttribute],
      };

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified:
            consumerInvalidAttribute.type === "PersistentCertifiedAttribute"
              ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
              : [[]],

          declared:
            consumerInvalidAttribute.type === "PersistentDeclaredAttribute"
              ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
              : [],
          verified:
            consumerInvalidAttribute.type === "PersistentVerifiedAttribute"
              ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
              : [],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementActivationFailed(agreement.id));
    });

    it("Agreement Pending, Requester === Consumer -- error case: throws operationNotAllowed", async () => {
      const consumerId = generateId<TenantId>();
      const authData = getRandomAuthData(consumerId);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        consumerId,
      };
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should succeed when the requester is the Delegate and first activation", async () => {
      const consumerId = generateId<TenantId>();
      const producerId = generateId<TenantId>();
      const verifiedTenantAttributes = [
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producerId,
              verificationDate: new Date(),
              extensionDate: undefined,
            },
          ],
          revokedBy: [],
        },
      ];
      const certifiedTenantAttributes = [
        {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: undefined,
        },
      ];
      const declaredTenantAttributes = [
        {
          ...getMockDeclaredTenantAttribute(),
          revocationTimestamp: undefined,
        },
      ];

      const verifiedAttribute: Attribute = getMockAttribute(
        attributeKind.verified,
        verifiedTenantAttributes[0].id
      );

      const certifiedAttribute: Attribute = getMockAttribute(
        attributeKind.certified,
        certifiedTenantAttributes[0].id
      );

      const declaredAttribute: Attribute = getMockAttribute(
        attributeKind.declared,
        declaredTenantAttributes[0].id
      );

      const producer = getMockTenant(producerId);
      const consumer = {
        ...getMockTenant(consumerId),
        attributes: [
          verifiedTenantAttributes[0],
          certifiedTenantAttributes[0],
          declaredTenantAttributes[0],
        ],
      };
      const authData = getRandomAuthData();

      const descriptor = {
        ...getMockDescriptorPublished(),
        attributes: {
          certified: [
            [getMockEServiceAttribute(certifiedTenantAttributes[0].id)],
          ],
          declared: [
            [getMockEServiceAttribute(declaredTenantAttributes[0].id)],
          ],
          verified: [
            [getMockEServiceAttribute(verifiedTenantAttributes[0].id)],
          ],
        },
      };
      const eservice = {
        ...getMockEService(),
        producerId: producer.id,
        consumerId: consumer.id,
        descriptors: [descriptor],
      };
      const agreementSubmissionDate = new Date(
        new Date().getFullYear(),
        new Date().getMonth() - 1,
        1
      );

      const submitterId = authData.userId;
      const activatorId = authData.userId;
      const agreement: Agreement = {
        ...getMockAgreement(eservice.id),
        state: agreementState.pending,
        descriptorId: eservice.descriptors[0].id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedAt: undefined,
        suspendedByConsumer: false,
        suspendedByProducer: false,
        suspendedByPlatform: false,
        verifiedAttributes: [
          ...verifiedTenantAttributes.map(({ id }) => ({
            id,
          })),
        ],
        certifiedAttributes: certifiedTenantAttributes.map(({ id }) => ({
          id,
        })),
        declaredAttributes: declaredTenantAttributes.map(({ id }) => ({
          id,
        })),
        stamps: {
          submission: {
            who: submitterId,
            when: agreementSubmissionDate,
          },
        },
      };

      const delegator = getMockTenant(producer.id);
      const delegate = getMockTenant(authData.organizationId);
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: agreement.eserviceId,
        delegateId: delegate.id,
        delegatorId: delegator.id,
        state: delegationState.active,
      });

      await addOneAttribute(verifiedAttribute);
      await addOneAttribute(certifiedAttribute);
      await addOneAttribute(declaredAttribute);
      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneTenant(delegator);
      await addOneTenant(delegate);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await addOneDelegation(delegation);

      vi.spyOn(pdfGenerator, "generate");
      const actualAgreement = await agreementService.activateAgreement(
        agreement.id,
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );

      const expectedAgreement = {
        ...agreement,
        state: agreementState.active,
        contract: actualAgreement.contract,
        certifiedAttributes: actualAgreement.certifiedAttributes,
        declaredAttributes: actualAgreement.declaredAttributes,
        verifiedAttributes: actualAgreement.verifiedAttributes,
        stamps: {
          ...agreement.stamps,
          activation: {
            who: authData.userId,
            when: expect.any(Date),
            delegationId: delegation.id,
          },
        },
      };

      expect(actualAgreement).toEqual(expectedAgreement);

      // ============================
      // Verify agreement Document
      // ============================

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(actualAgreement.contract?.path);

      expect(submitterId).toEqual(actualAgreement.stamps.submission?.who);
      expect(activatorId).toEqual(actualAgreement.stamps.activation?.who);

      const getIpaCode = (tenant: Tenant): string | undefined =>
        tenant.externalId.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER
          ? tenant.externalId.value
          : undefined;

      const expectedAgreementPDFPayload: AgreementContractPDFPayload = {
        todayDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
        todayTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
        agreementId: agreement.id,
        submitterId,
        submissionDate: dateAtRomeZone(agreementSubmissionDate),
        submissionTime: timeAtRomeZone(agreementSubmissionDate),
        activatorId,
        activationDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
        activationTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
        eserviceName: eservice.name,
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
        descriptorVersion: eservice.descriptors[0].version,
        producerName: producer.name,
        producerIpaCode: getIpaCode(producer),
        consumerName: consumer.name,
        consumerIpaCode: getIpaCode(consumer),
        certifiedAttributes: [
          {
            assignmentDate: dateAtRomeZone(
              certifiedTenantAttributes[0].assignmentTimestamp
            ),
            assignmentTime: timeAtRomeZone(
              certifiedTenantAttributes[0].assignmentTimestamp
            ),
            attributeName: certifiedAttribute.name,
            attributeId: certifiedTenantAttributes[0].id,
          },
        ],
        declaredAttributes: [
          {
            assignmentDate: dateAtRomeZone(
              declaredTenantAttributes[0].assignmentTimestamp
            ),
            assignmentTime: timeAtRomeZone(
              declaredTenantAttributes[0].assignmentTimestamp
            ),
            attributeName: declaredAttribute.name,
            attributeId: declaredTenantAttributes[0].id,
          },
        ],
        verifiedAttributes: [
          {
            assignmentDate: dateAtRomeZone(
              verifiedTenantAttributes[0].assignmentTimestamp
            ),
            assignmentTime: timeAtRomeZone(
              verifiedTenantAttributes[0].assignmentTimestamp
            ),
            attributeName: verifiedAttribute.name,
            attributeId: verifiedTenantAttributes[0].id,
            expirationDate: undefined,
          },
        ],
        producerDelegationId: delegation.id,
        producerDelegatorName: producer.name,
        producerDelegatorIpaCode: getIpaCode(producer),
        producerDelegateName: delegate.name,
        producerDelegateIpaCode: getIpaCode(delegate),
      };

      expect(pdfGenerator.generate).toHaveBeenCalledWith(
        expect.any(String),
        expectedAgreementPDFPayload
      );
    });

    it("should succed when the requester is the Delegate and from Suspended", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      const authData = getRandomAuthData();
      const eservice = {
        ...getMockEService(),
        producerId: producer.id,
        consumerId: consumer.id,
        descriptors: [getMockDescriptorPublished()],
      };
      const mockAgreement = getMockAgreement(eservice.id);
      const agreement: Agreement = {
        ...getMockAgreement(eservice.id),
        state: agreementState.suspended,
        descriptorId: eservice.descriptors[0].id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedAt: new Date(),
        suspendedByConsumer: false,
        suspendedByProducer: true,
        suspendedByPlatform: false,
        stamps: {
          ...mockAgreement.stamps,
          suspensionByProducer: {
            who: authData.userId,
            when: new Date(),
          },
        },
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: agreement.eserviceId,
        delegateId: authData.organizationId,
        delegatorId: eservice.producerId,
        state: delegationState.active,
      });

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await addOneDelegation(delegation);

      const actualAgreement = await agreementService.activateAgreement(
        agreement.id,
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );

      const expectedAgreement = {
        ...agreement,
        state: agreementState.active,
        contract: actualAgreement.contract,
        certifiedAttributes: actualAgreement.certifiedAttributes,
        declaredAttributes: actualAgreement.declaredAttributes,
        verifiedAttributes: actualAgreement.verifiedAttributes,
        suspendedAt: undefined,
        suspendedByProducer: false,
        stamps: {
          ...agreement.stamps,
          suspensionByProducer: undefined,
        },
      };

      expect(actualAgreement).toEqual(expectedAgreement);
    });
  });

  describe("Agreement Suspended", () => {
    it.each([
      {
        isProducer: true,
        // Only suspendedByProducer is true, so that the next state is active
        suspendedByProducer: true,
        suspendedByConsumer: false,
      },
      {
        isProducer: false,
        // Only suspendedByConsumer is true, so that the next state is active
        suspendedByProducer: false,
        suspendedByConsumer: true,
      },
    ])(
      "Agreement Suspended, valid attributes, requester is producer: $isProducer, suspendedByProducer: $suspendedByProducer, suspendedByConsumer: $suspendedByConsumer -- success case: Suspended >> Activated",
      async ({ isProducer, suspendedByConsumer, suspendedByProducer }) => {
        const producer: Tenant = getMockTenant();

        const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
          ...getMockDeclaredTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producer.id,
              verificationDate: new Date(),
              extensionDate: addDays(new Date(), 30),
            },
          ],
        };

        const consumer: Tenant = {
          ...getMockTenant(),
          attributes: [
            validTenantCertifiedAttribute,
            validTenantDeclaredAttribute,
            validTenantVerifiedAttribute,
          ],
        };

        const authData = getRandomAuthData(
          isProducer ? producer.id : consumer.id
        );

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: randomArrayItem(agreementActivationAllowedDescriptorStates),
          attributes: {
            certified: [
              [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
            ],
            declared: [
              [getMockEServiceAttribute(validTenantDeclaredAttribute.id)],
            ],
            verified: [
              [getMockEServiceAttribute(validTenantVerifiedAttribute.id)],
            ],
          },
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId: producer.id,
          descriptors: [descriptor],
        };

        const mockAgreement = getMockAgreement();
        const agreement: Agreement = {
          ...mockAgreement,
          state: agreementState.suspended,
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId: producer.id,
          consumerId: consumer.id,
          suspendedByProducer,
          suspendedByConsumer,
          suspendedAt: new Date(),
          stamps: {
            ...mockAgreement.stamps,
            suspensionByProducer: suspendedByProducer
              ? {
                  who: authData.userId,
                  when: new Date(),
                }
              : undefined,
            suspensionByConsumer: suspendedByConsumer
              ? {
                  who: authData.userId,
                  when: new Date(),
                }
              : undefined,
          },

          // Adding some random attributes to check that they are not modified by the Unsuspension
          certifiedAttributes: [getMockAgreementAttribute()],
          declaredAttributes: [getMockAgreementAttribute()],
          verifiedAttributes: [getMockAgreementAttribute()],
        };

        await addOneTenant(consumer);
        await addOneTenant(producer);
        await addOneEService(eservice);
        await addOneAgreement(agreement);
        const relatedAgreements = await addRelatedAgreements(agreement);

        const activateAgreementReturnValue =
          await agreementService.activateAgreement(agreement.id, {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          });

        const agreementEvent = await readLastAgreementEvent(agreement.id);

        expect(agreementEvent).toMatchObject({
          type: isProducer
            ? "AgreementUnsuspendedByProducer"
            : "AgreementUnsuspendedByConsumer",
          event_version: 2,
          version: "1",
          stream_id: agreement.id,
        });

        const actualAgreementActivated = fromAgreementV2(
          decodeProtobufPayload({
            messageType: isProducer
              ? AgreementUnsuspendedByProducerV2
              : AgreementUnsuspendedByConsumerV2,
            payload: agreementEvent.data,
          }).agreement!
        );

        const expectedActivatedAgreement: Agreement = {
          ...agreement,
          state: agreementState.active,
          suspendedAt: undefined,
          stamps: {
            ...agreement.stamps,
            suspensionByProducer: undefined,
            suspensionByConsumer: undefined,
          },
          suspendedByConsumer: false,
          suspendedByProducer: false,
          suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
        };

        expect(actualAgreementActivated).toMatchObject(
          expectedActivatedAgreement
        );

        expect(activateAgreementReturnValue).toMatchObject(
          expectedActivatedAgreement
        );

        await testRelatedAgreementsArchiviation(relatedAgreements);
      }
    );

    it("Agreement Suspended, Requester === Consumer === Producer, no matter the attributes -- success case: Suspended >> Activated", async () => {
      const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const consumerAndProducer: Tenant = {
        ...getMockTenant(),
        attributes: [
          revokedTenantCertifiedAttribute,
          getMockDeclaredTenantAttribute(),
          getMockVerifiedTenantAttribute(),
        ],
      };

      const authData = getRandomAuthData(consumerAndProducer.id);

      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified: [
            [getMockEServiceAttribute(consumerAndProducer.attributes[0].id)],
          ],
          declared: [
            [getMockEServiceAttribute(consumerAndProducer.attributes[1].id)],
          ],
          verified: [
            [getMockEServiceAttribute(consumerAndProducer.attributes[2].id)],
          ],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: consumerAndProducer.id,
        descriptors: [descriptor],
      };

      // At least one of the two is true, they will both become false anyways
      const suspendedByConsumer = randomBoolean();
      const suspendedByProducer = !suspendedByConsumer ? true : randomBoolean();

      const mockAgreement = getMockAgreement();
      const agreement: Agreement = {
        ...mockAgreement,
        state: agreementState.suspended,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: consumerAndProducer.id,
        consumerId: consumerAndProducer.id,
        suspendedByProducer,
        suspendedByConsumer,
        suspendedAt: new Date(),
        stamps: {
          ...mockAgreement.stamps,
          suspensionByProducer: suspendedByProducer
            ? {
                who: authData.userId,
                when: new Date(),
              }
            : undefined,
          suspensionByConsumer: suspendedByConsumer
            ? {
                who: authData.userId,
                when: new Date(),
              }
            : undefined,
        },

        // Adding some random attributes to check that they are not modified by the Unsuspension
        certifiedAttributes: [getMockAgreementAttribute()],
        declaredAttributes: [getMockAgreementAttribute()],
        verifiedAttributes: [getMockAgreementAttribute()],
      };

      await addOneTenant(consumerAndProducer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      const relatedAgreements = await addRelatedAgreements(agreement);

      const activateAgreementReturnValue =
        await agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        });

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      // In this case, where the caller is both Producer and Consumer,
      // it saves an UnsuspendedByProducer event
      expect(agreementEvent).toMatchObject({
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreementActivated = fromAgreementV2(
        decodeProtobufPayload({
          messageType: AgreementUnsuspendedByProducerV2,
          payload: agreementEvent.data,
        }).agreement!
      );

      const expectedActivatedAgreement: Agreement = {
        ...agreement,
        state: agreementState.active,
        suspendedAt: undefined,
        stamps: {
          ...agreement.stamps,
          suspensionByProducer: undefined,
          suspensionByConsumer: undefined,
        },
        suspendedByConsumer: false,
        suspendedByProducer: false,
        suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
      };

      expect(actualAgreementActivated).toMatchObject(
        expectedActivatedAgreement
      );

      expect(activateAgreementReturnValue).toMatchObject(
        expectedActivatedAgreement
      );

      await testRelatedAgreementsArchiviation(relatedAgreements);
    });

    describe.each([
      {
        isProducer: true,
        suspendedByProducer: true,
        suspendedByConsumer: true,
      },
      {
        isProducer: false,
        suspendedByProducer: true,
        suspendedByConsumer: true,
      },
      {
        isProducer: true,
        suspendedByProducer: false,
        suspendedByConsumer: true,
      },
      {
        isProducer: false,
        suspendedByProducer: true,
        suspendedByConsumer: false,
      },
    ])(
      "Agreement Suspended, valid attributes, requester is producer: $isProducer, suspendedByProducer: $suspendedByProducer, suspendedByConsumer: $suspendedByConsumer -- success case: Suspended >> Suspended",
      async ({ isProducer, suspendedByConsumer, suspendedByProducer }) => {
        const producer: Tenant = getMockTenant();

        const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
          ...getMockDeclaredTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producer.id,
              verificationDate: new Date(),
              extensionDate: addDays(new Date(), 30),
            },
          ],
        };

        const consumer: Tenant = {
          ...getMockTenant(),
          attributes: [
            validTenantCertifiedAttribute,
            validTenantDeclaredAttribute,
            validTenantVerifiedAttribute,
          ],
        };

        const authData = getRandomAuthData(
          isProducer ? producer.id : consumer.id
        );

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: randomArrayItem(agreementActivationAllowedDescriptorStates),
          attributes: {
            certified: [
              [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
            ],
            declared: [
              [getMockEServiceAttribute(validTenantDeclaredAttribute.id)],
            ],
            verified: [
              [getMockEServiceAttribute(validTenantVerifiedAttribute.id)],
            ],
          },
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId: producer.id,
          descriptors: [descriptor],
        };

        const mockAgreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState.suspended,
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId: producer.id,
          consumerId: consumer.id,
          suspendedByProducer,
          suspendedByConsumer,
          suspendedAt: new Date(),
          stamps: {
            ...getMockAgreement().stamps,
            suspensionByProducer: suspendedByProducer
              ? {
                  who: authData.userId,
                  when: new Date(),
                }
              : undefined,
            suspensionByConsumer: suspendedByConsumer
              ? {
                  who: authData.userId,
                  when: new Date(),
                }
              : undefined,
          },
          // Adding some random attributes to check that they are not modified by the Unsuspension
          certifiedAttributes: [getMockAgreementAttribute()],
          declaredAttributes: [getMockAgreementAttribute()],
          verifiedAttributes: [getMockAgreementAttribute()],
        };

        const expectedStamps = {
          suspensionByProducer: isProducer
            ? undefined
            : mockAgreement.stamps.suspensionByProducer,
          suspensionByConsumer: !isProducer
            ? undefined
            : mockAgreement.stamps.suspensionByConsumer,
        };

        const expectedUnsuspendedAgreement: Agreement = {
          ...mockAgreement,
          state: agreementState.suspended,
          suspendedAt: mockAgreement.suspendedAt,
          stamps: {
            ...mockAgreement.stamps,
            ...expectedStamps,
          },
          suspendedByConsumer: isProducer ? true : false,
          suspendedByProducer: !isProducer ? true : false,
        };

        it("if suspendedByPlatform === false, unsuspends by Producer or Consumer and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: false,
          };
          const expected = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: false,
          };
          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);

          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });

          const agreementEvent = await readLastAgreementEvent(agreement.id);

          expect(agreementEvent).toMatchObject({
            type: isProducer
              ? "AgreementUnsuspendedByProducer"
              : "AgreementUnsuspendedByConsumer",
            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType: isProducer
                ? AgreementUnsuspendedByProducerV2
                : AgreementUnsuspendedByConsumerV2,
              payload: agreementEvent.data,
            }).agreement!
          );

          await testRelatedAgreementsArchiviation(relatedAgreements);

          expect(actualAgreementUnsuspended).toMatchObject(expected);

          expect(activateAgreementReturnValue).toMatchObject(expected);
        });

        it("if suspendedByPlatform === true, unsuspends by Producer or Consumer and also by platform, and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: true,
          };

          const expected1 = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: true,
          };

          const expected2 = {
            ...expected1,
            suspendedByPlatform: false,
          };

          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);

          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });

          const agreementEvent = await readAgreementEventByVersion(
            agreement.id,
            1
          );

          expect(agreementEvent).toMatchObject({
            type: isProducer
              ? "AgreementUnsuspendedByProducer"
              : "AgreementUnsuspendedByConsumer",
            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType: isProducer
                ? AgreementUnsuspendedByProducerV2
                : AgreementUnsuspendedByConsumerV2,
              payload: agreementEvent.data,
            }).agreement!
          );

          expect(actualAgreementUnsuspended).toMatchObject(expected1);

          const agreementUnsuspendedByPlatformEvent =
            await readAgreementEventByVersion(agreement.id, 2);

          expect(agreementUnsuspendedByPlatformEvent).toMatchObject({
            type: "AgreementUnsuspendedByPlatform",
            event_version: 2,
            version: "2",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspendedByPlatform = fromAgreementV2(
            decodeProtobufPayload({
              messageType: AgreementUnsuspendedByPlatformV2,
              payload: agreementUnsuspendedByPlatformEvent.data,
            }).agreement!
          );

          await testRelatedAgreementsArchiviation(relatedAgreements);
          expect(actualAgreementUnsuspendedByPlatform).toMatchObject(expected2);
          expect(activateAgreementReturnValue).toMatchObject(expected2);
        });
      }
    );

    describe.each([
      {
        isProducer: true,
        suspendedByProducer: true,
        suspendedByConsumer: true,
      },
      {
        isProducer: false,
        suspendedByProducer: true,
        suspendedByConsumer: true,
      },
      {
        isProducer: true,
        suspendedByProducer: false,
        suspendedByConsumer: true,
      },
      {
        isProducer: false,
        suspendedByProducer: true,
        suspendedByConsumer: false,
      },
    ])(
      "Agreement Suspended, invalid attributes, requester is producer: $isProducer, suspendedByProducer: $suspendedByProducer, suspendedByConsumer: $suspendedByConsumer -- success case: Suspended >> Suspended",
      async ({ isProducer, suspendedByProducer, suspendedByConsumer }) => {
        const producer: Tenant = getMockTenant();

        const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: new Date(),
        };

        const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
          ...getMockDeclaredTenantAttribute(),
          revocationTimestamp: new Date(),
        };

        const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute =
          {
            ...getMockVerifiedTenantAttribute(),
            verifiedBy: [
              { id: generateId<TenantId>(), verificationDate: new Date() },
            ],
          };

        const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
          {
            ...getMockVerifiedTenantAttribute(),
            verifiedBy: [
              {
                id: producer.id,
                verificationDate: new Date(),
                extensionDate: new Date(),
              },
            ],
          };

        const consumerInvalidAttribute: TenantAttribute = randomArrayItem([
          revokedTenantCertifiedAttribute,
          revokedTenantDeclaredAttribute,
          tenantVerifiedAttributeByAnotherProducer,
          tenantVerfiedAttributeWithExpiredExtension,
        ]);

        const consumer: Tenant = {
          ...getMockTenant(),
          attributes: [consumerInvalidAttribute],
        };

        const authData = getRandomAuthData(
          isProducer ? producer.id : consumer.id
        );

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: randomArrayItem(agreementActivationAllowedDescriptorStates),
          attributes: {
            certified:
              consumerInvalidAttribute.type === "PersistentCertifiedAttribute"
                ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
                : [[]],

            declared:
              consumerInvalidAttribute.type === "PersistentDeclaredAttribute"
                ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
                : [],
            verified:
              consumerInvalidAttribute.type === "PersistentVerifiedAttribute"
                ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
                : [],
          },
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId: producer.id,
          descriptors: [descriptor],
        };

        const mockAgreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState.suspended,
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId: producer.id,
          consumerId: consumer.id,
          suspendedByProducer,
          suspendedByConsumer,
          suspendedAt: new Date(),
          stamps: {
            ...getMockAgreement().stamps,
            suspensionByProducer: suspendedByProducer
              ? {
                  who: authData.userId,
                  when: new Date(),
                }
              : undefined,
            suspensionByConsumer: suspendedByConsumer
              ? {
                  who: authData.userId,
                  when: new Date(),
                }
              : undefined,
          },
          // Adding some random attributes to check that they are not modified by the Unsuspension
          certifiedAttributes: [getMockAgreementAttribute()],
          declaredAttributes: [getMockAgreementAttribute()],
          verifiedAttributes: [getMockAgreementAttribute()],
        };

        const expectedStamps = {
          suspensionByProducer: isProducer
            ? undefined
            : mockAgreement.stamps.suspensionByProducer,
          suspensionByConsumer: !isProducer
            ? undefined
            : mockAgreement.stamps.suspensionByConsumer,
        };

        const expectedUnsuspendedAgreement: Agreement = {
          ...mockAgreement,
          state: agreementState.suspended,
          suspendedAt: mockAgreement.suspendedAt,
          stamps: {
            ...mockAgreement.stamps,
            ...expectedStamps,
          },
          suspendedByConsumer: isProducer ? true : false,
          suspendedByProducer: !isProducer ? true : false,
        };

        it("if suspendedByPlatform === true, unsuspends by Producer or Consumer and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: true,
          };
          const expected = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: true,
          };
          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);
          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });
          const agreementEvent = await readLastAgreementEvent(agreement.id);
          expect(agreementEvent).toMatchObject({
            type: isProducer
              ? "AgreementUnsuspendedByProducer"
              : "AgreementUnsuspendedByConsumer",
            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });
          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType: isProducer
                ? AgreementUnsuspendedByProducerV2
                : AgreementUnsuspendedByConsumerV2,
              payload: agreementEvent.data,
            }).agreement!
          );
          await testRelatedAgreementsArchiviation(relatedAgreements);
          expect(actualAgreementUnsuspended).toMatchObject(expected);
          expect(activateAgreementReturnValue).toMatchObject(expected);
        });

        it("if suspendedByPlatform === false, unsuspends by Producer or Consumer and also suspends by platform, and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: false,
          };

          const expected1 = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: false,
          };

          const expected2 = {
            ...expected1,
            suspendedByPlatform: true,
          };

          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);

          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });

          const agreementEvent = await readAgreementEventByVersion(
            agreement.id,
            1
          );

          expect(agreementEvent).toMatchObject({
            type: isProducer
              ? "AgreementUnsuspendedByProducer"
              : "AgreementUnsuspendedByConsumer",
            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType: isProducer
                ? AgreementUnsuspendedByProducerV2
                : AgreementUnsuspendedByConsumerV2,
              payload: agreementEvent.data,
            }).agreement!
          );

          expect(actualAgreementUnsuspended).toMatchObject(expected1);

          const agreementUnsuspendedByPlatformEvent =
            await readAgreementEventByVersion(agreement.id, 2);

          expect(agreementUnsuspendedByPlatformEvent).toMatchObject({
            type: "AgreementSuspendedByPlatform",
            event_version: 2,
            version: "2",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspendedByPlatform = fromAgreementV2(
            decodeProtobufPayload({
              messageType: AgreementSuspendedByPlatformV2,
              payload: agreementUnsuspendedByPlatformEvent.data,
            }).agreement!
          );

          await testRelatedAgreementsArchiviation(relatedAgreements);
          expect(actualAgreementUnsuspendedByPlatform).toMatchObject(expected2);
          expect(activateAgreementReturnValue).toMatchObject(expected2);
        });
      }
    );
  });

  describe("All other error cases", () => {
    it("should throw an agreementNotFound error when the Agreement does not exist", async () => {
      await addOneAgreement(getMockAgreement());
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();
      await expect(
        agreementService.activateAgreement(agreementId, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw an operationNotAllowed error when the requester is not the Consumer or Producer", async () => {
      const authData = getRandomAuthData();
      const agreement: Agreement = getMockAgreement();
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw an operationNotAllowed error when the requester is the Producer but it is not the delegate", async () => {
      const authData = getRandomAuthData();
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        producerId: authData.organizationId,
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: agreement.eserviceId,
        state: delegationState.active,
      });

      const eservice = getMockEService(agreement.eserviceId);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await addOneDelegation(delegation);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it.each(
      Object.values(agreementState).filter(
        (state) => !agreementActivableStates.includes(state)
      )
    )(
      "should throw an agreementNotInExpectedState error when the Agreement is not in an activable state - agreement state: %s",
      async (agreementState) => {
        const consumerId = generateId<TenantId>();
        const authData = getRandomAuthData(consumerId);

        const agreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState,
          consumerId,
        };
        await addOneAgreement(agreement);
        await expect(
          agreementService.activateAgreement(agreement.id, {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          })
        ).rejects.toThrowError(
          agreementNotInExpectedState(agreement.id, agreement.state)
        );
      }
    );

    it("should throw an eServiceNotFound error when the EService does not exist", async () => {
      const consumerId = generateId<TenantId>();
      const authData = getRandomAuthData(consumerId);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(
          agreementActivableStates.filter((s) => s !== agreementState.pending)
        ),
        consumerId,
      };
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
    });

    it("should throw a descriptorNotFound error when the Descriptor does not exist", async () => {
      const consumerId = generateId<TenantId>();
      const producerId = generateId<TenantId>();
      const authData = getRandomAuthData(producerId);

      const eservice: EService = {
        ...getMockEService(),
        producerId,
      };
      const agreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: eservice.id,
        consumerId,
        state: randomArrayItem(agreementActivableStates),
        producerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
      );
    });

    it.each(
      Object.values(descriptorState).filter(
        (state) => !agreementActivationAllowedDescriptorStates.includes(state)
      )
    )(
      "should throw a descriptorNotInExpectedState error when the Descriptor is not in an expected state - descriptor state: %s",
      async (descriptorState) => {
        const consumerId = generateId<TenantId>();
        const producerId = generateId<TenantId>();
        const authData = getRandomAuthData(producerId);

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: descriptorState,
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId,
          descriptors: [descriptor],
        };

        const agreement: Agreement = {
          ...getMockAgreement(),
          state: randomArrayItem(agreementActivableStates),
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId,
          consumerId,
        };

        await addOneEService(eservice);
        await addOneAgreement(agreement);

        await expect(
          agreementService.activateAgreement(agreement.id, {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          })
        ).rejects.toThrowError(
          descriptorNotInExpectedState(
            eservice.id,
            descriptor.id,
            agreementActivationAllowedDescriptorStates
          )
        );
      }
    );

    it("should throw a tenantNotFound error when the Consumer does not exist", async () => {
      const consumerId = generateId<TenantId>();
      const producerId = generateId<TenantId>();
      const authData = getRandomAuthData(producerId);

      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementActivableStates),
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId,
        consumerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(tenantNotFound(consumerId));
    });

    it("should throw a tenantNotFound error when the Producer does not exist", async () => {
      const producerId = generateId<TenantId>();
      const consumer = getMockTenant();
      const authData = getRandomAuthData(producerId);

      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementActivableStates),
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId,
        consumerId: consumer.id,
      };

      await addOneTenant(consumer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(tenantNotFound(producerId));
    });

    it("should throw agreementStampNotFound when the contract builder cannot find the submission stamp", async () => {
      const producer: Tenant = getMockTenant();
      const consumer: Tenant = getMockTenant();

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockAgreement: Agreement = getMockAgreement();
      const agreement: Agreement = {
        ...mockAgreement,
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedByConsumer: false,
        suspendedByProducer: randomBoolean(),
        stamps: {
          submission: undefined,
        },
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementStampNotFound("submission"));
    });

    it("should throw attributeNotFound when the contract builder cannot retrieve an attribute", async () => {
      const producer: Tenant = getMockTenant();

      const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };

      const consumer: Tenant = {
        ...getMockTenant(),
        selfcareId: generateId(),
        attributes: [validTenantCertifiedAttribute],
      };

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified: [
            [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
          ],
          declared: [],
          verified: [],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockAgreement: Agreement = getMockAgreement();
      const agreement: Agreement = {
        ...mockAgreement,
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedByConsumer: false,
        suspendedByProducer: randomBoolean(),
        stamps: {
          submission: {
            who: authData.userId,
            when: new Date(),
          },
          activation: {
            who: authData.userId,
            when: new Date(),
          },
        },
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        attributeNotFound(validTenantCertifiedAttribute.id)
      );
    });
  });
});
