import ts from "typescript";

type ProcessCall = {
  client: string;
  method: string;
};

export function findProcessCalls(
  serviceFileName: string,
  serviceMethodName?: string,
): ProcessCall[] {
  if (!serviceMethodName) {
    return [];
  }
  if (serviceFileName === "NOT FOUND") {
    return [];
  }
  const sourceFile = ts.createSourceFile(
    serviceFileName,
    ts.sys.readFile(serviceFileName) ?? "",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const result: ProcessCall[] = [];

  function visit(node: ts.Node): void {
    /*
     * Look for:
     *
     * updateEServiceFlags: async (...) => { ... }
     *
     * This is a PropertyAssignment whose name is our service method.
     */
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === serviceMethodName
    ) {
      const initializer = node.initializer;

      if (
        ts.isArrowFunction(initializer) ||
        ts.isFunctionExpression(initializer)
      ) {
        findCalls(initializer.body);
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  function findCalls(node: ts.Node): void {
    function visitCall(child: ts.Node): void {
      if (ts.isCallExpression(child)) {
        const call = getProcessCall(child);

        if (call) {
          result.push(call);
        }
      }

      ts.forEachChild(child, visitCall);
    }

    visitCall(node);
  }

  function getProcessCall(call: ts.CallExpression): ProcessCall | undefined {
    let expression: ts.Expression = call.expression;

    /*
     * Walk backwards through:
     *
     * tenantProcessClient.tenant.updateTenantDelegatedFeatures()
     *
     * PropertyAccessExpression:
     *   tenantProcessClient.tenant.updateTenantDelegatedFeatures
     *
     * We want:
     *   client = tenantProcessClient.tenant
     *   method = updateTenantDelegatedFeatures
     */
    if (!ts.isPropertyAccessExpression(expression)) {
      return undefined;
    }

    const method = expression.name.text;

    expression = expression.expression;

    const clientParts: string[] = [];

    while (ts.isPropertyAccessExpression(expression)) {
      clientParts.unshift(expression.name.text);
      expression = expression.expression;
    }

    if (!ts.isIdentifier(expression)) {
      return undefined;
    }

    const rootClient = expression.text;

    if (!rootClient.endsWith("Client")) {
      return undefined;
    }

    clientParts.unshift(rootClient);

    return {
      client: clientParts.join("."),
      method,
    };
  }

  visit(sourceFile);

  return result;
}
