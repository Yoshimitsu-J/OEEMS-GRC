const mongoose = require('mongoose');
const { getDatabaseConnection } = require('../_scripts/mongodb_connection');

async function requireAdmin(request, response, next) {
	response.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, private',
		Pragma: 'no-cache',
		Expires: '0'
	});

	const adminId = request.session?.admin?.id;
	if (!adminId || !mongoose.isValidObjectId(adminId)) {
		if (request.originalUrl.startsWith('/api/')) return response.status(401).json({ error: 'Admission administrator authentication required.' });
		return response.redirect('/admission/adminLoginPage.html');
	}

	try {
		const admin = await getDatabaseConnection('OEEMS_Admission').db.collection('admin_users').findOne({
			_id: new mongoose.Types.ObjectId(adminId),
			status: 'active'
		}, { projection: { adminId: 1, email: 1, name: 1, role: 1, status: 1 } });
		if (!admin) {
			request.session.destroy(() => {});
			if (request.originalUrl.startsWith('/api/')) return response.status(401).json({ error: 'Admission administrator authentication required.' });
			return response.redirect('/admission/adminLoginPage.html');
		}
		response.locals.authAdmin = admin;
		next();
	} catch (error) {
		next(error);
	}
}

function protectAdmissionPages(request, response, next) {
	const path = request.path.toLowerCase();
	if (path.endsWith('/adminloginpage.html') || /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?)$/i.test(path)) return next();
	requireAdmin(request, response, next);
}

module.exports = { requireAdmin, protectAdmissionPages };