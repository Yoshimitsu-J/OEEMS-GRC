const express = require('express');
const authRoutes = require('./auth');
const studentRoutes = require('./student');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/student', studentRoutes);

router.get('/health', (request, response) => {
	response.json({
		status: 'ok',
		service: 'OEEMS',
		timestamp: new Date().toISOString()
	});
});

module.exports = router;
