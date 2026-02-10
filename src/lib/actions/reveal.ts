export function reveal(node: HTMLElement) {
	node.style.opacity = '0';
	node.style.transform = 'translateY(16px)';
	node.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

	const observer = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) {
				node.style.opacity = '1';
				node.style.transform = 'translateY(0)';
				observer.unobserve(node);
			}
		},
		{ threshold: 0.1 }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		}
	};
}
