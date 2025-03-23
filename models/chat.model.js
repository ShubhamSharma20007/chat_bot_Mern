const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },

}, {
    versionKey: false,
    timestamps: true
})

const ChatModel = mongoose.model('Chat', ChatSchema);
module.exports = ChatModel;