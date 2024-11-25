/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersionDocument,
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  getMockAuthData,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  generateId,
  toReadModelEService,
  PurposeId,
  PurposeVersionId,
  PurposeVersionDocumentId,
  TenantId,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  purposeVersionDocumentNotFound,
  organizationNotAllowed,
} from "../src/model/domain/errors.js";

import {
  getMockEService,
  addOnePurpose,
  eservices,
  purposeService,
  delegations,
} from "./utils.js";

describe("getRiskAnalysisDocument", () => {
  it("should get the purpose version document (consumer)", async () => {
    const mockDocument = getMockPurposeVersionDocument();
    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: mockPurpose.consumerId,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document (producer)", async () => {
    const mockDocument = getMockPurposeVersionDocument();
    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: mockEService.producerId,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document (delegate)", async () => {
    const mockDocument = getMockPurposeVersionDocument();
    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: delegate.organizationId,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const notExistingId: PurposeId = generateId();
    await addOnePurpose(getMockPurpose());

    expect(
      purposeService.getRiskAnalysisDocument({
        purposeId: notExistingId,
        versionId: generateId(),
        documentId: generateId(),
        organizationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(purposeNotFound(notExistingId));
  });
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const randomVersionId: PurposeVersionId = generateId();
    const randomDocumentId: PurposeVersionDocumentId = generateId();
    const mockDocument = getMockPurposeVersionDocument();
    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.getRiskAnalysisDocument({
        purposeId: mockPurpose.id,
        versionId: randomVersionId,
        documentId: randomDocumentId,
        organizationId: mockEService.producerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it("should throw purposeVersionDocumentNotFound if the document doesn't exist", async () => {
    const mockDocument = getMockPurposeVersionDocument();
    const randomDocumentId: PurposeVersionDocumentId = generateId();
    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.getRiskAnalysisDocument({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        documentId: randomDocumentId,
        organizationId: mockEService.producerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      purposeVersionDocumentNotFound(
        mockPurpose.id,
        mockPurposeVersion.id,
        randomDocumentId
      )
    );
  });
  it("should throw organizationNotAllowed if the requester is not the producer nor the consumer nor the delegate", async () => {
    const randomId: TenantId = generateId();
    const mockDocument = getMockPurposeVersionDocument();
    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.getRiskAnalysisDocument({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        documentId: mockDocument.id,
        organizationId: randomId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(organizationNotAllowed(randomId));
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw organizationNotAllowed if the requester is the delegate but the delegation is in %s state",
    async (delegationState) => {
      const mockDocument = getMockPurposeVersionDocument();
      const mockEService = getMockEService();
      const mockPurposeVersion = {
        ...getMockPurposeVersion(),
        riskAnalysis: mockDocument,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      const delegate = getMockAuthData();
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegate.organizationId,
        state: delegationState,
      });

      await writeInReadmodel(delegation, delegations);

      expect(
        purposeService.getRiskAnalysisDocument({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          documentId: mockDocument.id,
          organizationId: delegate.organizationId,
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(delegate.organizationId));
    }
  );
});
