require('dotenv').config();

const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const User = require('./_models/User');

const { createExpressApp } = require('./_scripts/express');
const { connectToMongoDB, disconnectFromMongoDB } = require('./_scripts/mongodb_connection');
const { registerSocketHandlers } = require('./_scripts/socketIO');
const { startStudentRetentionJob } = require('./_scripts/studentRetention');
const { watchStudentChanges } = require('./_scripts/studentChangeStream');
const routes = require('./_routes/routes');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const app = createExpressApp({
	rootPage: path.join(__dirname, 'mode_select.html')
});
const httpServer = http.createServer(app);
const io = new Server(httpServer);
let closeStudentChangeStreams = async () => {};

app.use('/api', routes);
app.set('io', io);
io.engine.use(app.locals.sessionMiddleware);
io.use(async (socket, next) => {
	const userId = socket.request.session?.user?.id;
	if (!userId) return next(new Error('Authentication required.'));
	try {
		const user = await User.findOne({ _id: userId, emailVerified: true, accountStatus: 'active' }).select('_id');
		if (!user) return next(new Error('Authentication required.'));
		socket.data.studentId = userId;
		socket.join(`student:${userId}`);
		socket.join(`session:${socket.request.sessionID}`);
		next();
	} catch (error) {
		next(error);
	}
});
registerSocketHandlers(io);

async function startServer() {
	await connectToMongoDB();
	const admissionDb = require('./_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
	await admissionDb.collection('facilitators').updateOne({ accessCode: 'facilitator12345' }, {
		$set: { name: 'Juan Delacruz', role: 'Admin', accessCode: 'facilitator12345', status: 'active', updatedAt: new Date() },
		$setOnInsert: { createdAt: new Date() }
	}, { upsert: true });
	startStudentRetentionJob(io);
	closeStudentChangeStreams = watchStudentChanges(io);

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
}

async function shutdown(signal) {
	console.log(`\n${signal} received. Shutting down OEEMS...`);
	await new Promise((resolve) => {
		if (!httpServer.listening) return resolve();
		io.close(resolve);
	});
	await closeStudentChangeStreams();
	await disconnectFromMongoDB();

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
