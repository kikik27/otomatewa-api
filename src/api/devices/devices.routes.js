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

/**
 * @swagger
 * /devices:
 *   get:
 *     summary: Get all devices with pagination and filters
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: boolean
 *         description: Filter by device status
 *         example: true
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by device name
 *         example: "Device 1"
 *     responses:
 *       200:
 *         description: Devices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Device'
 *                 total:
 *                   type: integer
 *                   description: Total number of devices
 *                 page:
 *                   type: integer
 *                   description: Current page
 *                 pageSize:
 *                   type: integer
 *                   description: Items per page
 *       400:
 *         description: Bad request (validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /devices:
 *   post:
 *     summary: Create a new device
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Device name
 *                 example: "WhatsApp Device 1"
 *               status:
 *                 type: boolean
 *                 description: Device status
 *                 example: false
 *               code:
 *                 type: string
 *                 description: Device code
 *                 example: "DEVICE001"
 *     responses:
 *       200:
 *         description: Device created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, status, code } = req.body;
    const device = await createDevice({ name, status, code });
    res.status(200).json(device);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /devices/send-message:
 *   post:
 *     summary: Send WhatsApp message
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - target
 *               - message
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID to send message from
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               target:
 *                 oneOf:
 *                   - type: string
 *                     description: Single phone number
 *                     example: "6281234567890"
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: Array of phone numbers
 *                     example: ["6281234567890", "6289876543210"]
 *               message:
 *                 type: string
 *                 description: Message text to send
 *                 example: "Hello from WhatsApp API!"
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Message(s) sent successfully"
 *       400:
 *         description: Bad request (validation error or device not found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to send message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /devices/send-media:
 *   post:
 *     summary: Send WhatsApp media (image, video, document)
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - target
 *               - caption
 *               - file
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID to send media from
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               target:
 *                 oneOf:
 *                   - type: string
 *                     description: Single phone number
 *                     example: "6281234567890"
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: Array of phone numbers
 *                     example: ["6281234567890", "6289876543210"]
 *               caption:
 *                 type: string
 *                 description: Caption for the media
 *                 example: "Check this image!"
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file to send
 *     responses:
 *       200:
 *         description: Media sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Media sent successfully"
 *       400:
 *         description: Bad request (validation error, device not found, or no file uploaded)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to send media
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /devices/chats:
 *   post:
 *     summary: Get all chats from a device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID to get chats from
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Chats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 chats:
 *                   type: array
 *                   description: Array of chat objects
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad request (validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get chats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /devices/qr-code:
 *   post:
 *     summary: Generate QR code for device authentication
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID to generate QR code for
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: QR code generated successfully
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (Device ID is required)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to generate QR code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
