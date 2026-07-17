import * as fs from 'node:fs';
import * as path from 'node:path';

const TSCONFIG_PATH = path.resolve(process.cwd(), 'tsconfig.json');
const tsconfig = JSON.parse(fs.readFileSync(TSCONFIG_PATH, 'utf-8'));
const paths = tsconfig.compilerOptions.paths;

// Map aliases to their relative paths from root
const aliasMap = Object.entries(paths).map(([alias, targets]) => {
	const target = (targets as string[])[0].replace('/*', '');
	const aliasClean = alias.replace('/*', '');
	return { alias: aliasClean, target };
});

// Sort aliasMap by target length (descending) to match most specific aliases first
aliasMap.sort((a, b) => b.target.length - a.target.length);

function resolveToAlias(
	sourceFilePath: string,
	relativeImport: string,
): string | null {
	if (!relativeImport.startsWith('../')) return null;

	const sourceDir = path.dirname(sourceFilePath);
	const absoluteImportTarget = path.resolve(sourceDir, relativeImport);
	const rootPath = process.cwd();
	const relativeToRoot = path.relative(rootPath, absoluteImportTarget);

	for (const { alias, target } of aliasMap) {
		if (relativeToRoot.startsWith(target)) {
			const remainingPath = relativeToRoot
				.slice(target.length)
				.replace(/^[\\/]/, '');
			return `${alias}/${remainingPath}`.replace(/\/$/, '');
		}
	}

	return null;
}

function processFile(filePath: string) {
	const content = fs.readFileSync(filePath, 'utf-8');
	let modified = false;

	const newContent = content.replace(
		/from\s+['"](\.\.\/.*?)['"]/g,
		(match, importPath) => {
			const aliasPath = resolveToAlias(filePath, importPath);
			if (aliasPath) {
				modified = true;
				// Ensure we don't end with .ts or /index
				const cleanAliasPath = aliasPath
					.replace(/\.ts$/, '')
					.replace(/\/index$/, '');
				return `from '${cleanAliasPath}'`;
			}
			return match;
		},
	);

	if (modified) {
		console.log(`Updated imports in: ${filePath}`);
		fs.writeFileSync(filePath, newContent, 'utf-8');
	}
}

function walkDir(dir: string, callback: (file: string) => void) {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			if (
				file !== 'node_modules' &&
				file !== 'dist' &&
				!file.startsWith('.')
			) {
				walkDir(filePath, callback);
			}
		} else if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
			callback(filePath);
		}
	}
}

console.log('Starting path alias migration...');
const targetDirs = ['src', 'test', 'scripts'];
for (const dir of targetDirs) {
	const dirPath = path.resolve(process.cwd(), dir);
	if (fs.existsSync(dirPath)) {
		walkDir(dirPath, processFile);
	}
}
console.log('Migration complete.');
