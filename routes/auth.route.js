const express = require('express');
const authRoute = express.Router();
const { register, login, getAllUser, authStatus, logout } = require('../controllers/auth.controller.js')
const { signValidator, validate, loginValidator } = require('../utils/validators.js');
const { auth } = require('../middleware/auth.middleware.js');
authRoute.post('/register', validate(signValidator), register);
authRoute.post('/login', validate(loginValidator), login);
authRoute.post('/logout', auth, logout);
authRoute.get('/auth-status', auth, authStatus);
authRoute.get('/all-user', getAllUser);



module.exports = authRoute; 
