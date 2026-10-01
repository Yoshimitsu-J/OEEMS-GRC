function requireSameOrigin(request, response, next) {
	const origin = request.get('origin');
	if (!origin) return next();

	try {
		const originUrl = new URL(origin);
		if (originUrl.host !== request.get('host')) {
			return response.status(403).json({ error: 'Cross-origin request rejected.' });
		}
	} catch {
		return response.status(403).json({ error: 'Invalid request origin.' });
	}

	next();
}

module.exports = { requireSameOrigin };