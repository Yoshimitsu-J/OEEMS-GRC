const express = require('express');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const studentRoutes = require('./student');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/student', studentRoutes);

router.get('/health', (request, response) => {
	response.json({
		status: 'ok',
		service: 'OEEMS',
		timestamp: new Date().toISOString()
	});
});

module.exports = router;
