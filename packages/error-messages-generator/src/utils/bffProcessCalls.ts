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

  const source = ts.sys.readFile(serviceFileName);

  if (!source) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    serviceFileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const result: ProcessCall[] = [];

  function findCalls(node: ts.Node): void {
    function visit(child: ts.Node): void {
      if (ts.isCallExpression(child)) {
        const processCall = getProcessCall(child);

        if (processCall) {
          result.push(processCall);
        }
      }

      ts.forEachChild(child, visit);
    }

    visit(node);
  }

  function getProcessCall(call: ts.CallExpression): ProcessCall | undefined {
    if (!ts.isPropertyAccessExpression(call.expression)) {
      return undefined;
    }

    const method = call.expression.name.text;

    let expression: ts.Expression = call.expression.expression;
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

  function visit(node: ts.Node): void {
    // async updateTenantDelegatedFeatures(...) { ... }
    if (
      ts.isMethodDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === serviceMethodName
    ) {
      findCalls(node.body ?? node);
      return;
    }

    // updateTenantDelegatedFeatures: async (...) => { ... }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === serviceMethodName
    ) {
      if (
        ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer)
      ) {
        findCalls(node.initializer.body);
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return result;
}
