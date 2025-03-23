const { body, validationResult } = require('express-validator')


const ganerateChatValidator = [
    body('message').notEmpty().withMessage('Message is required'),
]


const loginValidator = [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
]

const signValidator = [
    ...loginValidator,
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
]


const validate = (validation) => {
    return async (req, res, next) => {
        for (vali of validation) {
            const result = await vali.run(req)
            // const result = validationResult(req);
            if (!result.isEmpty()) {
                return res.status(400).json({ errors: result.array() })
            }
        }
        next();
    }

}

module.exports = { signValidator, validate, loginValidator, ganerateChatValidator }