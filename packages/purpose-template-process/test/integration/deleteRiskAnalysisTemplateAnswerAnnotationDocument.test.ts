/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockValidRiskAnalysisFormTemplate,
  sortBy,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  RiskAnalysisFormTemplate,
  targetTenantKind,
  PurposeTemplate,
  toPurposeTemplateV2,
  purposeTemplateState,
  TenantId,
  generateId,
  PurposeTemplateAnnotationDocumentDeletedV2,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
} from "pagopa-interop-models";
import { expect, describe, it, vi } from "vitest";

import { config } from "../../src/config/config.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOnePurposeTemplate,
  fileManager,
  protobufCleanUndefined,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
  postgresDB,
} from "../integrationUtils.js";

describe("deleteRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  const mockDocument1 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const mockDocument2 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const annotationDocument1 = {
    ...mockDocument1,
    path: `${config.purposeTemplateDocumentsPath}/${mockDocument1.id}/${mockDocument1.name}`,
  };
  const annotationDocument2 = {
    ...mockDocument2,
    path: `${config.purposeTemplateDocumentsPath}/${mockDocument2.id}/${mockDocument2.name}`,
  };

  const incompleteRiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(targetTenantKind.PA);
  const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
    ...incompleteRiskAnalysisFormTemplate,
    singleAnswers: [
      {
        ...incompleteRiskAnalysisFormTemplate.singleAnswers[0],
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [annotationDocument1, annotationDocument2],
        },
      },
    ],
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
  };

  it.each(["document", "annotation", "template"] as const)(
    "should not delete annotation files if the event-store rejects the %s deletion",
    async (kind) => {
      await addOnePurposeTemplate(purposeTemplate);
      const documents = [annotationDocument1, annotationDocument2];
      const content = Buffer.from("original annotation document");
      for (const document of documents) {
        await fileManager.storeBytesByKey(
          config.s3Bucket,
          document.path,
          content,
          genericLogger
        );
      }
      await writeInEventstore(
        {
          stream_id: purposeTemplate.id,
          version: 1,
          event: {
            type: "PurposeTemplateAdded",
            event_version: 2,
            data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
          },
        },
        "purpose_template",
        postgresDB
      );
      const deletion = vi.spyOn(fileManager, "delete").mockClear();
      const ctx = getMockContext({
        authData: getMockAuthData(purposeTemplate.creatorId),
      });
      const deleteResource = (): Promise<unknown> => {
        if (kind === "document") {
          return purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
            {
              purposeTemplateId: purposeTemplate.id,
              answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
              documentId: annotationDocument1.id,
              ctx,
            }
          );
        }
        if (kind === "annotation") {
          return purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation(
            {
              purposeTemplateId: purposeTemplate.id,
              answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
              ctx,
            }
          );
        }
        return purposeTemplateService.deletePurposeTemplate(
          purposeTemplate.id,
          ctx
        );
      };

      await expect(deleteResource()).rejects.toMatchObject({
        code: "eventConflictError",
      });

      expect(deletion).not.toHaveBeenCalled();
      for (const document of documents) {
        expect(
          await fileManager.get(config.s3Bucket, document.path, genericLogger)
        ).toEqual(new Uint8Array(content));
      }
      expect(
        (await readLastPurposeTemplateEvent(purposeTemplate.id)).version
      ).toBe("1");
    }
  );

  it("should persist the event and log a deletion failure without failing", async () => {
    await addOnePurposeTemplate(purposeTemplate);
    const content = Buffer.from("original annotation document");
    await fileManager.storeBytesByKey(
      config.s3Bucket,
      annotationDocument1.path,
      content,
      genericLogger
    );
    const deletionError = fileManagerDeleteError(
      annotationDocument1.path,
      config.s3Bucket,
      new Error("Simulated deletion failure")
    );
    vi.spyOn(fileManager, "delete").mockRejectedValueOnce(deletionError);
    const logError = vi
      .spyOn(genericLogger, "error")
      .mockReturnThis()
      .mockClear();

    await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
      {
        purposeTemplateId: purposeTemplate.id,
        answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
        documentId: annotationDocument1.id,
        ctx: getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        }),
      }
    );

    expect(
      await readLastPurposeTemplateEvent(purposeTemplate.id)
    ).toMatchObject({
      type: "PurposeTemplateAnnotationDocumentDeleted",
      version: "1",
    });
    expect(
      await fileManager.get(
        config.s3Bucket,
        annotationDocument1.path,
        genericLogger
      )
    ).toEqual(new Uint8Array(content));
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(
        `s3://${config.s3Bucket}/${annotationDocument1.path}`
      )
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(deletionError.message)
    );
  });

  it("should write on event-store for the deletion of a risk analysis template answer annotation document", async () => {
    vi.spyOn(fileManager, "delete");

    await addOnePurposeTemplate(purposeTemplate);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.purposeTemplateDocumentsPath,
        resourceId: annotationDocument1.id,
        name: annotationDocument1.name,
        content: Buffer.from("test-test"),
      },
      genericLogger
    );

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.purposeTemplateDocumentsPath,
        resourceId: annotationDocument2.id,
        name: annotationDocument2.name,
        content: Buffer.from("test-test"),
      },
      genericLogger
    );

    const filePathsBeforeDeletion = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(filePathsBeforeDeletion).toContain(annotationDocument1.path);
    expect(filePathsBeforeDeletion).toContain(annotationDocument2.path);

    const response =
      await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
          documentId: annotationDocument1.id,
          ctx: getMockContext({
            authData: getMockAuthData(purposeTemplate.creatorId),
          }),
        }
      );

    const annotationDocumentDeletionEvent = await readLastPurposeTemplateEvent(
      purposeTemplate.id
    );

    expect(annotationDocumentDeletionEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "1",
      type: "PurposeTemplateAnnotationDocumentDeleted",
      event_version: 2,
    });

    const annotationDocumentDeletionPayload = decodeProtobufPayload({
      messageType: PurposeTemplateAnnotationDocumentDeletedV2,
      payload: annotationDocumentDeletionEvent.data,
    });

    const expectedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      purposeRiskAnalysisForm: {
        ...riskAnalysisFormTemplate,
        singleAnswers: [
          {
            ...riskAnalysisFormTemplate.singleAnswers[0],
            annotation: {
              ...riskAnalysisFormTemplate.singleAnswers[0].annotation!,
              docs: [annotationDocument2],
            },
          },
        ],
      },
    };

    const expectedPurposeTemplateV2 = protobufCleanUndefined(
      toPurposeTemplateV2(expectedPurposeTemplate)
    );

    annotationDocumentDeletionPayload.purposeTemplate?.purposeRiskAnalysisForm?.multiAnswers?.sort(
      sortBy((a: { key: string }) => a.key)
    );
    expectedPurposeTemplateV2.purposeRiskAnalysisForm?.multiAnswers?.sort(
      sortBy((a: { key: string }) => a.key)
    );

    expect(annotationDocumentDeletionPayload).toEqual({
      purposeTemplate: expectedPurposeTemplateV2,
      documentId: annotationDocument1.id,
    });

    expect(response).toEqual({
      data: annotationDocument1,
      metadata: { version: 1 },
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      annotationDocument1.path,
      genericLogger
    );

    const filePathsAfterDeletion = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(filePathsAfterDeletion).not.toContain(annotationDocument1.path);
    expect(filePathsAfterDeletion).toContain(annotationDocument2.path);
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", () => {
    void expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
          documentId: annotationDocument1.id,
          ctx: getMockContext({
            authData: getMockAuthData(purposeTemplate.creatorId),
          }),
        }
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("should throw purposeTemplateNotFound if the requester is not the creator", async () => {
    const requesterId = generateId<TenantId>();

    await addOnePurposeTemplate(purposeTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
          documentId: annotationDocument1.id,
          ctx: getMockContext({
            authData: getMockAuthData(requesterId),
          }),
        }
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("should throw purposeTemplateRiskAnalysisFormNotFound if the purpose template doesn't have a risk analysis template", async () => {
    const purposeTemplateWithoutRiskAnalysisTemplate = getMockPurposeTemplate();

    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysisTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplateWithoutRiskAnalysisTemplate.id,
          answerId: generateId<RiskAnalysisMultiAnswerId>(),
          documentId: generateId(),
          ctx: getMockContext({
            authData: getMockAuthData(
              purposeTemplateWithoutRiskAnalysisTemplate.creatorId
            ),
          }),
        }
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(
        purposeTemplateWithoutRiskAnalysisTemplate.id
      )
    );
  });

  it("should throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound if the risk analysis template answer annotation document doesn't exist", async () => {
    const answerId = generateId<RiskAnalysisMultiAnswerId>();
    const documentId =
      generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

    await addOnePurposeTemplate(purposeTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId,
          documentId,
          ctx: getMockContext({
            authData: getMockAuthData(purposeTemplate.creatorId),
          }),
        }
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
        purposeTemplate.id,
        documentId,
        answerId
      )
    );
  });

  it.each(
    Object.values(purposeTemplateState).filter(
      (state) => state !== purposeTemplateState.draft
    )
  )(
    "should throw purposeTemplateNotInExpectedState if the purpose template is in %s state",
    async (state) => {
      const purposeTemplateNotInWrongState: PurposeTemplate = {
        ...purposeTemplate,
        state,
      };

      await addOnePurposeTemplate(purposeTemplateNotInWrongState);
      expect(
        purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
          {
            purposeTemplateId: purposeTemplate.id,
            answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
            documentId: annotationDocument1.id,
            ctx: getMockContext({
              authData: getMockAuthData(purposeTemplate.creatorId),
            }),
          }
        )
      ).rejects.toThrowError(
        purposeTemplateNotInExpectedStates(
          purposeTemplateNotInWrongState.id,
          purposeTemplateNotInWrongState.state,
          [purposeTemplateState.draft]
        )
      );
    }
  );
});
