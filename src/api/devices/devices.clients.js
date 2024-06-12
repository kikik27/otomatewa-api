/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const { db } = require('../../utils/db');

let Clients = [];
const SESSIONS_FILE = './.sessions/clients.json';

function loadSessions() {
  if (fs.existsSync(SESSIONS_FILE)) {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE));
  }
  return [];
}
const sessions = loadSessions();
// Save sessions to file
function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
}

function initializeClient(deviceId, deviceName) {
  const sessionIndex = sessions.findIndex((session) => session.id === deviceId);
  console.log('Initializing device: ', deviceName);

  if (sessionIndex === -1) {
    sessions.push({ id: deviceId, name: deviceName, data: {} });
    saveSessions(sessions);
  }

  const client = new Client({
    session: sessions[sessionIndex].data,
    authStrategy: new LocalAuth({ clientId: deviceId }),
    puppeteer: { headless: true },
    multiDevice: true,
    webVersionCache: {
      type: 'remote',
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      },
      remotePath:
        'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
  });

  client.on('qr', async (code) => {
    await db.device.update({
      where: {
        id: deviceId,
      },
      data: {
        code,
        status: false,
      },
    });
  });

  client.on('ready', async () => {
    console.log(`Device ${deviceName} is ready`);
    await db.device.update({
      where: {
        id: deviceId,
      },
      data: {
        status: true,
      },
    });
  });

  client.initialize();
  return client;
}

Clients = sessions.map((session) => initializeClient(session.id, session.name));

module.exports = {
  initializeClient,
  Clients,
  sessions,
  saveSessions,
};
