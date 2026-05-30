// Sets the theme before first paint to prevent a flash of the wrong theme.
// External (not inline) so a strict `script-src 'self'` CSP allows it.
(function () {
	var t = localStorage.getItem('record-shelf-theme');
	if (t === 'dark' || t === 'light') {
		document.documentElement.setAttribute('data-theme', t);
	} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
		document.documentElement.setAttribute('data-theme', 'dark');
	}
})();
