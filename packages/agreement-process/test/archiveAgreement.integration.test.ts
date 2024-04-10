import { fail } from "assert";
import { v4 as uuidv4 } from "uuid";
import {
  AgreementId,
  AgreementUpdatedV1,
  AgreementV1,
  AttributeId,
  DescriptorId,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  protobufDecoder,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  StoredEvent,
  getMockAgreement,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import { toAgreementStateV1 } from "../src/model/domain/toEvent.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readLastAgreementEvent,
} from "./utils.js";
import {
  agreementService,
  agreements,
  eservices,
  postgresDB,
  tenants,
} from "./agreementService.test.setup.js";

const expectedAgreementArchived = async (
  agreementId: AgreementId | undefined
): Promise<AgreementV1> => {
  expect(agreementId).toBeDefined();
  if (!agreementId) {
    fail("Unhandled error: returned agreementId is undefined");
  }

  const actualAgreementData: StoredEvent | undefined =
    await readLastAgreementEvent(agreementId, postgresDB);

  if (!actualAgreementData) {
    fail("Creation fails: agreement not found in event-store");
  }

  expect(actualAgreementData).toMatchObject({
    type: "AgreementUpdated",
    event_version: 1,
    version: "0",
    stream_id: agreementId,
  });

  const actualAgreement: AgreementV1 | undefined = protobufDecoder(
    AgreementUpdatedV1
  ).parse(actualAgreementData.data)?.agreement;

  if (!actualAgreement) {
    fail("impossible to decode AgreementAddedV1 data");
  }

  expect(actualAgreement.state).toBe(
    toAgreementStateV1(agreementState.archived)
  );
  return actualAgreement;
};

describe("archive agreement", () => {
  it("should succeed when the requester is the consumer and the agreement is in a archivable state", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const attributeId = generateId<AttributeId>();

    const descriptor = getMockDescriptorPublished(descriptorId, [
      [getMockEServiceAttribute(attributeId)],
    ]);
    const eservice = getMockEService(eserviceId, authData.organizationId, [
      descriptor,
    ]);
    const tenant = getMockTenant(authData.organizationId);
    const agreement = getMockAgreement(
      eserviceId,
      tenant.id,
      agreementState.active
    );

    await addOneEService(eservice, eservices);
    await addOneTenant(tenant, tenants);
    await addOneAgreement(agreement, postgresDB, agreements);

    const archivedAgreementId = await agreementService.archiveAgreement(
      agreement.id,
      authData,
      uuidv4()
    );

    await expectedAgreementArchived(
      unsafeBrandId<AgreementId>(archivedAgreementId)
    );
  });

  it("should throw a agreementNotFound error when the Agreement doesn't exist", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const attributeId = generateId<AttributeId>();

    const descriptor = getMockDescriptorPublished(descriptorId, [
      [getMockEServiceAttribute(attributeId)],
    ]);
    const eservice = getMockEService(eserviceId, authData.organizationId, [
      descriptor,
    ]);
    const tenant = getMockTenant(authData.organizationId);
    const agreement = getMockAgreement(
      eserviceId,
      tenant.id,
      agreementState.active
    );

    await addOneEService(eservice, eservices);
    await addOneTenant(tenant, tenants);
    await addOneAgreement(agreement, postgresDB, agreements);

    const agreementToArchiveId = generateId<AgreementId>();

    await expect(
      agreementService.archiveAgreement(
        agreementToArchiveId,
        authData,
        uuidv4()
      )
    ).rejects.toThrowError(agreementNotFound(agreementToArchiveId));
  });

  it("should throw a operationNotAllowed error when the requester is not the Agreement consumer", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const attributeId = generateId<AttributeId>();

    const descriptor = getMockDescriptorPublished(descriptorId, [
      [getMockEServiceAttribute(attributeId)],
    ]);
    const eservice = getMockEService(eserviceId, generateId<TenantId>(), [
      descriptor,
    ]);
    const tenant = getMockTenant(generateId<TenantId>());
    const agreement = getMockAgreement(
      eserviceId,
      tenant.id,
      agreementState.active
    );

    await addOneEService(eservice, eservices);
    await addOneTenant(tenant, tenants);
    await addOneAgreement(agreement, postgresDB, agreements);

    await expect(
      agreementService.archiveAgreement(agreement.id, authData, uuidv4())
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw a agreementNotInExpectedState error when the Agreement is not in a archivable states", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const attributeId = generateId<AttributeId>();

    const descriptor = getMockDescriptorPublished(descriptorId, [
      [getMockEServiceAttribute(attributeId)],
    ]);
    const eservice = getMockEService(eserviceId, authData.organizationId, [
      descriptor,
    ]);
    const tenant = getMockTenant(authData.organizationId);
    const agreement = getMockAgreement(
      eserviceId,
      tenant.id,
      agreementState.draft
    );

    await addOneEService(eservice, eservices);
    await addOneTenant(tenant, tenants);
    await addOneAgreement(agreement, postgresDB, agreements);

    await expect(
      agreementService.archiveAgreement(agreement.id, authData, uuidv4())
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreementState.draft)
    );
  });
});
