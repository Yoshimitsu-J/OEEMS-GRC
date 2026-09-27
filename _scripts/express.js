const express = require('express');
const session = require('express-session');
const fs = require('node:fs');
const path = require('node:path');

const publicPath = path.join(__dirname, '..', 'public');
const sessionSecretPath = path.join(__dirname, '..', '_confidentials', 'session_secret.txt');

function createExpressApp() {
	const app = express();
	const sessionSecret = fs.readFileSync(sessionSecretPath, 'utf8').trim();

	if (!sessionSecret) {
		throw new Error(`Session secret is empty: ${sessionSecretPath}`);
	}

	app.disable('x-powered-by');
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	app.use(session({
		secret: sessionSecret,
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			sameSite: 'lax'
		}
	}));

	app.use(express.static(publicPath));
	app.get('/', (request, response) => response.sendFile(path.join(publicPath, 'index.html')));

	return app;
}

module.exports = {
	createExpressApp
};