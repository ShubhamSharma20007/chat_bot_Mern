const UserModel = require("../models/user.model");
const HandleResponses = require("../utils/handleResponses")
const cookieParse = require('cookie-parser');
const register = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const findUser = await UserModel.findOne({ email });
        if (findUser) {
            return new HandleResponses(res, 400, "User already exists").sendResponse()
        }
        const user = new UserModel({ username, email, password });
        await user.save();
        const token = await user.generateAuthToken();
        //  remove the already existing cookie
        res.clearCookie('token', {
            path: '/',
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            signed: true
        });
        res.cookie('token', token, {
            path: '/',
            sameSite: 'none',
            secure: true,
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 1, // 1 days
            signed: true
        })
        return new HandleResponses(res, 201, "User created", { user, token }).sendResponse()
    } catch (error) {
        return new HandleResponses(res, 500, "Internal server error").sendResponse()
    }
}


const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await UserModel.findOne({ email });
        if (!user) {
            return new HandleResponses(res, 400, "User not found").sendResponse()

        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return new HandleResponses(res, 400, "Invalid credentials").sendResponse()
        }
        const token = await user.generateAuthToken();
        //  remove the already existing cookie
        res.clearCookie('token', {
            path: '/',
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            signed: true
        });
        res.cookie('token', token, {
            path: '/',
            sameSite: 'none',
            secure: true,
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 1, // 1 days
            signed: true

        })
        return new HandleResponses(res, 201, "User login sucessfully", { user, token }).sendResponse()
    } catch (error) {
        return new HandleResponses(res, 500, error.message).sendResponse()
    }
}


const logout = async (req, res) => {
    try {
        // remove the token
        res.clearCookie('token', {
            path: '/',
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            signed: true
        })
        return new HandleResponses(res, 200, "User logged out").sendResponse()
    } catch (error) {
        return new HandleResponses(res, 500, error.message).sendResponse()
    }
}

const getAllUser = async (req, res) => {
    const allUser = await UserModel.find();
    return new HandleResponses(res, 200, "All user", allUser).sendResponse()
}
const authStatus = (req, res) => {
    if (req.user) {
        return new HandleResponses(res, 200, "User authorized", req.user).sendResponse()
    }
    else {
        return new HandleResponses(res, 401, "User not authorized").sendResponse()
    }
}

module.exports = {
    login,
    register,
    getAllUser,
    logout,
    authStatus,
}