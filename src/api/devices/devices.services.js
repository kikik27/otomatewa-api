/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
const qrcode = require('qrcode');
const { db } = require('../../utils/db');
const { initializeClient, sessions, saveSessions } = require('./devices.clients');

async function createDevice(data) {
  const device = await db.device.create({
    data,
  });
  sessions.push({ id: device.id, name: device.name, data: {} });
  saveSessions();
  initializeClient(device.id, device.name);
  return device;
}

async function findDeviceById(id) {
  const device = db.device.findUnique({
    where: {
      id,
    },
  });

  if (!device) {
    const error = new Error('Device not found');
    error.status = 404;
    throw error;
  }

  return device;
}

async function setDeviceQr(deviceId, code) {
  const device = await findDeviceById(deviceId);
  db.device.update({
    where: {
      id: device.id,
    },
    data: {
      code,
    },
  });
}

async function getAllDevices() {
  return db.device.findMany();
}

async function generateQrCode(deviceId) {
  const device = await findDeviceById(deviceId);
  const qrCodeBuffer = qrcode.toBuffer(device.code);
  return qrCodeBuffer;
}

async function getDevices({
  page = 1, limit = 10, name, status,
}) {
  console.log(typeof (status));
  console.log(status);
  const filters = {};

  if (name) {
    filters.name = {
      contains: name,
    };
    filters.status = status;
  }

  if (status !== null) {
    filters.status = status;
  }

  const devices = await db.device.findMany({
    where: filters,
    skip: (page - 1) * limit,
    take: limit,
  });

  const totalDevices = await db.device.count({
    where: filters,
  });

  return {
    data: devices,
    total: totalDevices,
    page,
    limit,
    totalPages: Math.ceil(totalDevices / limit),
  };
}

module.exports = {
  getAllDevices,
  findDeviceById,
  createDevice,
  setDeviceQr,
  getDevices,
  generateQrCode,
};
