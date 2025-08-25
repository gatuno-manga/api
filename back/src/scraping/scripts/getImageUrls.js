const selector = arguments[0];
return Array.from(document.querySelectorAll(selector))
	.map((img) => img.src)
	.filter(
		(src) =>
			src &&
			(src.startsWith('http://') ||
				src.startsWith('https://') ||
				src.startsWith('blob:')),
	);
