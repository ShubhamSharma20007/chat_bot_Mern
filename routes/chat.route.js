const express = require('express');
const chatRoute = express.Router();
const { getChats, deleteChats, createChatTab, getTabs, convertCodeIntoHTML,duplicateTab } = require('../controllers/chat.controller')
const { auth } = require('../middleware/auth.middleware.js');
// chatRoute.get('/new-chat-start', auth, newChatStart)
chatRoute.get('/get-chats', auth, getChats);
chatRoute.delete('/delete-chats', auth, deleteChats);
chatRoute.post('/new-tab', auth, createChatTab);
chatRoute.get('/get-tabs', auth, getTabs);
chatRoute.post('/convert-html', auth, convertCodeIntoHTML)
chatRoute.post('/duplicate-chat',auth,duplicateTab)


module.exports = chatRoute; 
