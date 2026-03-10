// test/jwks-server.ts
import { createServer, Server } from "http";
import { AddressInfo } from "net";
import { JWK } from "jose";

export interface JwksServer {
  url: string;
  // eslint-disable-next-line functional/no-method-signature
  close(): Promise<void>;
}

export async function startJwksServer(publicJwk: JWK): Promise<JwksServer> {
  const server: Server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/.well-known/jwks.json") {
      const body = JSON.stringify({ keys: [publicJwk] });

      // eslint-disable-next-line functional/immutable-data
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(body);
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}
