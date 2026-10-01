const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fs = require('node:fs');
const path = require('node:path');
const { readMongoUri } = require('./mongodb_connection');
const { requireAuthenticated, requireCompletedProfile } = require('../_middleware/studentAccess');

const publicPath = path.join(__dirname, '..', 'public');
const sessionSecretPath = path.join(__dirname, '..', '_confidentials', 'session_secret.txt');

function createExpressApp({ rootPage = path.join(__dirname, '..', 'mode_select.html') } = {}) {
	const app = express();
	const sessionSecret = process.env.SESSION_SECRET || fs.readFileSync(sessionSecretPath, 'utf8').trim();

	if (!sessionSecret) {
		throw new Error(`Session secret is empty: ${sessionSecretPath}`);
	}
	if (process.env.NODE_ENV === 'production') {
		app.set('trust proxy', 1);
	}

	app.disable('x-powered-by');
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	app.use(session({
		secret: sessionSecret,
		resave: false,
		saveUninitialized: false,
		store: MongoStore.create({
			mongoUrl: readMongoUri(),
			dbName: 'OEEMS_Student',
			collectionName: 'sessions',
			ttl: 60 * 60 * 8
		}),
		cookie: {
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 1000 * 60 * 60 * 8
		}
	}));

	app.use(['/student', '/public/student'], (request, response, next) => {
		const requestPath = request.path.toLowerCase();
		const setupPage = requestPath.endsWith('/setupaccount.html');
		const staticAsset = /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?)$/i.test(requestPath);
		const nextGuard = setupPage || staticAsset ? next : (error) => {
			if (error) return next(error);
			requireCompletedProfile(request, response, next);
		};
		requireAuthenticated(request, response, nextGuard);
	});

	const pageRoutes = {
		'/login': 'login.html',
		'/signup': 'signUp.html',
		'/signUp.html': 'signUp.html',
		'/student': path.join('student', 'index.html'),
		'/admission': path.join('admission', 'index.html'),
		'/admission/login': path.join('admission', 'adminLoginPage.html')
	};

	Object.entries(pageRoutes).forEach(([route, page]) => {
		app.get([route, `${route}/`], (request, response) => {
			response.sendFile(path.join(publicPath, page));
		});
	});
	app.get('/account-setup.html', requireAuthenticated, (request, response) => {
		response.sendFile(path.join(publicPath, 'student', 'setUpAccount.html'));
	});
	app.get('/verify-otp', (request, response) => {
		response.sendFile(path.join(publicPath, 'verifyOtp.html'));
	});
	const guardedPages = {
		'/dashboard': path.join('student', 'index.html'),
		'/application': path.join('student', 'myApplication.html'),
		'/exam': path.join('student', 'takeExam.html')
	};
	Object.entries(guardedPages).forEach(([route, page]) => {
		app.get([route, `${route}/`], requireAuthenticated, requireCompletedProfile, (request, response) => {
			response.sendFile(path.join(publicPath, page));
		});
	});

	app.get('/public/index.html', (request, response) => {
		response.sendFile(path.join(publicPath, 'index.html'));
	});
	app.get('/public/admission/index.html', (request, response) => {
		response.sendFile(path.join(publicPath, 'admission', 'index.html'));
	});
	app.get('/', (request, response) => response.sendFile(rootPage));
	app.use('/public', express.static(publicPath));
	app.use(express.static(publicPath));

	return app;
}

module.exports = {
	createExpressApp
};