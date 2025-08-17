const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');

let reconnectAttempts = 0;

// Número objetivo (cambia por el que quieras)
const targetNumber = "573118380666@s.whatsapp.net"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Desktop", "Chrome", "110.0.5585.95"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Mostrar QR en terminal si aparece
        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Conexión cerrada.', shouldReconnect ? 'Reintentando...' : 'Sesión cerrada.');

            if (shouldReconnect) {
                reconnectAttempts++;
                const delay = Math.min(30000, reconnectAttempts * 5000); // espera progresiva (máx 30s)
                console.log(`🔄 Reintento #${reconnectAttempts} en ${delay / 1000}s...`);
                setTimeout(() => startBot(), delay);
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp');
            reconnectAttempts = 0;

            // 🔔 Primer mensaje inmediato
            (async () => {
                try {
                    await sock.sendMessage(targetNumber, { text: "⏰ Hola, este es tu recordatorio automático." });
                    console.log("📤 Primer mensaje enviado al contacto objetivo");
                } catch (err) {
                    console.error("❌ Error enviando primer mensaje:", err);
                }
            })();

            // 🔔 Mensaje cada hora
            setInterval(async () => {
                try {
                    await sock.sendMessage(targetNumber, { text: "⏰ Hola, este es tu recordatorio automático cada hora." });
                    console.log("📤 Mensaje enviado al contacto objetivo");
                } catch (err) {
                    console.error("❌ Error enviando mensaje:", err);
                }
            }, 60 * 60 * 1000); // 1 hora en milisegundos
        }
    });

    // (Opcional) escuchar mensajes entrantes, solo texto
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (!text) return;

            console.log(`📩 Mensaje de ${sender}: ${text}`);
        } catch (err) {
            console.error('❌ Error procesando mensaje:', err);
        }
    });
}

startBot();