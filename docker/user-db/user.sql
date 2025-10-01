CREATE SCHEMA IF NOT EXISTS "user";

CREATE TABLE IF NOT EXISTS "user"."user" (
    user_id UUID PRIMARY KEY NOT NULL,
    tenant_id UUID NOT NULL,
    institution_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    family_name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    product_roles VARCHAR[] NOT NULL
);
