const { Server } = require('socket.io')

module.exports.intializeSocket = (server) => {

    let io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            methods: ["GET", "POST"]
        },
    })
    return io;

}