const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fs = require('node:fs');
const path = require('node:path');
const { readMongoUri } = require('./mongodb_connection');

const publicPath = path.join(__dirname, '..', 'public');
const sessionSecretPath = path.join(__dirname, '..', '_confidentials', 'session_secret.txt');

function createExpressApp() {
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

	app.use('/student', (request, response, next) => {
		if (request.session.user?.role !== 'Student') {
			return response.redirect('/login');
		}

		next();
	});

	const pageRoutes = {
		'/login': 'login.html',
		'/signup': 'signUp.html',
		'/student': path.join('student', 'index.html'),
		'/admission': path.join('admission', 'index.html'),
		'/admission/login': path.join('admission', 'adminLoginPage.html')
	};

	Object.entries(pageRoutes).forEach(([route, page]) => {
		app.get([route, `${route}/`], (request, response) => {
			response.sendFile(path.join(publicPath, page));
		});
	});

	app.use(express.static(publicPath));
	app.get('/', (request, response) => response.sendFile(path.join(publicPath, 'index.html')));

	return app;
}

module.exports = {
	createExpressApp
};