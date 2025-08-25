const selector = arguments[0];
return Array.from(document.querySelectorAll(selector)).every((img) => {
	return img.complete;
});
