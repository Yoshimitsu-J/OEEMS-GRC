function registerSocketHandlers(io) {
	io.on('connection', (socket) => {
		socket.emit('server:ready', {
			connectedAt: new Date().toISOString()
		});
	});
}

module.exports = {
	registerSocketHandlers
};