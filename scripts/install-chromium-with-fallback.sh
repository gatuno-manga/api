#!/usr/bin/env bash
set -euo pipefail

BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/ms-playwright}"
FALLBACK_PATH="${PLAYWRIGHT_CACHE_FALLBACK_PATH:-/usr/src/app/.playwright-cache}"
REQUIRED_REVISION_OVERRIDE="${PLAYWRIGHT_REQUIRED_CHROMIUM_REVISION:-}"
INSTALL_MODE="${1:-}"

has_any_cached_chromium() {
	local candidate="$1"

	if [[ ! -d "$candidate" ]]; then
		return 1
	fi

	compgen -G "${candidate%/}/chromium-*/chrome-linux/chrome" > /dev/null
}

has_cached_chromium_revision() {
	local candidate="$1"
	local revision="$2"

	[[ -f "${candidate%/}/chromium-${revision}/chrome-linux/chrome" ]]
}

copy_fallback_cache() {
	if [[ "$FALLBACK_PATH" == "$BROWSERS_PATH" ]]; then
		return 0
	fi

	if has_any_cached_chromium "$FALLBACK_PATH"; then
		echo "Using cached Chromium from ${FALLBACK_PATH}."
		mkdir -p "$BROWSERS_PATH"
		# Copy only missing files to avoid re-downloading and unnecessary overwrites.
		cp -an "${FALLBACK_PATH}/." "${BROWSERS_PATH}/"
	fi
}

resolve_required_chromium_revision() {
	node -e "const fs=require('node:fs');const path=require('node:path');const pkg=path.resolve(process.cwd(),'node_modules/playwright-core/browsers.json');if(!fs.existsSync(pkg)){process.exit(1);}const data=JSON.parse(fs.readFileSync(pkg,'utf8'));const chromium=(data.browsers||[]).find((b)=>b.name==='chromium'&&b.installByDefault!==false)||(data.browsers||[]).find((b)=>b.name==='chromium');if(!chromium?.revision){process.exit(1);}process.stdout.write(String(chromium.revision));"
}

install_args=(chromium)
if [[ "$INSTALL_MODE" == "--with-deps" ]]; then
	install_args=(--with-deps chromium)
fi

mkdir -p "$BROWSERS_PATH"
copy_fallback_cache

required_revision="$REQUIRED_REVISION_OVERRIDE"
if [[ -z "$required_revision" ]]; then
	required_revision="$(resolve_required_chromium_revision || true)"
fi

if [[ -n "$required_revision" ]]; then
	echo "Required Chromium revision: ${required_revision}."

	if has_cached_chromium_revision "$BROWSERS_PATH" "$required_revision"; then
		echo "Cached Chromium revision ${required_revision} already available. Skipping download."
		exit 0
	fi

	echo 'Required revision not found in cache. Trying Playwright download...'
	if npx playwright install "${install_args[@]}"; then
		echo 'Chromium installed successfully.'
		exit 0
	fi

	echo 'Failed to download required Chromium revision.'
	if has_any_cached_chromium "$BROWSERS_PATH"; then
		echo 'Could not verify/update version from network; using cached Chromium.'
		exit 0
	fi
else
	echo 'Could not resolve required Chromium revision. Using cache-only mode.'
	if has_any_cached_chromium "$BROWSERS_PATH"; then
		echo "Using cached Chromium from ${BROWSERS_PATH}."
		exit 0
	fi
fi

cat >&2 <<EOF
ERROR: Unable to provision Chromium.

Populate cache first (with internet):
  cd back
  npm run chromium:cache

Then retry the Docker build.
EOF

exit 1
