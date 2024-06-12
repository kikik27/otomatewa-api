/* eslint-disable prefer-destructuring */
/* eslint-disable consistent-return */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-console */

const { validationResult, check } = require('express-validator');
const { MessageMedia } = require('whatsapp-web.js');
const multer = require('multer');
const express = require('express');
const { isAuthenticated } = require('../../middlewares');
const { getDevices, createDevice, generateQrCode } = require('./devices.services');
const { Clients } = require('./devices.clients');

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

router.post('/send-message', async (req, res) => {
  const { deviceId, number, message } = req.body;
  const device = Clients.find((client) => client.options.authStrategy.clientId === deviceId);

  if (!device) {
    return res.status(400).json({ success: false, message: 'device not found' });
  }

  try {
    const chatId = `${number}@c.us`;
    await device.sendMessage(chatId, message);
    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send message', error });
  }
});

router.post('/send-media', upload.single('file'), async (req, res) => {
  const { deviceId, number, caption } = req.body;
  const file = req.file;
  const device = Clients.find((client) => client.options.authStrategy.clientId === deviceId);

  if (!device) {
    return res.status(400).json({ success: false, message: 'device not found' });
  }

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    const chatId = `${number}@c.us`;
    const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);
    await device.sendMessage(chatId, media, { caption });
    res.status(200).json({ success: true, message: 'Media sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send media', error });
  }
});

router.post('/qr-code', async (req, res) => {
  const { deviceId } = req.body;

  try {
    const qrCodeBuffer = await generateQrCode(deviceId);
    res.setHeader('Content-Type', 'image/png');
    res.send(qrCodeBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate QR code', error });
  }
});

module.exports = router;
