const { generateChat,generatePresentation, generatePresentationDesign } = require('../controllers/chat.controller')
module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`⚡: ${socket.id} user just connected!`);

        // //  listen for a new message
        socket.on('new-chat', async (message) => {
            const { user_msg, receiverId, userId, tabId } = message;
            const aiResponse = await generateChat(user_msg, tabId, userId);
            io.to(receiverId).emit('response-new-chat', aiResponse);
        });
        socket.on('new-presentation', async (message) => {
            const aiResponse = await generatePresentation(message.user_msg);
            io.to(message.receiverId).emit('response-new-presentation', aiResponse);
        })


        // socket.on('ai-response', (data) => {
        //     console.log("ai-response:", data);
        //     console.log("Received ai-response:", data);
        // });

        socket.on('disconnect', () => {
            console.log('🔥: A user disconnected');
        });

    })
}