import { ASTVisitor, GraphQLError, ValidationContext } from 'graphql';

export const MaxRootFieldsRule = (maxFields: number) => {
	return (context: ValidationContext): ASTVisitor => {
		return {
			OperationDefinition(node) {
				const selections = node.selectionSet.selections;
				let fieldCount = 0;

				for (const selection of selections) {
					if (selection.kind === 'Field') {
						fieldCount++;
					}
				}

				if (fieldCount > maxFields) {
					context.reportError(
						new GraphQLError(
							`Query is too complex: maximum of ${maxFields} root fields allowed.`,
							{ nodes: node },
						),
					);
				}
			},
		};
	};
};
