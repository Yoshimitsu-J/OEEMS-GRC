const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');

const { createExpressApp } = require('./_scripts/express');
const { connectToMongoDB } = require('./_scripts/mongodb_connection');
const { registerSocketHandlers } = require('./_scripts/socketIO');
const routes = require('./_routes/routes');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const app = createExpressApp();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use('/api', routes);
registerSocketHandlers(io);

async function startServer() {
	httpServer.listen(port, host, () => {
		console.log(`OEEMS is running at http://localhost:${port}`);
		console.log(`LAN access: http://<host-machine-ip>:${port}`);
	});

	try {
		await connectToMongoDB();
	} catch (error) {
		console.error('MongoDB connection failed; HTTP server remains available:', error.message);
	}
}

startServer().catch((error) => {
	console.error('OEEMS failed to start:', error.message);
	process.exitCode = 1;
});
