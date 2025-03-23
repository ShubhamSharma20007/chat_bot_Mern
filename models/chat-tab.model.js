const mongoose = require('mongoose');

const ChatTabSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    tabAssistantId: String,
    tabThreadId: String,
    isDuplicate:{
        type: Boolean,
        default: false
    },
    chats:[
      {
        content:String,
        role: String,
        name: String,
        chatTabId:String
      }
    ]
}, {
    versionKey: false,
    timestamps: true
})

const ChatTabModel = mongoose.model('chatTab', ChatTabSchema);
module.exports = ChatTabModel;