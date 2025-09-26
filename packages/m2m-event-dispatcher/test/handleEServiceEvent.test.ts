/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockEService } from "pagopa-interop-commons-test";
import {
  toEServiceV2,
  EServiceEventV2,
  EServiceEventEnvelopeV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { handleEServiceEvent } from "../src/handlers/handleEServiceEvent.js";
import {
  getMockEventEnvelopeCommons,
  testM2mEventWriterService,
  testReadModelService,
} from "./utils.js";

describe("handleEServiceEvent test", async () => {
  const eservice = getMockEService();
  vi.spyOn(testM2mEventWriterService, "insertEServiceM2MEvent");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(
    EServiceEventV2.options.map((o) => ({
      ...getMockEventEnvelopeCommons(),
      stream_id: eservice.id,
      type: o.shape.type.value,
      data: {
        eservice: toEServiceV2(eservice),
      },
    })) as EServiceEventEnvelopeV2[]
  )(
    "should write M2M event for AttributeAdded event",
    async (message: EServiceEventEnvelopeV2) => {
      const eventTimestamp = new Date();

      await handleEServiceEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService,
        testReadModelService
      );

      await match(message)
        .with(
          {
            type: P.union(
              "EServiceAdded",
              "DraftEServiceUpdated",
              "EServiceCloned",
              "EServiceDeleted",
              "EServiceNameUpdated",
              "EServiceDescriptionUpdated",
              "EServiceIsConsumerDelegableEnabled",
              "EServiceIsConsumerDelegableDisabled",
              "EServiceIsClientAccessDelegableEnabled",
              "EServiceIsClientAccessDelegableDisabled",
              "EServiceNameUpdatedByTemplateUpdate",
              "EServiceDescriptionUpdatedByTemplateUpdate",
              "EServiceSignalHubEnabled",
              "EServiceSignalHubDisabled",
              "EServiceRiskAnalysisAdded",
              "EServiceRiskAnalysisUpdated",
              "EServiceRiskAnalysisDeleted"
            ),
          },
          async (m) => {
            expect(
              testM2mEventWriterService.insertEServiceM2MEvent
            ).toHaveBeenCalledTimes(1);
            // TODO
          }
        )
        .with(
          {
            type: P.union(
              "EServiceDescriptorPublished",
              "EServiceDescriptorActivated",
              "EServiceDescriptorApprovedByDelegator",
              "EServiceDescriptorSuspended",
              "EServiceDescriptorArchived",
              "EServiceDescriptorQuotasUpdated",
              "EServiceDescriptorAgreementApprovalPolicyUpdated",
              "EServiceDescriptorAdded",
              "EServiceDraftDescriptorDeleted",
              "EServiceDraftDescriptorUpdated",
              "EServiceDescriptorAttributesUpdated",
              "EServiceDescriptorSubmittedByDelegate",
              "EServiceDescriptorRejectedByDelegator",
              "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
              "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
              "EServiceDescriptorDocumentAdded",
              "EServiceDescriptorDocumentUpdated",
              "EServiceDescriptorDocumentDeleted",
              "EServiceDescriptorDocumentAddedByTemplateUpdate",
              "EServiceDescriptorDocumentDeletedByTemplateUpdate",
              "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
              "EServiceDescriptorInterfaceAdded",
              "EServiceDescriptorInterfaceUpdated",
              "EServiceDescriptorInterfaceDeleted"
            ),
          },
          async (m) => {
            expect(
              testM2mEventWriterService.insertEServiceM2MEvent
            ).toHaveBeenCalledTimes(1);
            // TODO
          }
        )
        .exhaustive();
    }
  );
});
