import { piiValidatorApi } from "pagopa-interop-api-clients";

export type DetectionRequest = piiValidatorApi.DetectionRequest;
export type DetectionContext = { correlationId: string };
export type DetectionTransport = (
  request: DetectionRequest,
  context: DetectionContext
) => Promise<unknown>;
export type PreventionPolicy = (
  category: piiValidatorApi.PiiCategory
) => boolean;
export class PersonalDataPreventionUnavailableError extends Error {
  readonly code = "PERSONAL_DATA_PREVENTION_UNAVAILABLE";
  constructor() {
    super("Personal data prevention unavailable");
    this.name = "PersonalDataPreventionUnavailableError";
  }
}

export class PersonalDataRejectedError extends Error {
  readonly code = "PERSONAL_DATA_REJECTED";
  constructor() {
    super("Personal data rejected");
    this.name = "PersonalDataRejectedError";
  }
}

export interface PersonalDataPrevention {
  assertAllowed(
    request: DetectionRequest,
    context: DetectionContext
  ): Promise<void>;
}
