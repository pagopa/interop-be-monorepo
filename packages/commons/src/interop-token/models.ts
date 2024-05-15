export interface InteropJwtHeader {
  alg: string;
  use: string;
  typ: string;
  kid: string;
}
export interface InteropJwtPayload {
  jti: string;
  iss: string;
  aud: string[];
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
  role: string;
}

export interface InteropToken {
  header: InteropJwtHeader;
  payload: InteropJwtPayload;
  serialized: string;
}
