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

function verifyPermissions() {
	const controllers = walk(path.join(process.cwd(), 'src'));
	const unprotectedRoutes: string[] = [];

	for (const file of controllers) {
		const content = fs.readFileSync(file, 'utf-8');

		// Ignorar controllers que são naturalmente públicos por design
		if (
			file.includes('auth.controller.ts') ||
			file.includes('health.controller.ts') ||
			file.includes('password-migration.controller.ts')
		) {
			continue;
		}

		// Verifica se a classe inteira tem um decorador @Permissions
		const classDeclarationIndex = content.indexOf('export class');
		const headerContent = content.substring(0, classDeclarationIndex);
		const hasClassLevelPermissions = /@Permissions\(/.test(headerContent);

		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.match(/@(Get|Post|Put|Delete|Patch)\(/)) {
				let hasPermissions = hasClassLevelPermissions;

				// Checar as linhas anteriores do decorador de rota
				let j = i - 1;
				while (j >= 0) {
					const prevLine = lines[j];
					if (prevLine.includes('@Permissions(')) {
						hasPermissions = true;
						break;
					}
					if (
						prevLine.match(/@(Get|Post|Put|Delete|Patch)\(/) ||
						prevLine.includes('export class')
					) {
						break;
					}
					j--;
				}

				// Checar as linhas posteriores do decorador de rota
				let k = i + 1;
				while (k < lines.length && !hasPermissions) {
					const nextLine = lines[k].trim();
					if (nextLine.includes('@Permissions(')) {
						hasPermissions = true;
						break;
					}
					if (
						nextLine === '' ||
						nextLine.match(/@(Get|Post|Put|Delete|Patch)\(/)
					) {
						break;
					}
					// Se não começar com @, é o nome do método
					if (!nextLine.startsWith('@')) {
						break;
					}
					k++;
				}

				if (!hasPermissions) {
					// Pega o nome do método
					let methodName = 'unknown_method';
					for (let x = i + 1; x < i + 10; x++) {
						if (lines[x] && !lines[x].trim().startsWith('@')) {
							methodName = lines[x].trim().split('(')[0];
							break;
						}
					}
					unprotectedRoutes.push(
						`- ${path.basename(file)} -> Rota: ${line.trim()} (Método: ${methodName})`,
					);
				}
			}
		}
	}

	if (unprotectedRoutes.length > 0) {
		console.log(
			'\n🚨 ATENÇÃO: As seguintes rotas NÃO possuem decorador @Permissions():',
		);
		for (const r of unprotectedRoutes) {
			console.log(r);
		}
		console.log(
			'\nTotal de rotas desprotegidas:',
			unprotectedRoutes.length,
		);
		process.exit(1);
	} else {
		console.log(
			'\n✅ Sucesso: Todas as rotas nos controllers verificados possuem @Permissions().',
		);
	}
}

verifyPermissions();
