// fetchImageAsBase64.js
// Script para ser executado no navegador via Selenium para baixar uma imagem como base64

const url = arguments[0];
const callback = arguments[1]; // Callback para retornar o resultado ao WebDriver

fetch(url)
	.then((response) => {
		if (!response.ok) {
			throw new Error('Network response was not ok.');
		}
		return response.blob();
	})
	.then((blob) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			// Retorna apenas a parte de dados da string Base64
			callback(reader.result.split(',')[1]);
		};
		reader.onerror = () => {
			callback(null); // Sinaliza erro
		};
		reader.readAsDataURL(blob);
	})
	.catch((error) => {
		console.error('Erro no script do navegador:', error);
		callback(null); // Sinaliza erro
	});
