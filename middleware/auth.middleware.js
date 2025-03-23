const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');

module.exports.auth = async (req, res, next) => {
    try {
        const token = req.signedCookies?.token;

        if (!token) {
            return res.status(401).json({ message: "You are not authenticated. Token missing." });
        }
        let verifyToken;
        try {
            verifyToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: "Invalid or expired token." });
        }
        const user = await UserModel.findById(verifyToken._id).select('-password');
        if (!user) {
            return res.status(401).json({ message: "User not found or authentication failed." });
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error("Authentication middleware error:", error.message);
        res.status(500).json({ message: "Internal server error." });
    }
};
