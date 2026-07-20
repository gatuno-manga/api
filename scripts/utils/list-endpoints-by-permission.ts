import * as fs from 'node:fs';
import * as path from 'node:path';

function walk(dir: string, fileList: string[] = []): string[] {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const stat = fs.statSync(path.join(dir, file));
		if (stat.isDirectory()) {
			walk(path.join(dir, file), fileList);
		} else if (file.endsWith('.controller.ts')) {
			fileList.push(path.join(dir, file));
		}
	}
	return fileList;
}

function extractPermissionString(line: string): string | null {
	const match = line.match(/@Permissions\((.*?)\)/);
	if (match?.[1]) {
		return match[1].trim();
	}
	return null;
}

function listEndpointsByPermission() {
	const controllers = walk(path.join(process.cwd(), 'src'));

	// permission -> array of string (controller -> method (Route))
	const permissionsMap: Record<string, string[]> = {};
	const addRoute = (permission: string, routeInfo: string) => {
		if (!permissionsMap[permission]) {
			permissionsMap[permission] = [];
		}
		permissionsMap[permission].push(routeInfo);
	};

	for (const file of controllers) {
		const content = fs.readFileSync(file, 'utf-8');
		const controllerName = path.basename(file);

		let classLevelPermission: string | null = null;
		let controllerPrefix = '';

		const classDeclarationIndex = content.indexOf('export class');
		if (classDeclarationIndex !== -1) {
			const headerContent = content.substring(0, classDeclarationIndex);
			const headerLines = headerContent.split('\n');
			for (const line of headerLines) {
				const perm = extractPermissionString(line);
				if (perm) {
					classLevelPermission = perm;
				}
				const controllerMatch = line.match(
					/@Controller\(['"]([^'"]*)['"]\)/,
				);
				if (controllerMatch?.[1]) {
					controllerPrefix = `/${controllerMatch[1].replace(/^\/+|\/+$/g, '')}`;
				} else if (line.includes('@Controller()')) {
					controllerPrefix = '';
				}
			}
		}

		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const routeMatch = line.match(
				/@(Get|Post|Put|Delete|Patch)\((.*)\)/,
			);
			if (routeMatch) {
				const httpMethod = routeMatch[1].toUpperCase();
				let routePath = routeMatch[2].replace(/['"]/g, '').trim();

				if (routePath.length > 0 && !routePath.startsWith('/')) {
					routePath = `/${routePath}`;
				}

				const fullPath = `${controllerPrefix}${routePath}` || '/';

				let methodPermission: string | null = null;

				// Checar as linhas anteriores
				let j = i - 1;
				while (j >= 0) {
					const prevLine = lines[j].trim();
					if (prevLine === '') {
						j--;
						continue; // might have empty line between decorators
					}
					if (!prevLine.startsWith('@')) {
						break;
					}
					const perm = extractPermissionString(prevLine);
					if (perm) {
						methodPermission = perm;
						break;
					}
					j--;
				}

				// Checar as linhas posteriores
				let k = i + 1;
				while (k < lines.length && !methodPermission) {
					const nextLine = lines[k].trim();
					const perm = extractPermissionString(nextLine);
					if (perm) {
						methodPermission = perm;
						break;
					}
					if (
						nextLine === '' ||
						nextLine.match(/@(Get|Post|Put|Delete|Patch)\(/) ||
						!nextLine.startsWith('@')
					) {
						break;
					}
					k++;
				}

				const finalPermission =
					methodPermission ||
					classLevelPermission ||
					'SEM_PERMISSAO / PUBLIC';

				let methodName = 'unknown_method';
				for (let x = i + 1; x < i + 10; x++) {
					if (lines[x] && !lines[x].trim().startsWith('@')) {
						methodName = lines[x]
							.trim()
							.split('(')[0]
							.replace('async', '')
							.trim();
						break;
					}
				}

				const routeInfo = `[${httpMethod}] ${fullPath} -> ${controllerName}.${methodName}()`;
				addRoute(finalPermission, routeInfo);
			}
		}
	}

	// Output
	console.log('\n========================================================');
	console.log('         ENDPOINTS AGRUPADOS POR PERMISSÃO');
	console.log('========================================================\n');

	const sortedPermissions = Object.keys(permissionsMap).sort();

	for (const perm of sortedPermissions) {
		console.log(`\n\x1b[33m[ ${perm} ]\x1b[0m`);
		console.log('--------------------------------------------------------');
		const routes = permissionsMap[perm];
		for (const route of routes) {
			console.log(`  ${route}`);
		}
	}

	console.log('\n========================================================\n');
}

listEndpointsByPermission();
