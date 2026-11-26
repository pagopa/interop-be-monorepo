import { piiValidatorApi } from "pagopa-interop-api-clients";

import {
  DetectionTransport,
  PersonalDataPrevention,
  PreventionPolicy,
  PersonalDataRejectedError,
  PersonalDataPreventionUnavailableError,
} from "./types.js";

export function createPersonalDataPrevention({
  transport,
  policy,
}: {
  transport: DetectionTransport;
  policy: PreventionPolicy;
}): PersonalDataPrevention {
  return {
    async assertAllowed(request, context): Promise<void> {
      let blocked: boolean;
      try {
        const parsed = piiValidatorApi.DetectionRequest.parse(request);
        if (
          new Set(parsed.fields.map((field) => field.fieldId)).size !==
          parsed.fields.length
        ) {
          throw new PersonalDataPreventionUnavailableError();
        }
        const response = piiValidatorApi.DetectionResponse.parse(
          await transport(parsed, context)
        );
        if (
          response.results.length !== parsed.fields.length ||
          response.results.some((result, index) => {
            const field = parsed.fields[index];
            return (
              result.fieldId !== field.fieldId ||
              new Set(result.detectedCategories).size !==
                result.detectedCategories.length ||
              (field.text === "" && result.detectedCategories.length !== 0)
            );
          })
        ) {
          throw new PersonalDataPreventionUnavailableError();
        }
        // Validate the whole batch before applying the caller's decision policy.
        blocked = response.results.some((result) =>
          result.detectedCategories.some(policy)
        );
      } catch {
        // Never preserve transport, parser or injected-policy errors (including causes).
        throw new PersonalDataPreventionUnavailableError();
      }
      if (blocked) {
        throw new PersonalDataRejectedError();
      }
    },
  };
}
