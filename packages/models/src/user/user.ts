import { z } from "zod";

export const certificationType = {
  NONE: "NONE",
  SPID: "SPID",
} as const;

export const CertificationType = z.enum([
  Object.values(certificationType)[0],
  ...Object.values(certificationType).slice(1),
]);

export type CertificationType = z.infer<typeof CertificationType>;

export const CertifiableFieldResourceOfLocalDate = z.object({
  certification: CertificationType,
  value: z.date(),
});
export type CertifiableFieldResourceOfLocalDate = z.infer<
  typeof CertifiableFieldResourceOfLocalDate
>;

export const CertifiableFieldResourceOfstring = z.object({
  certification: CertificationType,
  value: z.string(),
});
export type CertifiableFieldResourceOfstring = z.infer<
  typeof CertifiableFieldResourceOfstring
>;

export const WorkContactResource = z.object({
  email: CertifiableFieldResourceOfstring.optional(),
});
export type WorkContactResource = z.infer<typeof WorkContactResource>;

export const WorkContracts = z.map(z.string(), WorkContactResource);
export type WorkContracts = z.infer<typeof WorkContracts>;

export const UserResource = z.object({
  birthDate: CertifiableFieldResourceOfLocalDate.optional(),
  email: CertifiableFieldResourceOfstring.optional(),
  familyName: CertifiableFieldResourceOfstring.optional(),
  fiscalCode: z.string().optional(),
  id: z.string().uuid(),
  name: CertifiableFieldResourceOfstring.optional(),
  workContacts: WorkContracts.optional(),
});

export type UserResource = z.infer<typeof UserResource>;
