import { z } from "zod";
import { schemas } from "./generated/api.js";

const UserResponse = schemas.UserResponse.strip();
export type UserResponse = z.infer<typeof UserResponse>;

const UserResource = schemas.UserResource.strip();
export type UserResource = z.infer<typeof UserResource>;

const InstitutionResponse = schemas.Institution.strip();
export type InstitutionResponse = z.infer<typeof InstitutionResponse>;

const InstitutionResource = schemas.InstitutionResource.strip();
export type InstitutionResource = z.infer<typeof InstitutionResource>;

const ProductResource = schemas.ProductResource.strip();
export type ProductResource = z.infer<typeof ProductResource>;
