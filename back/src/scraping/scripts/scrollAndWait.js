const imageSelector = arguments[0] || 'img';
const callback = arguments[arguments.length - 1];

const config = {
	SCROLL_PAUSE_MS: 500,
	STABILITY_CHECKS: 3,
	MAX_IMAGE_RETRIES: 3,
	RETRY_DELAY_MS: 1000,
};

const imageProcessingPromises = [];
let processedImageCount = 0;

function attemptImageReload(img, resolve) {
	let retryCount = parseInt(img.dataset.retryCount || '0', 10);
	if (retryCount < config.MAX_IMAGE_RETRIES) {
		img.dataset.retryCount = retryCount + 1;
		setTimeout(() => {
			const originalSrc = img.dataset.originalSrc || img.src.split('?');
			img.src = `${originalSrc}?retry=${new Date().getTime()}`;
		}, config.RETRY_DELAY_MS * retryCount);
	} else {
		img.dataset.failed = 'true';
		console.error(
			`Falha ao carregar a imagem após ${config.MAX_IMAGE_RETRIES} tentativas:`,
			img.dataset.originalSrc,
		);
		resolve();
	}
}

function processNewImageNode(img) {
	if (img.dataset.seleniumProcessed === 'true') {
		return;
	}
	img.dataset.seleniumProcessed = 'true';
	processedImageCount++;

	if (!img.src) {
		return;
	}
	img.dataset.originalSrc = img.src.split('?');

	const promise = new Promise((resolve) => {
		const checkImage = () => {
			if (img.complete) {
				if (img.naturalWidth > 0) {
					resolve();
				} else {
					attemptImageReload(img, resolve);
				}
			} else {
				img.onload = () => resolve();
				img.onerror = () => attemptImageReload(img, resolve);
			}
		};
		checkImage();
	});
	imageProcessingPromises.push(promise);
}

const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		if (mutation.type === 'childList') {
			for (const node of mutation.addedNodes) {
				if (node.nodeType === 1) {
					if (node.matches(imageSelector)) {
						processNewImageNode(node);
					}
					node.querySelectorAll(imageSelector).forEach(
						processNewImageNode,
					);
				}
			}
		} else if (
			mutation.type === 'attributes' &&
			mutation.attributeName === 'src'
		) {
			const target = mutation.target;
			if (target && target.matches(imageSelector)) {
				processNewImageNode(target);
			}
		}
	}
});

observer.observe(document.body, {
	childList: true,
	subtree: true,
	attributes: true,
	attributeFilter: ['src'],
});

document.querySelectorAll(imageSelector).forEach(processNewImageNode);

async function scrollAndCheck() {
	let lastHeight = 0;
	let stableChecks = 0;

	while (stableChecks < config.STABILITY_CHECKS) {
		lastHeight = document.body.scrollHeight;
		window.scrollTo(0, document.body.scrollHeight);
		await new Promise((resolve) =>
			setTimeout(resolve, config.SCROLL_PAUSE_MS),
		);
		let newHeight = document.body.scrollHeight;
		if (newHeight === lastHeight) {
			stableChecks++;
		} else {
			stableChecks = 0;
		}
	}

	console.log(
		'Fim da rolagem detectado. Aguardando processamento de imagens...',
	);
	await Promise.all(imageProcessingPromises);
	observer.disconnect();

	const failedImages = Array.from(
		document.querySelectorAll(`${imageSelector}[data-failed="true"]`),
	).map((img) => img.dataset.originalSrc);

	callback({
		processedImageCount: processedImageCount,
		failedImageCount: failedImages.length,
		failedImages: failedImages,
	});
}

scrollAndCheck();
