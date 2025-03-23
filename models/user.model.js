const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,

    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    chats: {
        type: Array
    },
    googleCalendarTokens: {
        access_token:{
            type: String,
            default: null
        },
        refresh_token: {
            type: String,
            default: null
        },
        expiry_date: {
            type: Number,
            default: null
        },
    },

}, {
    timestamps: true,
    versionKey: false
})

UserSchema.pre('save', async function () {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 8)
    }
})
UserSchema.methods.generateAuthToken = async function () {
    const token = jwt.sign({ _id: this._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return token;
}

UserSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password)
}

const UserModel = mongoose.model('User', UserSchema);
module.exports = UserModel;