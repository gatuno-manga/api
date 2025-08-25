// waitForAllImagesLoaded.js
// Script para verificar se todas as imagens de um seletor estão carregadas

const selector = arguments[0];
return Array.from(document.querySelectorAll(selector)).every((img) => {
	// Considera carregada se terminou (com sucesso ou erro)
	return img.complete;
});
