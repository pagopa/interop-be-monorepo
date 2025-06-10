import { z } from "zod";

export const AuthorizationServerTokenGenerationConfig = z
  .object({
    GENERATED_INTEROP_TOKEN_KID: z.string(),
    GENERATED_INTEROP_TOKEN_ISSUER: z.string(),

    /* 
      AUDIENCE and DURATION_SECONDS are used 
      to generate both M2M and M2M_ADMIN token.
    */
    GENERATED_INTEROP_TOKEN_M2M_AUDIENCE: z
      .string()
      .transform((s) => s.split(","))
      .pipe(z.array(z.string())),
    GENERATED_INTEROP_TOKEN_M2M_DURATION_SECONDS: z.string(),
  })
  .transform((c) => ({
    generatedInteropTokenKid: c.GENERATED_INTEROP_TOKEN_KID,
    generatedInteropTokenIssuer: c.GENERATED_INTEROP_TOKEN_ISSUER,
    generatedInteropTokenM2MAudience: c.GENERATED_INTEROP_TOKEN_M2M_AUDIENCE,
    generatedInteropTokenM2MDurationSeconds: parseInt(
      c.GENERATED_INTEROP_TOKEN_M2M_DURATION_SECONDS,
      10
    ),
  }));

export type AuthorizationServerTokenGenerationConfig = z.infer<
  typeof AuthorizationServerTokenGenerationConfig
>;
