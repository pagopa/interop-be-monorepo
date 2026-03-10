/* eslint-disable functional/no-let */
import {
  getMockAgreement,
  getMockDescriptorPublished,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
  afterEach,
  beforeEach,
} from "vitest";
import { RefreshableInteropToken, genericLogger } from "pagopa-interop-commons";
import {
  CorrelationId,
  EServiceId,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  genericInternalError,
} from "pagopa-interop-models";
import {
  CatalogProcessZodiosClient,
  catalogProcessClientBuilder,
} from "../src/services/catalogProcessClient.js";
import { archiveDescriptorForArchivedAgreement } from "../src/services/archiveDescriptorProcessor.js";
import { addOneAgreement, addOneEService, readModelService } from "./utils.js";

describe("EService Descriptors Archiver", async () => {
  describe("archiveDescriptorsForArchivedAgreement", async () => {
    const testCorrelationId: CorrelationId = generateId();
    const testToken = "mockToken";
    const testHeaders = {
      "X-Correlation-Id": testCorrelationId,
      Authorization: `Bearer ${testToken}`,
    };

    let catalogProcessClient: CatalogProcessZodiosClient;
    let mockRefreshableToken: RefreshableInteropToken;

    beforeAll(async () => {
      mockRefreshableToken = {
        get: () => Promise.resolve({ serialized: testToken }),
      } as RefreshableInteropToken;

      catalogProcessClient = catalogProcessClientBuilder("mockUrl");
    });

    beforeEach(async () => {
      // eslint-disable-next-line functional/immutable-data
      catalogProcessClient.archiveDescriptor = vi.fn();
    });

    afterEach(async () => {
      vi.clearAllMocks();
    });

    it("should call archive Descriptor when all Agreements are Archived and the Descriptor is deprecated", async () => {
      const producerId: TenantId = generateId();
      const descriptor = {
        ...getMockDescriptorPublished(),
        state: descriptorState.deprecated,
      };

      const eservice = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };
      const archivedAgreement = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      // Relating agreements: same descriptor, same eservice, different consumer
      const otherAgreement1 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      const otherAgreement2 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(archivedAgreement);
      await addOneAgreement(otherAgreement1);
      await addOneAgreement(otherAgreement2);

      await archiveDescriptorForArchivedAgreement(
        archivedAgreement,
        mockRefreshableToken,
        readModelService,
        catalogProcessClient,
        genericLogger,
        testCorrelationId
      );

      expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledWith(
        undefined,
        {
          params: {
            eServiceId: eservice.id,
            descriptorId: descriptor.id,
          },
          headers: testHeaders,
        }
      );
    });

    it("should call archive Descriptor when all Agreements are Archived, the Descriptor is suspended, and a newer Descriptor exists", async () => {
      const producerId: TenantId = generateId();
      const descriptor = {
        ...getMockDescriptorPublished(),
        state: descriptorState.suspended,
        version: "1",
      };

      const newerDescriptor = {
        ...getMockDescriptorPublished(),
        version: "2",
      };

      const eservice = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor, newerDescriptor],
      };
      const archivedAgreement = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      // Relating agreements: same descriptor, same eservice, different consumer
      const otherAgreement1 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      const otherAgreement2 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(archivedAgreement);
      await addOneAgreement(otherAgreement1);
      await addOneAgreement(otherAgreement2);

      await archiveDescriptorForArchivedAgreement(
        archivedAgreement,
        mockRefreshableToken,
        readModelService,
        catalogProcessClient,
        genericLogger,
        testCorrelationId
      );

      expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledWith(
        undefined,
        {
          params: {
            eServiceId: eservice.id,
            descriptorId: descriptor.id,
          },
          headers: testHeaders,
        }
      );
    });

    it("should not call archive Descriptor when not all Agreements are Archived", async () => {
      const producerId: TenantId = generateId();
      const descriptor = getMockDescriptorPublished();

      const eservice = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };
      const archivedAgreement = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      // Relating agreements: same descriptor, same eservice, different consumer
      const otherAgreement1 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      const otherAgreement2 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.active
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(archivedAgreement);
      await addOneAgreement(otherAgreement1);
      await addOneAgreement(otherAgreement2);

      await archiveDescriptorForArchivedAgreement(
        archivedAgreement,
        mockRefreshableToken,
        readModelService,
        catalogProcessClient,
        genericLogger,
        testCorrelationId
      );

      expect(catalogProcessClient.archiveDescriptor).not.toHaveBeenCalled();
    });

    it("should not call archive Descriptor when the Descriptor not deprecated or suspended", async () => {
      const producerId: TenantId = generateId();
      const descriptor = {
        ...getMockDescriptorPublished(),
        state: descriptorState.published,
      };

      const eservice = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };
      const archivedAgreement = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      // Relating agreements: same descriptor, same eservice, different consumer
      const otherAgreement1 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      const otherAgreement2 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(archivedAgreement);
      await addOneAgreement(otherAgreement1);
      await addOneAgreement(otherAgreement2);

      await archiveDescriptorForArchivedAgreement(
        archivedAgreement,
        mockRefreshableToken,
        readModelService,
        catalogProcessClient,
        genericLogger,
        testCorrelationId
      );

      expect(catalogProcessClient.archiveDescriptor).not.toHaveBeenCalled();
    });

    it("should not call archive Descriptor when the Descriptor is suspended but no newer Descriptor exists", async () => {
      const producerId: TenantId = generateId();
      const descriptor = {
        ...getMockDescriptorPublished(),
        state: descriptorState.suspended,
        version: "1",
      };

      const eservice = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };
      const archivedAgreement = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      // Relating agreements: same descriptor, same eservice, different consumer
      const otherAgreement1 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      const otherAgreement2 = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        descriptorId: descriptor.id,
        producerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(archivedAgreement);
      await addOneAgreement(otherAgreement1);
      await addOneAgreement(otherAgreement2);

      await archiveDescriptorForArchivedAgreement(
        archivedAgreement,
        mockRefreshableToken,
        readModelService,
        catalogProcessClient,
        genericLogger,
        testCorrelationId
      );

      expect(catalogProcessClient.archiveDescriptor).not.toHaveBeenCalled();
    });

    it("should throw an error when the EService is not found", async () => {
      const archivedAgreement = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        agreementState.archived
      );

      await expect(
        archiveDescriptorForArchivedAgreement(
          archivedAgreement,
          mockRefreshableToken,
          readModelService,
          catalogProcessClient,
          genericLogger,
          testCorrelationId
        )
      ).rejects.toThrowError(
        genericInternalError(
          `EService not found for agreement ${archivedAgreement.id}`
        )
      );
    });

    it("should throw an error when the Descriptor is not found", async () => {
      const producerId: TenantId = generateId();
      const eservice = {
        ...getMockEService(),
        producerId,
      };
      const archivedAgreement = {
        ...getMockAgreement(
          eservice.id,
          generateId<TenantId>(),
          agreementState.archived
        ),
        producerId,
      };

      await addOneEService(eservice);

      await expect(
        archiveDescriptorForArchivedAgreement(
          archivedAgreement,
          mockRefreshableToken,
          readModelService,
          catalogProcessClient,
          genericLogger,
          testCorrelationId
        )
      ).rejects.toThrowError(
        genericInternalError(
          `Descriptor not found for agreement ${archivedAgreement.id}`
        )
      );
    });
  });
});
