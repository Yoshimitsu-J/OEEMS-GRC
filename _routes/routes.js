const express = require('express');
const authRoutes = require('./auth');

const router = express.Router();

router.use('/auth', authRoutes);

router.get('/health', (request, response) => {
	response.json({
		status: 'ok',
		service: 'OEEMS',
		timestamp: new Date().toISOString()
	});
});

module.exports = router;
