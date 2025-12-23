// import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// import { generateToken } from "pagopa-interop-commons-test";
// import {
//     generateId,
//     invalidDocumentDetected,
//     pollingMaxRetriesExceeded,
//     PurposeTemplateId,
// } from "pagopa-interop-models";
// import { AuthRole, authRole } from "pagopa-interop-commons";
// import request from "supertest";
// import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
// import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
// import { appBasePath } from "../../../src/config/appBasePath.js";
// import { missingMetadata } from "../../../src/model/errors.js";
// import {
//     TestMultipartFileAnnotationDocumentUpload,
//     addTestMultipartFileAnnotationDocumentToSupertestRequest,
// } from "../../multipartTestUtils.js";
// import { config } from "../../../src/config/config.js";

// describe("POST /purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments router test", () => {
//     const mockDate = new Date();
//     beforeEach(() => {
//         vi.useFakeTimers();
//         vi.setSystemTime(mockDate);
//     });
//     afterEach(() => {
//         vi.useRealTimers();
//     });

//     const answerId = generateId();

//     const mockFileUpload = {
//         fileContent: Buffer.from("test content"),
//         filename: "test_document.pdf",
//         contentType: "application/pdf",
//         prettyName: "Test Document",
//         answerId,
//     };

//     const mockM2MAnswerAnnotationDocumentResponse: m2mGatewayApiV3.Document = {
//         id: generateId(),
//         prettyName: mockFileUpload.prettyName,
//         name: mockFileUpload.filename,
//         contentType: mockFileUpload.contentType,
//         createdAt: mockDate.toISOString(),
//     };

//     const makeRequest = async (
//         token: string,
//         purposeTemplateId: PurposeTemplateId,
//         file: TestMultipartFileAnnotationDocumentUpload
//     ) => {
//         const req = request(api)
//             .post(
//                 `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/annotationDocuments`
//             )
//             .set("Authorization", `Bearer ${token}`);

//         return addTestMultipartFileAnnotationDocumentToSupertestRequest(req, file);
//     };

//     const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
//     it.each(authorizedRoles)(
//         "Should return 201 and perform service calls for user with role %s",
//         async (role) => {
//             const purposeTemplateId = generateId<PurposeTemplateId>();
//             mockPurposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument =
//                 vi.fn().mockResolvedValue(mockM2MAnswerAnnotationDocumentResponse);

//             const token = generateToken(role);
//             const res = await makeRequest(token, purposeTemplateId, mockFileUpload);

//             expect(res.status).toBe(201);
//             expect(res.body).toEqual(mockM2MAnswerAnnotationDocumentResponse);
//             expect(
//                 mockPurposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument
//             ).toHaveBeenCalledWith(
//                 purposeTemplateId,
//                 expect.objectContaining({
//                     file: expect.any(File),
//                     prettyName: mockFileUpload.prettyName,
//                     answerId: mockFileUpload.answerId,
//                 }),
//                 expect.any(Object) // Context object
//             );
//         }
//     );

//     it.each(
//         Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
//     )("Should return 403 for user with role %s", async (role) => {
//         const token = generateToken(role);
//         const res = await makeRequest(token, generateId(), mockFileUpload);
//         expect(res.status).toBe(403);
//     });

//     it("Should return 400 for incorrect value for purpose template id", async () => {
//         mockPurposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument =
//             vi.fn().mockResolvedValue(mockM2MAnswerAnnotationDocumentResponse);

//         const token = generateToken(authRole.M2M_ROLE);
//         const res = await makeRequest(
//             token,
//             "INVALID ID" as PurposeTemplateId,
//             mockFileUpload
//         );
//         expect(res.status).toBe(400);
//     });

//     it.each([
//         { ...mockFileUpload, fileContent: undefined },
//         { ...mockFileUpload, filename: undefined },
//         { ...mockFileUpload, prettyName: undefined },
//         { ...mockFileUpload, answerId: undefined },
//     ])(
//         "Should return 400 if passed an invalid multipart body",
//         async (multipartFields) => {
//             const token = generateToken(authRole.M2M_ADMIN_ROLE);
//             const res = await makeRequest(
//                 token,
//                 generateId(),
//                 multipartFields as TestMultipartFileAnnotationDocumentUpload
//             );

//             expect(res.status).toBe(400);
//         }
//     );

//     it.each([
//         missingMetadata(),
//         pollingMaxRetriesExceeded(
//             config.defaultPollingMaxRetries,
//             config.defaultPollingRetryDelay
//         ),
//         invalidDocumentDetected(generateId()),
//     ])("Should return 500 in case of $code error", async (error) => {
//         mockPurposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument =
//             vi.fn().mockRejectedValue(error);
//         const token = generateToken(authRole.M2M_ADMIN_ROLE);
//         const res = await makeRequest(token, generateId(), mockFileUpload);

//         expect(res.status).toBe(500);
//     });

//     it.each([
//         { ...mockM2MAnswerAnnotationDocumentResponse, id: "invalidId" },
//         { ...mockM2MAnswerAnnotationDocumentResponse, id: undefined },
//         { ...mockM2MAnswerAnnotationDocumentResponse, name: undefined },
//         { ...mockM2MAnswerAnnotationDocumentResponse, name: 12341 },
//         { ...mockM2MAnswerAnnotationDocumentResponse, contentType: undefined },
//         { ...mockM2MAnswerAnnotationDocumentResponse, prettyName: undefined },
//         { ...mockM2MAnswerAnnotationDocumentResponse, createdAt: undefined },
//         { ...mockM2MAnswerAnnotationDocumentResponse, createdAt: "invalidDate" },
//         {
//             ...mockM2MAnswerAnnotationDocumentResponse,
//             invalidParam: "invalidValue",
//         },
//     ])(
//         "Should return 500 when API model parsing fails for response",
//         async (resp) => {
//             mockPurposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument =
//                 vi.fn().mockResolvedValueOnce(resp);
//             const token = generateToken(authRole.M2M_ADMIN_ROLE);
//             const res = await makeRequest(token, generateId(), mockFileUpload);

//             expect(res.status).toBe(500);
//         }
//     );
// });
