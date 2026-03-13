const jwt = require('jsonwebtoken');
require('dotenv').config();

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET
    );
}

function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
