const express = require('express');

const auth = require('./auth/auth.routes');
const users = require('./users/users.routes');
const devices = require('./devices/devices.routes');

const router = express.Router();

router.use('/auth', auth);
router.use('/users', users);
router.use('/devices', devices);

module.exports = router;
