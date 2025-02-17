/* eslint-disable prefer-destructuring */
/* eslint-disable consistent-return */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-console */

const { validationResult, check } = require('express-validator');
const { MessageMedia } = require('whatsapp-web.js');
const multer = require('multer');
const express = require('express');
const { isAuthenticated } = require('../../middlewares');
const { getDevices, createDevice, generateQrCode, getClientDevice } = require('./devices.services');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.get('/', isAuthenticated, [
  check('status').optional().isBoolean(),
  check('page').optional().isInt({ min: 1 }),
  check('pageSize').optional().isInt({ min: 1 }),
  check('name').optional().isString(),
], async (req, res, next) => {
  try {
    const {
      page, pageSize, name, status,
    } = req.query;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const devices = await getDevices({
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 10,
      name,
      status: status === 'true' ? true : status === 'false' ? false : null,
    });
    res.status(200).json(devices);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, status, code } = req.body;
    const device = await createDevice({ name, status, code });
    res.status(200).json(device);
  } catch (error) {
    next(error);
  }
});

router.post('/send-message', isAuthenticated, [
  check('deviceId').notEmpty(),
  check('target').notEmpty(),
  check('message').notEmpty(),
], async (req, res) => {
  const { deviceId, target, message } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const device = await getClientDevice(deviceId);

  if (!device) {
    return res.status(400).json({ success: false, message: 'Device not found' });
  }

  try {
    if (Array.isArray(target)) {
      // If target is an array, send message to each target
      const sendMessages = target.map(async (t) => {
        await device.sendMessage(t, message);
      });
      // Wait for all messages to be sent
      await Promise.all(sendMessages);
    } else {
      // If target is a single string, send a single message
      await device.sendMessage(target, message);
    }

    res.status(200).json({ success: true, message: 'Message(s) sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send message', error });
  }
});

router.post('/send-media', isAuthenticated, upload.single('file'), [
  check('deviceId').notEmpty(),
  check('target').notEmpty(),
  check('caption').notEmpty(), // Ganti 'message' dengan 'caption' karena kita mengirim media dengan caption
], async (req, res) => {
  const { deviceId, target, caption } = req.body;
  console.log(req.body);
  const file = req.file;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  
  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  try {
    const device = await getClientDevice(deviceId);
    // Ensure target is an array
    const targets = Array.isArray(target) ? target : [target];

    // Format phone numbers
    const formattedTargets = targets.map(number => {
      // Convert to string to ensure we can use string methods
      const strNumber = String(number);

      // If number starts with '08', replace with '62'
      if (strNumber.startsWith('08')) {
        return '628' + strNumber.slice(2);
      }
      // If it doesn't start with '628', leave as is
      return strNumber;
    });

    console.log(formattedTargets);

    // Prepare media object
    const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);

    // Send media to each formatted target
    const sendMediaMessages = formattedTargets.map(async (t) => {
      await device.sendMessage(t, media, { caption });
    });

    // Wait for all media messages to be sent
    await Promise.all(sendMediaMessages);

    res.status(200).json({ success: true, message: 'Media sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send media', error });
  }
});

router.post('/chats', isAuthenticated, [
  check('deviceId').notEmpty(),
], async (req, res) => {
  const { deviceId } = req.body;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const device = await getClientDevice(deviceId);

  try {
    const chats = await device.getChats();
    res.status(200).json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get chats', error });
  }
});

router.post('/qr-code', isAuthenticated, async (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: 'Device ID is required' });
  }
  
  try {
    const qrCodeBuffer = await generateQrCode(deviceId);
    res.setHeader('Content-Type', 'image/png');
    res.end(qrCodeBuffer);
  } catch (error) {
    const statusCode = error.status || 500; // Gunakan 500 jika error.status undefined
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

module.exports = router;
