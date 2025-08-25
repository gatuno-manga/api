// scrollAndWait.js
// Script para rolar a página até o final e aguardar carregamento

const callback = arguments[arguments.length - 1];
let sameHeightCount = 0;
let lastHeight = 0;
const maxChecks = 10;
const viewportHeight =
	(window.innerHeight || document.documentElement.clientHeight) * 1.2;

function scrollStep() {
	const currentHeight = document.body.scrollHeight;
	if (currentHeight === lastHeight) {
		sameHeightCount++;
	} else {
		sameHeightCount = 0;
	}
	lastHeight = currentHeight;

	if (window.innerHeight + window.scrollY >= document.body.scrollHeight) {
		setTimeout(callback, 1000);
		return;
	}

	window.scrollBy(0, viewportHeight);

	if (sameHeightCount < maxChecks) {
		setTimeout(scrollStep, 1800);
	} else {
		setTimeout(callback, 1000);
		window.scrollTo(0, document.body.scrollHeight);
	}
}

scrollStep();
