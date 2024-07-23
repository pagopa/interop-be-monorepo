import { XMLParser } from "fast-xml-parser";
import { config } from "../config/config.js";
import { samlNotValid } from "../model/domain/errors.js";
import { SAMLResponse } from "../model/types.js";

const SUPPORT_LEVELS = ["L2", "L3"];
const SUPPORT_LEVEL_NAME = "supportLevel";

const TRANSFORM_ENVELOPED_SIGNATURE =
  "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const TRANSFORM_C14N_EXCL_OMIT_COMMENTS =
  "http://www.w3.org/2001/10/xml-exc-c14n#";
const TRANSFORM_C14N_EXCL_WITH_COMMENTS =
  "http://www.w3.org/2001/10/xml-exc-c14n#WithComments";

const validateSignature = (saml: SAMLResponse): void => {
  const response = saml.Response;
  const reference = response?.Signature?.SignedInfo?.Reference;
  if (!reference) {
    throw samlNotValid("Missing Signature Reference");
  }

  const uri = reference.URI;
  const id = response?.ID;
  if (uri) {
    if (!uri.startsWith("#")) {
      throw samlNotValid(
        "Signature Reference URI was not a document fragment reference"
      );
    }
    if (!id) {
      throw samlNotValid("SignableSAMLObject did not contain an ID attribute");
    }
    if (uri.length < 2 && uri !== `#${id}`) {
      throw samlNotValid(
        `Reference URI '${uri}' did not point to SignableSAMLObject with ID '${id}'`
      );
    }
  }

  const transforms = reference.Transforms?.Transform;
  if (!transforms) {
    throw samlNotValid("Missing Transforms");
  }
  if (transforms.length > 2) {
    throw samlNotValid("Transforms are not compliant");
  }
  const atLeastOneEnvelopedSignature = transforms.some(
    (t) => t.Algorithm === TRANSFORM_ENVELOPED_SIGNATURE
  );
  const allAlgorithmsAreValid = transforms.every(
    (t) =>
      t.Algorithm &&
      [
        TRANSFORM_ENVELOPED_SIGNATURE,
        TRANSFORM_C14N_EXCL_OMIT_COMMENTS,
        TRANSFORM_C14N_EXCL_WITH_COMMENTS,
      ].includes(t.Algorithm)
  );
  if (!atLeastOneEnvelopedSignature || !allAlgorithmsAreValid) {
    throw samlNotValid("Transforms are not compliant");
  }
};

export const validateSamlResponse = (samlResponse: string): SAMLResponse => {
  const xml = new XMLParser({
    ignoreDeclaration: true,
    removeNSPrefix: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name) =>
      [
        "Assertion",
        "AudienceRestriction",
        "Audience",
        "AttributeValue",
        "Transform",
      ].indexOf(name) !== -1,
  }).parse(samlResponse);

  const { success, data: saml, error } = SAMLResponse.safeParse(xml);

  if (!success) {
    throw samlNotValid(error.message);
  }

  if (!saml.Response) {
    throw samlNotValid("Response not found");
  }
  const response = saml.Response;
  if (!response.Signature) {
    throw samlNotValid("Missing Signature");
  }
  if (!response.Assertion || response.Assertion.length === 0) {
    throw samlNotValid("Missing Assertions");
  }
  const assertions = response.Assertion;
  const conditions = assertions
    .flatMap((a) => a.Conditions)
    .filter(filterUndefined);
  const audienceRestrictions = conditions
    .flatMap((c) => c.AudienceRestriction)
    .filter(filterUndefined);
  if (audienceRestrictions.length === 0) {
    throw samlNotValid("Missing Audience Restriction");
  }
  const notBeforeConditions = conditions
    .map((c) => c.NotBefore)
    .filter(filterUndefined);
  if (notBeforeConditions.length === 0) {
    throw samlNotValid("Missing Not Before Restrictions");
  }
  const notOnOrAfterConditions = conditions
    .map((c) => c.NotOnOrAfter)
    .filter(filterUndefined);
  if (notOnOrAfterConditions.length === 0) {
    throw samlNotValid("Missing Not On Or After Restrictions");
  }
  const attributeStatements = assertions
    .flatMap((a) => a.AttributeStatement)
    .filter(filterUndefined);
  if (attributeStatements.length === 0) {
    throw samlNotValid("Missing Attribute Statement");
  }
  const attributes = attributeStatements
    .flatMap((a) => a.Attribute)
    .filter(filterUndefined);
  if (attributes.length === 0) {
    throw samlNotValid("Missing Attributes");
  }
  const now = +new Date();

  validateSignature(saml);

  if (!notBeforeConditions.every((nb) => now > +new Date(nb))) {
    throw samlNotValid("Conditions notbefore are not compliant");
  }
  if (!notOnOrAfterConditions.every((noa) => now < +new Date(noa))) {
    throw samlNotValid("Conditions NotOnOrAfter are not compliant");
  }

  if (
    !attributes.find(
      (a) =>
        a.Name === SUPPORT_LEVEL_NAME &&
        a.AttributeValue &&
        a.AttributeValue.some(
          (av) => av["#text"] && SUPPORT_LEVELS.includes(av["#text"])
        )
    )
  ) {
    throw samlNotValid("Support level is not compliant");
  }
  if (
    !audienceRestrictions
      .flatMap((ar) => ar.Audience)
      .some((aud) => aud === config.samlAudience)
  ) {
    throw samlNotValid("Conditions Audience is not compliant");
  }

  return saml;
};

const filterUndefined = <T>(x: T | undefined): x is T => x !== undefined;
