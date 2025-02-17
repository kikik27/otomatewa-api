/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { db } = require('../../utils/db');

let Clients = [];
const SESSIONS_FOLDER = path.join(__dirname, '../../..', '.sessions'); // Folder path
const SESSIONS_FILE = path.join(SESSIONS_FOLDER, 'sessions.json'); // File path

function loadSessions() {
  // Cek apakah folder .sessions ada, jika tidak buat foldernya
  if (!fs.existsSync(SESSIONS_FOLDER)) {
    fs.mkdirSync(SESSIONS_FOLDER, { recursive: true });
  }

  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
  }

  // Baca dan parse file
  return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
}
const sessions = loadSessions();
function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
}

async function initializeClient(deviceId) {
  try {
    // Check if device exists in database
    const device = await db.device.findUnique({
      where: {
        id: deviceId,
      },
    });

    if (!device) {
      const sessionIndex = sessions.findIndex((session) => session.id === deviceId);
      if (sessionIndex !== -1) {
        sessions.splice(sessionIndex, 1);
        saveSessions();
        console.log(`Session for device ${deviceId} has been removed`);

        const sessionFolder = path.join(__dirname, '../../..', '.wwebjs_auth', `session-${deviceId}`);
        if (fs.existsSync(sessionFolder)) {
          rimraf.sync(sessionFolder);
          console.log(`Session folder ${sessionFolder} has been removed`);
        }
      }
      console.log(`Device ${deviceId} not found in database`);
      return null;
    }

    // Proceed with initialization if device exists
    const sessionIndex = sessions.findIndex((session) => session.id === deviceId);
    console.log('Initializing device: ', deviceId);

    if (sessionIndex === -1) {
      sessions.push({ id: deviceId, name: device.name, data: {} });  // Using device.name from db
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
      console.log(`Device ${deviceId} is ready`);
      await db.device.update({
        where: {
          id: deviceId,
        },
        data: {
          status: true,
        },
      });
    });

    client.on("message", async (message) => {
      console.log(message);
    })

    client.initialize();
    return client;

  } catch (error) {
    console.error(`Error initializing device ${deviceId}:`, error);
    return null;
  }
}

Clients = sessions.map((session) => initializeClient(session.id, session.name));

module.exports = {
  initializeClient,
  Clients,
  sessions,
  saveSessions,
};
