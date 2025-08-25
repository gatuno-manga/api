// failedImageUrls.js
// Script para obter URLs de imagens que falharam ao carregar

const selector = arguments[0];
return Array.from(document.querySelectorAll(selector))
	.filter((img) => img.complete && img.naturalWidth === 0)
	.map((img) => img.src);
