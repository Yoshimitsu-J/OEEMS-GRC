const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const credentialsPath = path.join(__dirname, '..', '_confidentials', 'mongoDB_Credentials.txt');

function readMongoUri() {
	const credentials = fs.readFileSync(credentialsPath, 'utf8');
	const match = credentials.match(/SRV Connection String:\s*(mongodb\+srv:\S+)/i);

	if (!match) {
		throw new Error(`MongoDB SRV connection string was not found in ${credentialsPath}`);
	}

	return match[1].trim();
}

async function connectToMongoDB() {
	await mongoose.connect(readMongoUri(), {
		dbName: 'OEEMS',
		serverSelectionTimeoutMS: 5000
	});

	console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

module.exports = {
	connectToMongoDB
};
