/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, AxiosHeaders } from "axios";
import { purposeApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { generateId, Problem } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { api, clients } from "../../vitest.api.setup.js";

const purpose = getMockedApiPurpose();
const correlationId = generateId();
const riskAnalysisForm = { version: "3.1", answers: { purpose: ["OTHER"] } };
const operations = [
  {
    name: "assignRiskAnalysisReviewer",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/assign`,
    body: {
      reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS",
      reviewerIds: [generateId()],
    },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0044",
  },
  {
    name: "submitRiskAnalysis",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/submit`,
    body: { riskAnalysisForm },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0047",
  },
  {
    name: "signRiskAnalysis",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/sign`,
    body: { metadataVersionToSign: 1 },
    role: authRole.REVIEWER_ROLE,
    conflictCode: "004-0049",
  },
  {
    name: "rejectRiskAnalysis",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/reject`,
    body: { rejectionReason: "The risk analysis needs revision" },
    role: authRole.REVIEWER_ROLE,
    conflictCode: "004-0052",
  },
  {
    name: "editRiskAnalysisForm",
    method: "put",
    path: `/purposes/${purpose.id}/riskAnalysis/form`,
    body: riskAnalysisForm,
    role: authRole.REVIEWER_ROLE,
    conflictCode: "004-0054",
  },
  {
    name: "updatePurpose",
    method: "post",
    path: `/purposes/${purpose.id}`,
    body: {
      title: "title",
      description: "description",
      isFreeOfCharge: false,
      dailyCalls: 1,
      riskAnalysisForm,
    },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0056",
  },
  {
    name: "patchUpdatePurposeFromTemplate",
    method: "patch",
    path: `/purposeTemplates/${generateId()}/purposes/${purpose.id}`,
    body: { riskAnalysisForm },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0056",
  },
] as const;
const lockOperations = [operations[2], operations[3], operations[4]];
const passthroughOperations = [
  operations[0],
  operations[1],
  operations[5],
  operations[6],
];

const upstreamError = (
  code: string,
  status = 409,
  additionalCodes: string[] = []
) => {
  const problem: Problem = {
    type: "about:blank",
    title: "Upstream conflict",
    status,
    detail: "Original process error",
    correlationId,
    errors: [code, ...additionalCodes].map((code) => ({
      code,
      detail: "Original process error",
    })),
  };
  return new AxiosError("process error", undefined, undefined, undefined, {
    status,
    statusText: "Conflict",
    data: problem,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
};

const setPurpose = (
  signingState: purposeApi.RiskAnalysisSigningState,
  version = 1
) => {
  vi.mocked(
    clients.purposeProcessClientWithMetadata.getPurpose
  ).mockResolvedValue({
    data: {
      ...purpose,
      reviewerWorkflow: { signingState, reviewers: [] },
    },
    metadata: { version },
  });
};

const makeRequest = (
  operation: (typeof operations)[number],
  token = generateToken(operation.role)
) =>
  request(api)
    [operation.method](`${appBasePath}${operation.path}`)
    .set("Authorization", `Bearer ${token}`)
    .set("X-Correlation-Id", correlationId)
    .send(operation.body);

describe("risk analysis process conflicts", () => {
  beforeEach(() => {
    config.featureFlagNewOperators = true;
    for (const operation of operations) {
      clients.purposeProcessClient[operation.name] = vi
        .fn()
        .mockRejectedValue(upstreamError(operation.conflictCode));
    }
    clients.purposeProcessClientWithMetadata.getPurpose = vi.fn();
    setPurpose("SIGNED");
  });

  it.each(passthroughOperations)(
    "preserves existing conflicts for $name",
    async (operation) => {
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(
        upstreamError(operation.conflictCode).response?.data
      );
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    }
  );

  describe.each(lockOperations)("$name", (operation) => {
    it.each([
      operation.conflictCode,
      "004-0066",
      "004-0067",
      "004-0064",
      "004-10034",
      "004-0016",
    ])(
      "forwards process conflict %s without diagnostic reads or retries",
      async (code) => {
        const error = upstreamError(code);
        vi.mocked(
          clients.purposeProcessClient[operation.name]
        ).mockRejectedValue(error);
        const token = generateToken(operation.role);

        const res = await makeRequest(operation, token);

        expect(res.status).toBe(409);
        expect(res.body).toEqual(error.response?.data);
        expect(
          clients.purposeProcessClient[operation.name]
        ).toHaveBeenCalledExactlyOnceWith(operation.body, {
          params: { purposeId: purpose.id },
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            "X-Correlation-Id": res.headers["x-correlation-id"],
          }),
        });
        expect(
          clients.purposeProcessClientWithMetadata.getPurpose
        ).not.toHaveBeenCalled();
      }
    );

    it("preserves mixed process errors without reclassifying them", async () => {
      const error = upstreamError(operation.conflictCode, 409, ["004-0016"]);
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        error
      );

      const res = await makeRequest(operation);

      expect(res.status).toBe(409);
      expect(res.body).toEqual(error.response?.data);
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    });

    it.each([400, 403, 404])(
      "preserves process status %s without diagnostic reads",
      async (status) => {
        const error = upstreamError(operation.conflictCode, status);
        vi.mocked(
          clients.purposeProcessClient[operation.name]
        ).mockRejectedValue(error);

        const res = await makeRequest(operation);

        expect(res.status).toBe(status);
        expect(res.body).toEqual(error.response?.data);
        expect(
          clients.purposeProcessClientWithMetadata.getPurpose
        ).not.toHaveBeenCalled();
      }
    );

    it("preserves network error handling without retries or diagnostic reads", async () => {
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        new AxiosError("network failure")
      );

      const res = await makeRequest(operation);

      expect(res.status).toBe(500);
      expect(
        clients.purposeProcessClient[operation.name]
      ).toHaveBeenCalledTimes(1);
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    });

    it("preserves the successful request and original seed", async () => {
      vi.mocked(clients.purposeProcessClient[operation.name]).mockResolvedValue(
        purpose
      );

      const res = await makeRequest(operation);

      expect(res.status).toBe(204);
      expect(
        clients.purposeProcessClient[operation.name]
      ).toHaveBeenCalledExactlyOnceWith(
        operation.body,
        expect.objectContaining({ params: { purposeId: purpose.id } })
      );
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    });
  });
});
