function registerSocketHandlers(io) {
	io.on('connection', (socket) => {
		console.log(`Socket.IO client connected: ${socket.id}`);

		socket.emit('server:ready', {
			connectedAt: new Date().toISOString()
		});

		socket.on('disconnect', (reason) => {
			console.log(`Socket.IO client disconnected: ${socket.id} (${reason})`);
		});
	});
}

module.exports = {
	registerSocketHandlers
};