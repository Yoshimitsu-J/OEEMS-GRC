const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const credentialsPath = path.join(__dirname, '..', '_confidentials', 'mongoDB_Credentials.txt');
const databaseNames = ['OEEMS', 'OEEMS_Admission', 'OEEMS_Student'];
const databaseConnections = new Map();

function readMongoUri() {
	if (process.env.MONGODB_URI) {
		return process.env.MONGODB_URI;
	}

	const credentials = fs.readFileSync(credentialsPath, 'utf8');
	const match = credentials.match(/SRV Connection String:\s*(mongodb\+srv:\S+)/i);

	if (!match) {
		throw new Error(`MongoDB SRV connection string was not found in ${credentialsPath}`);
	}

	return match[1].trim();
}

async function connectToMongoDB() {
	if (mongoose.connection.readyState !== 1) {
		await mongoose.connect(readMongoUri(), {
			dbName: 'OEEMS_Student',
			serverSelectionTimeoutMS: 5000
		});
	}

	for (const databaseName of databaseNames) {
		const connection = databaseName === 'OEEMS_Student'
			? mongoose.connection
			: mongoose.connection.useDb(databaseName, { useCache: true });
		await connection.db.command({ ping: 1 });
		databaseConnections.set(databaseName, connection);
	}

	console.log(`MongoDB connected: ${databaseNames.join(', ')}`);
	return Object.fromEntries(databaseConnections);
}

function getDatabaseConnection(databaseName) {
	const connection = databaseConnections.get(databaseName);
	if (!connection) {
		throw new Error(`MongoDB database is not initialized: ${databaseName}`);
	}
	return connection;
}

async function disconnectFromMongoDB() {
	databaseConnections.clear();
	await mongoose.disconnect();
}

module.exports = {
	connectToMongoDB,
	readMongoUri,
	getDatabaseConnection,
	disconnectFromMongoDB
};
