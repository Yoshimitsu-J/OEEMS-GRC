require('dotenv').config();

const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');

const { createExpressApp } = require('./_scripts/express');
const { connectToMongoDB } = require('./_scripts/mongodb_connection');
const { registerSocketHandlers } = require('./_scripts/socketIO');
const routes = require('./_routes/routes');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const app = createExpressApp({
	rootPage: path.join(__dirname, 'mode_select.html')
});
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use('/api', routes);
registerSocketHandlers(io);

async function startServer() {
	try {
		await new Promise((resolve, reject) => {
			httpServer.once('error', reject);
			httpServer.listen(port, host, resolve);
		});
	} catch (error) {
		if (error.code === 'EADDRINUSE') {
			throw new Error(`Port ${port} is already in use. Stop the existing OEEMS server before starting another one.`);
		}

		throw error;
	}

	console.log(`OEEMS is running at http://localhost:${port}`);
	console.log(`LAN access: http://<host-machine-ip>:${port}`);

	try {
		await connectToMongoDB();
	} catch (error) {
		console.error('MongoDB connection failed; HTTP server remains available:', error.message);
	}
}

async function shutdown(signal) {
	console.log(`\n${signal} received. Shutting down OEEMS...`);
	io.close();

	await new Promise((resolve) => {
		httpServer.close(() => resolve());
	});

	console.log('OEEMS server stopped.');
}

process.once('SIGINT', () => {
	shutdown('SIGINT').then(() => process.exit(0));
});

process.once('SIGTERM', () => {
	shutdown('SIGTERM').then(() => process.exit(0));
});

startServer().catch((error) => {
	console.error(`OEEMS failed to start: ${error.message}`);
	process.exit(1);
});
