import { z } from "zod";
import { genericError } from "pagopa-interop-models";
import { createApiClient } from "../../model/generated/api.js";

const SelfCareConfigSchema = z.object({
  SELFCARE_V2_URL: z.string(),
  SELFCARE_V2_API_KEY: z.string(),
});

const selfCareConfig = SelfCareConfigSchema.safeParse(process.env);
if (!selfCareConfig.success) {
  const invalidEnvVars = selfCareConfig.error.issues.flatMap(
    (issue) => issue.path
  );

  throw genericError(
    "Invalid or missing env vars: " + invalidEnvVars.join(", ")
  );
}

export const selfcareV2Client = createApiClient(
  selfCareConfig.data.SELFCARE_V2_URL,
  {
    axiosConfig: {
      headers: {
        "Ocp-Apim-Subscription-Key": selfCareConfig.data.SELFCARE_V2_API_KEY,
      },
    },
  }
);
