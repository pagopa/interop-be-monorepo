import { z } from "zod";

export const Conditions = z.object({
  AudienceRestriction: z
    .array(z.object({ Audience: z.array(z.string()) }))
    .refine((a) => a.length > 0, { message: "Missing " }),
  NotBefore: z.string(),
  NotOnOrAfter: z.string(),
});
export type Conditions = z.infer<typeof Conditions>;

export const SAMLResponse = z
  .object({
    Response: z.object({
      Issuer: z.string(),
      Signature: z.object({
        SignedInfo: z.object({
          CanonicalizationMethod: z.object({ Algorithm: z.string() }),
          SignatureMethod: z.object({ Algorithm: z.string() }),
          Reference: z.object({
            Transforms: z.object({
              Transform: z.array(z.object({ Algorithm: z.string() })),
            }),
            DigestMethod: z.object({ Algorithm: z.string() }),
            DigestValue: z.string(),
            URI: z.string(),
          }),
        }),
        SignatureValue: z.string(),
        KeyInfo: z.object({
          X509Data: z.object({
            X509SubjectName: z.string(),
            X509Certificate: z.string(),
          }),
        }),
      }),
      Status: z.object({ StatusCode: z.object({ Value: z.string() }) }),
      Assertion: z
        .array(
          z.object({
            Issuer: z.string(),
            Subject: z.object({
              NameID: z.object({ "#text": z.string(), Format: z.string() }),
              SubjectConfirmation: z.object({
                SubjectConfirmationData: z.object({
                  NotOnOrAfter: z.string(),
                  Recipient: z.string(),
                }),
                Method: z.string(),
              }),
            }),
            Conditions,
            AttributeStatement: z.object({
              Attribute: z.object({
                AttributeValue: z.array(
                  z.object({
                    "#text": z.string(),
                    type: z.string(),
                  })
                ),
                Name: z.string(),
              }),
            }),
            AuthnStatement: z.object({
              AuthnContext: z.object({ AuthnContextClassRef: z.string() }),
              AuthnInstant: z.string(),
              SessionIndex: z.string(),
            }),
            ID: z.string(),
            IssueInstant: z.string(),
            Version: z.string(),
          })
        )
        .nonempty({ message: "Missing Assertions" }),
      Destination: z.string(),
      ID: z.string(),
      IssueInstant: z.string(),
      Version: z.string(),
    }),
  })
  .deepPartial();

export type SAMLResponse = z.infer<typeof SAMLResponse>;
