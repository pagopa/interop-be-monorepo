import { z } from "zod";
import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
  initFileManager,
  authorizationManagementServiceMock,
  logger,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementState,
  ListResult,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  Tenant,
  EService,
  descriptorState,
  AgreementStamp,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import {
  descriptorNotFound,
  unexpectedVersionFormat,
} from "../model/domain/errors.js";
import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementUpdated,
} from "../model/domain/toEvent.js";
import { publishedDescriptorNotFound } from "../model/domain/errors.js";
import {
  assertAgreementExist,
  assertEServiceExist,
  assertExpectedState,
  assertRequesterIsConsumer,
  assertTenantExist,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  verifyCreationConflictingAgreements,
} from "../model/domain/validators.js";
import {
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { submitAgreementLogic } from "./agreementSubmissionProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { AgreementQueryFilters } from "./readmodel/readModelService.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

const fileManager = initFileManager(config);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  dbInstance: DB,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  eserviceQuery: EserviceQuery,
  attributeQuery: AttributeQuery
) {
  const repository = eventRepository(dbInstance, agreementEventToBinaryData);
  return {
    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      logger.info("Retrieving agreements");
      return await agreementQuery.getAgreements(filters, limit, offset);
    },
    async getAgreementById(
      agreementId: string
    ): Promise<Agreement | undefined> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await agreementQuery.getAgreementById(agreementId);
      return agreement?.data;
    },
    async createAgreement(
      agreement: ApiAgreementPayload,
      authData: AuthData
    ): Promise<string> {
      const createAgreementEvent = await createAgreementLogic(
        agreement,
        authData,
        agreementQuery,
        eserviceQuery,
        tenantQuery
      );
      return await repository.createEvent(createAgreementEvent);
    },
    async updateAgreement(
      agreementId: string,
      agreement: ApiAgreementUpdatePayload,
      authData: AuthData
    ): Promise<void> {
      const agreementToBeUpdated = await agreementQuery.getAgreementById(
        agreementId
      );

      await repository.createEvent(
        await updateAgreementLogic({
          agreementId,
          agreement,
          authData,
          agreementToBeUpdated,
        })
      );
    },
    async deleteAgreementById(
      agreementId: string,
      authData: AuthData
    ): Promise<void> {
      const agreement = await agreementQuery.getAgreementById(agreementId);

      await repository.createEvent(
        await deleteAgreementLogic({
          agreementId,
          authData,
          deleteFile: fileManager.deleteFile,
          agreement,
        })
      );
    },
    async submitAgreement(
      agreementId: string,
      payload: ApiAgreementSubmissionPayload
    ): Promise<string> {
      logger.info("Submitting agreement");
      const updatesEvents = await submitAgreementLogic(
        agreementId,
        payload,
        contractBuilder(attributeQuery),
        eserviceQuery,
        agreementQuery,
        tenantQuery
      );

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }

      return agreementId;
    },
    async upgradeAgreement(
      agreementId: string,
      authData: AuthData
    ): Promise<void> {
      const agreement = await agreementQuery.getAgreementById(agreementId);
      const tenant = agreement
        ? await tenantQuery.getTenantById(agreement.data.consumerId)
        : undefined;
      const eservice = agreement
        ? await eserviceQuery.getEServiceById(agreement.data.eserviceId)
        : undefined;

      const events = await upgradeAgreementLogic({
        agreementId,
        authData,
        agreementToBeUpgraded: agreement,
        tenant,
        eservice,
      });

      for (const event of events) {
        await repository.createEvent(event);
      }
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

export async function deleteAgreementLogic({
  agreementId,
  authData,
  deleteFile,
  agreement,
}: {
  agreementId: string;
  authData: AuthData;
  deleteFile: (path: string) => Promise<void>;
  agreement: WithMetadata<Agreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data.consumerId, authData.organizationId);

  const deletableStates: AgreementState[] = [
    agreementState.draft,
    agreementState.missingCertifiedAttributes,
  ];

  assertExpectedState(agreementId, agreement.data.state, deletableStates);

  for (const d of agreement.data.consumerDocuments) {
    await deleteFile(d.path);
  }

  return toCreateEventAgreementDeleted(agreementId, agreement.metadata.version);
}

export async function createAgreementLogic(
  agreement: ApiAgreementPayload,
  authData: AuthData,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery
): Promise<CreateEvent<AgreementEvent>> {
  logger.info(
    `Creating agreement for EService ${agreement.eserviceId} and Descriptor ${agreement.descriptorId}`
  );
  const eservice = await eserviceQuery.getEServiceById(agreement.eserviceId);
  assertEServiceExist(agreement.eserviceId, eservice);

  const descriptor = validateCreationOnDescriptor(
    eservice.data,
    agreement.descriptorId
  );

  await verifyCreationConflictingAgreements(
    authData.organizationId,
    agreement,
    agreementQuery
  );
  const consumer = await tenantQuery.getTenantById(authData.organizationId);
  assertTenantExist(authData.organizationId, consumer);

  if (eservice.data.producerId !== consumer.data.id) {
    validateCertifiedAttributes(descriptor, consumer.data);
  }

  const agreementSeed: Agreement = {
    id: uuidv4(),
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
    producerId: eservice.data.producerId,
    consumerId: authData.organizationId,
    state: agreementState.draft,
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    suspendedByPlatform: undefined,
    consumerDocuments: [],
    createdAt: new Date(),
    updatedAt: undefined,
    consumerNotes: undefined,
    contract: undefined,
    stamps: {
      submission: undefined,
      activation: undefined,
      rejection: undefined,
      suspensionByProducer: undefined,
      suspensionByConsumer: undefined,
      upgrade: undefined,
      archiving: undefined,
    },
    rejectionReason: undefined,
    suspendedAt: undefined,
  };

  return toCreateEventAgreementAdded(agreementSeed);
}

export async function updateAgreementLogic({
  agreementId,
  agreement,
  authData,
  agreementToBeUpdated,
}: {
  agreementId: string;
  agreement: ApiAgreementUpdatePayload;
  authData: AuthData;
  agreementToBeUpdated: WithMetadata<Agreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreementToBeUpdated);
  assertRequesterIsConsumer(
    agreementToBeUpdated.data.consumerId,
    authData.organizationId
  );

  const updatableStates: AgreementState[] = [agreementState.draft];

  assertExpectedState(
    agreementId,
    agreementToBeUpdated.data.state,
    updatableStates
  );

  const agreementUpdated: Agreement = {
    ...agreementToBeUpdated.data,
    consumerNotes: agreement.consumerNotes,
  };

  return toCreateEventAgreementUpdated(
    agreementUpdated,
    agreementToBeUpdated.metadata.version
  );
}

export async function upgradeAgreementLogic({
  agreementId,
  authData,
  agreementToBeUpgraded,
  tenant,
  eservice,
}: {
  agreementId: string;
  authData: AuthData;
  agreementToBeUpgraded: WithMetadata<Agreement> | undefined;
  tenant: WithMetadata<Tenant> | undefined;
  eservice: WithMetadata<EService> | undefined;
}): Promise<Array<CreateEvent<AgreementEvent>>> {
  assertTenantExist(authData.organizationId, tenant);
  assertAgreementExist(agreementId, agreementToBeUpgraded);
  assertRequesterIsConsumer(
    agreementToBeUpgraded.data.consumerId,
    authData.organizationId
  );

  const upgradableStates: AgreementState[] = [
    agreementState.active,
    agreementState.suspended,
  ];

  assertExpectedState(
    agreementId,
    agreementToBeUpgraded.data.state,
    upgradableStates
  );

  assertEServiceExist(agreementToBeUpgraded.data.eserviceId, eservice);

  const descriptor = eservice.data.descriptors.find(
    (d) => d.state === descriptorState.published
  );
  if (descriptor === undefined) {
    throw publishedDescriptorNotFound(agreementToBeUpgraded.data.eserviceId);
  }

  const latestDescriptorVersion = z.number().safeParse(descriptor.version);
  if (!latestDescriptorVersion.success) {
    throw unexpectedVersionFormat(eservice.data.id, descriptor.id);
  }

  const currentDescriptor = eservice.data.descriptors.find(
    (d) => d.id === agreementToBeUpgraded.data.descriptorId
  );
  if (currentDescriptor === undefined) {
    throw descriptorNotFound(
      eservice.data.id,
      agreementToBeUpgraded.data.descriptorId
    );
  }

  const currentVersion = z.number().safeParse(currentDescriptor.version);
  if (!currentVersion.success) {
    throw unexpectedVersionFormat(eservice.data.id, currentDescriptor.id);
  }

  if (latestDescriptorVersion <= currentVersion) {
    throw noNewerDescriptor(eservice.data.id, currentDescriptor.id);
  }

  // newDescriptor

  const attributesSatisfied = (
    requested: Array<Array<{ id: string }>>,
    assigned: string[]
  ): boolean => {
    const mapped = requested.map((a) => a.map((v) => v.id));
    return !mapped.some((a) => a.some((a) => assigned.includes(a)));
  };

  const assigned = tenant.data.attributes
    .filter((a) => a.type === "certified")
    .filter((a) => a.assignmentTimestamp !== undefined)
    .map((a) => a.id);

  const valid = attributesSatisfied(descriptor.attributes.certified, assigned);
  if (!valid) {
    throw missingCertifiedAttributesError(descriptor.id, tenant.data.id);
  }

  const verified = tenant.data.attributes
    .filter(
      (a) =>
        a.type === "verified" &&
        a.verifiedBy.some(
          (v) =>
            v.id === agreementToBeUpgraded.data.producerId &&
            (v.extensionDate === undefined ||
              v.extensionDate.getTime() > new Date().getTime())
        )
    )
    .map((a) => a.id);
  const verifiedValid = attributesSatisfied(
    descriptor.attributes.verified,
    verified
  );
  const declared = tenant.data.attributes
    .filter((a) => a.type === "declared" && a.revocationTimestamp === undefined)
    .map((a) => a.id);
  const declaredValid = attributesSatisfied(
    descriptor.attributes.declared,
    declared
  );
  if (verifiedValid && declaredValid) {
    // upgradeAgreement
    const stamp: AgreementStamp = {
      who: authData.organizationId,
      when: new Date(),
    };
    const deactivated: Agreement = {
      ...agreementToBeUpgraded.data,
      state: agreementState.archived,
      stamps: {
        ...agreementToBeUpgraded.data.stamps,
        archiving: stamp,
      },
    };
    const upgraded: Agreement = {
      ...agreementToBeUpgraded.data,
      id: uuidv4(),
      descriptorId: descriptor.id,
      createdAt: new Date(),
      updatedAt: undefined,
      rejectionReason: undefined,
      stamps: {
        ...agreementToBeUpgraded.data.stamps,
        upgrade: stamp,
      },
    };

    await authorizationManagementServiceMock.updateAgreementAndEServiceStates(
      upgraded.eserviceId,
      upgraded.consumerId,
      {
        agreementId: upgraded.id,
        agreementState:
          upgraded.state === agreementState.active ? "active" : "inactive",
        descriptorId: descriptor.id,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        eserviceState:
          descriptor.state === descriptorState.published ||
          descriptor.state === descriptorState.deprecated
            ? "active"
            : "inactive",
      }
    );

    return [
      toCreateEventAgreementUpdated(
        deactivated,
        agreementToBeUpgraded.metadata.version
      ),
      toCreateEventAgreementAdded(upgraded),
    ];
  } else {
    // createNewDraftAgreement
  }

  return [];
}
