const url = arguments[0];
const callback = arguments[1];

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
			callback(reader.result.split(',')[1]);
		};
		reader.onerror = () => {
			callback(null);
		};
		reader.readAsDataURL(blob);
	})
	.catch((error) => {
		console.error('Erro no script do navegador:', error);
		callback(null);
	});
