import { isAxiosError } from "axios";
import { purposeApi } from "pagopa-interop-api-clients";
import {
  commonErrorCodes,
  ProblemSchema,
  PurposeId,
  serviceErrorCode,
  serviceName,
} from "pagopa-interop-models";

import {
  riskAnalysisAlreadyApproved,
  riskAnalysisAlreadyRejected,
  riskAnalysisVersionChanged,
} from "../model/errors.js";
import { Headers } from "../utilities/context.js";

type RiskAnalysisOperation =
  | { type: "assign" | "submit" | "reject" | "edit" }
  | { type: "sign"; metadataVersionToSign: number }
  | {
      type: "update";
      riskAnalysisForm: purposeApi.RiskAnalysisFormSeed | undefined;
    };

const processPrefix = serviceErrorCode[serviceName.PURPOSE_PROCESS];
const eventConflictCode = `${processPrefix}-${commonErrorCodes.eventConflictError}`;
const versionMismatchCode = `${processPrefix}-0064`;
// Only state/version conflicts can be classified. Mode, validation and unrelated
// purpose conflicts must keep the original process Problem.
const conflictCodes: Record<RiskAnalysisOperation["type"], string[]> = {
  assign: ["0044"],
  submit: ["0047"],
  sign: ["0049", "0064"],
  reject: ["0052"],
  edit: ["0054"],
  update: ["0056"],
};

const formDiffers = (
  input: purposeApi.RiskAnalysisFormSeed,
  existing: purposeApi.RiskAnalysisForm | undefined
): boolean => {
  if (!existing || input.version !== existing.version) {
    return true;
  }
  const sortAnswers = (answers: Record<string, string[]>): string =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(answers).sort(([a], [b]) => a.localeCompare(b))
      )
    );
  return sortAnswers(input.answers) !== sortAnswers(existing.answers);
};

export const riskAnalysisConflictHandlerBuilder =
  (
    purposeProcessClientWithMetadata: purposeApi.PurposeProcessClientWithMetadata
  ) =>
  async <T>(
    mutation: () => Promise<T>,
    {
      purposeId,
      operation,
      headers,
    }: {
      purposeId: PurposeId;
      operation: RiskAnalysisOperation;
      headers: Headers;
    }
  ): Promise<T> => {
    try {
      return await mutation();
    } catch (error) {
      if (!isAxiosError<unknown>(error) || error.response?.status !== 409) {
        throw error;
      }
      const problem = ProblemSchema.safeParse(error.response.data);
      if (
        !problem.success ||
        !problem.data.errors?.length ||
        !problem.data.errors.every(
          ({ code }) =>
            code === eventConflictCode ||
            conflictCodes[operation.type].some(
              (suffix) => code === `${processPrefix}-${suffix}`
            )
        ) ||
        (operation.type === "update" && !operation.riskAnalysisForm)
      ) {
        throw error;
      }

      const knownVersionMismatch = problem.data.errors.some(
        ({ code }) => code === versionMismatchCode
      );
      const fallbackError = knownVersionMismatch
        ? riskAnalysisVersionChanged(purposeId)
        : error;

      // A failed diagnostic read must not hide the mutation's original conflict.
      // Use the process directly: enrichment is unnecessary and can fail on
      // unrelated resources. Never retry the mutation or replace its sign seed.
      const purpose = await purposeProcessClientWithMetadata
        .getPurpose({ params: { id: purposeId }, headers })
        .catch(() => undefined);
      if (!purpose) {
        throw fallbackError;
      }

      const signingState = purpose.data.reviewerWorkflow?.signingState;
      const isEventConflict = problem.data.errors.some(
        ({ code }) => code === eventConflictCode
      );
      if (
        signingState === "SIGNED" &&
        (operation.type !== "update" ||
          !isEventConflict ||
          (operation.riskAnalysisForm &&
            formDiffers(
              operation.riskAnalysisForm,
              purpose.data.riskAnalysisForm
            )))
      ) {
        throw riskAnalysisAlreadyApproved(purposeId);
      }
      if (
        signingState === "REJECTED" &&
        (operation.type === "sign" ||
          operation.type === "reject" ||
          operation.type === "edit")
      ) {
        throw riskAnalysisAlreadyRejected(purposeId);
      }
      if (
        operation.type === "sign" &&
        purpose.metadata &&
        purpose.metadata.version > operation.metadataVersionToSign
      ) {
        throw riskAnalysisVersionChanged(purposeId);
      }
      // A lagging readmodel or another non-blocking state cannot prove the cause.
      throw fallbackError;
    }
  };
