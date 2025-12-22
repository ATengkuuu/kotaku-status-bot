require('dotenv').config(); // Load environment variables

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const axios = require("axios");
const fs = require("fs");
const DiscordLogger = require("./logger"); // Import logger

// Environment variables - AMAN untuk di-push ke GitHub
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CFX_SERVER_ID = process.env.CFX_SERVER_ID;
const TX_ADMIN_IP = process.env.TX_ADMIN_IP;
const TX_ADMIN_PORT = process.env.TX_ADMIN_PORT;
const LOGO_URL = process.env.LOGO_URL;
const BG_URL = process.env.BG_URL;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Inisialisasi logger
const logger = new DiscordLogger(process.env.WEBHOOK_URL);

// Validasi environment variables
if (!BOT_TOKEN || !CHANNEL_ID || !CFX_SERVER_ID) {
    console.error('❌ ERROR: Environment variables tidak lengkap!');
    console.error('Pastikan file .env sudah dibuat dengan benar.');
    process.exit(1);
}

let botStartTime = Date.now();
let lastKnownStatus = null; // Track status terakhir

async function getBotUptime() {
    const uptimeMs = Date.now() - botStartTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Fungsi terpisah untuk mengambil data server agar lebih rapi
async function fetchServerData() {
    try {
        const config = {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DiscordBot/1.0' }
        };

        let serverUptime = 0;
        try {
            const txResponse = await axios.get(`http://${TX_ADMIN_IP}:${TX_ADMIN_PORT}/status.json`, {
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0 DiscordBot/1.0' }
            });
            
            if (txResponse.data && txResponse.data.status) {
                const uptimeStr = txResponse.data.status.uptime || "0";
                if (typeof uptimeStr === 'string' && uptimeStr.includes('h')) {
                    const hours = parseInt(uptimeStr.match(/(\d+)h/)?.[1] || 0);
                    const minutes = parseInt(uptimeStr.match(/(\d+)m/)?.[1] || 0);
                    serverUptime = (hours * 3600) + (minutes * 60);
                } else {
                    serverUptime = parseInt(uptimeStr) || 0;
                }
                console.log(`[TX Admin] Uptime: ${serverUptime}s`);
            }
        } catch (txError) {
            console.log(`[TX Admin] Tidak dapat mengambil data dari TX Admin: ${txError.message}`);
        }

        const response = await axios.get(`https://servers-frontend.fivem.net/api/servers/single/${CFX_SERVER_ID}`, config);
        
        const serverInfo = response.data.Data;
        const players = parseInt(serverInfo.clients) || 0;
        const maxPlayers = parseInt(serverInfo.sv_maxclients) || 0;
        
        if (serverUptime === 0) {
            serverUptime = parseInt(serverInfo.vars?.uptime) || 0;
        }
        
        console.log(`[CFX API] Successfully fetched: ${players}/${maxPlayers} players, Uptime: ${serverUptime}s`);
        
        return {
            online: true,
            players: players,
            maxPlayers: maxPlayers,
            uptime: serverUptime
        };
    } catch (error) {
        console.log(`[Fetch Error] Gagal mengambil data server: ${error.message}`);
        
        // Log error ke Discord
        await logger.error("❌ Gagal mengambil data server", {
            error: error.message,
            server: CFX_SERVER_ID,
            timestamp: new Date().toLocaleString('id-ID')
        });
        
        return {
            online: false,
            players: 0,
            maxPlayers: 0,
            uptime: 0
        };
    }
}

async function getStatus() {
    // 1. Ambil data server (Player count, dll) terlebih dahulu
    //    Ini memperbaiki bug 0/0. Kita ambil datanya dulu, baru tentukan label statusnya.
    const serverData = await fetchServerData();
    
    // Default response object
    let statusResponse = {
        online: serverData.online,
        players: serverData.players,
        maxPlayers: serverData.maxPlayers,
        uptime: serverData.uptime || 0,
        maintenance: false,
        adminOnly: false,
        maintenanceReason: null,
        adminReason: null
    };

    // 2. Cek File Maintenance (Prioritas Tertinggi)
    try {
        if (fs.existsSync('./maintenance.txt')) {
            const maintenanceText = fs.readFileSync('./maintenance.txt', 'utf8').trim();
            statusResponse.maintenance = true;
            statusResponse.maintenanceReason = maintenanceText || 'Server sedang dalam perbaikan';
            // Jika maintenance, biasanya kita anggap player 0, tapi kalau mau tetap baca status asli server, biarkan players apa adanya.
            // Di sini saya set online false agar status barnya merah jika full maintenance
            statusResponse.online = false; 
            return statusResponse;
        }
    } catch (err) { console.log('Error reading maintenance file:', err.message); }

    // 3. Cek File Admin Only (Prioritas Kedua)
    try {
        if (fs.existsSync('./admin-only.txt')) {
            const adminText = fs.readFileSync('./admin-only.txt', 'utf8').trim();
            
            statusResponse.adminOnly = true;
            statusResponse.online = serverData.online; // Tetap online, hanya dilabeli Admin Only
            statusResponse.adminReason = adminText || 'Server hanya untuk admin sementara';
            
            // LOGGING UNTUK DEBUG
            if (serverData.online) {
                console.log(`[Admin-Only Mode] Server Online. Players: ${statusResponse.players}/${statusResponse.maxPlayers}`);
            } else {
                console.log(`[Admin-Only Mode] Server Offline/Unreachable.`);
            }

            return statusResponse;
        }
    } catch (err) { console.log('Error reading admin-only file:', err.message); }

    // 4. Jika tidak ada file maintenance/admin, return status normal (Public)
    if (serverData.online) {
        console.log(`[Public Mode] Server Online. Players: ${statusResponse.players}/${statusResponse.maxPlayers}`);
    } else {
        console.log(`[Public Mode] Server Offline.`);
    }

    return statusResponse;
}

async function buildEmbed() {
    const status = await getStatus();
    const embedColor = 0x00BFFF; 

    // Tentukan Status Text
    let statusTitle = "🔴 Offline";
    let statusValue = "Offline";

    if (status.maintenance) {
        statusTitle = "🔴 Maintenance";
        statusValue = "🔧 Maintenance Mode";
    } else if (status.adminOnly) {
        // Jika server online tapi file admin ada
        if (status.online) {
            statusTitle = "🟡 Admin Only";
            statusValue = "🛡️ Online (Restricted)";
        } else {
            statusTitle = "🟡 Admin Only (Offline)";
            statusValue = "🛡️ Server Offline";
        }
    } else if (status.online) {
        statusTitle = "🟢 Online";
        statusValue = "✅ Public Server";
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle("✨ **Kotarist Roleplay** — Server Status ✨")
        .setThumbnail(LOGO_URL)
        .setImage(BG_URL)
        .addFields(
            {
                name: "📡 Status Server",
                value: `\`\`\`\n${statusValue}\n\`\`\``,
                inline: true
            },
            {
                name: "👥 Players",
                value: `\`\`\`\n${status.players} / ${status.maxPlayers}\n\`\`\``,
                inline: true
            }
        );

    // Tambahkan field khusus jika ada maintenance atau admin only
    if (status.maintenance) {
        embed.addFields({
            name: "🔧 Info Perbaikan", 
            value: `\`\`\`\n${status.maintenanceReason}\n\`\`\``,
            inline: false
        });
    }

    if (status.adminOnly) {
        embed.addFields({
            name: "🛡️ Info Admin Only",
            value: `\`\`\`\n${status.adminReason}\n\`\`\``,
            inline: false
        });
    }

    // Field Connect & Info lainnya
    embed.addFields(
        {
            name: "🎮 F8 CONNECT (MAIN)",
            value: "```\nconnect connect minerva.dopminer.cloud\n```",
            inline: false
        },
        {
            name: "🎮 F8 CONNECT (PROXY)",
            value: "```\nconnect connect minerva-portal.dopminer.cloud\n```",
            inline: false
        },
        {
            name: "⏳ Restart Info",
            value: `Cek pengumuman restart di <#1444684560418865245>`,
            inline: false
        },
        {
            name: "⏰ Server Uptime",
            value: `\`\`\`\n${status.online ? formatUptime(status.uptime) : '0h 0m'}\n\`\`\``,
            inline: false
        }
    )
    .setFooter({ text: "Kotarist Roleplay • Update setiap 1 menit" })
    .setTimestamp();

    return embed;
}

async function updateBotPresence() {
    try {
        const status = await getStatus();
        let activityName;

        if (status.maintenance) {
            activityName = "🔧 Server Maintenance";
        } else if (status.adminOnly) {
            // Tampilkan player count juga saat admin only jika server online
            if (status.online) {
                activityName = `🛡️ Admin Only (${status.players}/${status.maxPlayers})`;
            } else {
                activityName = "🛡️ Admin Only (Offline)";
            }
        } else if (status.online) {
            activityName = `${status.players}/${status.maxPlayers} Players Online`;
        } else {
            activityName = "🔴 Server Offline";
        }
        
        client.user.setPresence({
            status: status.maintenance ? "dnd" : (status.online ? "online" : "idle"),
            activities: [{
                name: activityName,
                type: 3 // Watching
            }]
        });
    } catch (error) {
        console.log('Error updating bot presence:', error.message);
    }
}

async function update() {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) {
            console.log("Channel tidak ditemukan!");
            await logger.error("Channel tidak ditemukan!", { channelId: CHANNEL_ID });
            return;
        }

        const status = await getStatus();
        
        // Deteksi perubahan status
        if (lastKnownStatus !== null) {
            if (lastKnownStatus.online !== status.online) {
                if (status.online) {
                    await logger.success("✅ Server kembali online!", {
                        players: `${status.players}/${status.maxPlayers}`,
                        uptime: formatUptime(status.uptime)
                    });
                } else {
                    await logger.error("🔴 Server offline terdeteksi!", {
                        lastPlayers: `${lastKnownStatus.players}/${lastKnownStatus.maxPlayers}`,
                        reason: "Server tidak merespon API"
                    });
                }
            }
            
            if (!lastKnownStatus.maintenance && status.maintenance) {
                await logger.warning("🔧 Server masuk mode maintenance", {
                    reason: status.maintenanceReason
                });
            }
            
            if (!lastKnownStatus.adminOnly && status.adminOnly) {
                await logger.warning("🛡️ Server masuk mode Admin Only", {
                    reason: status.adminReason,
                    players: `${status.players}/${status.maxPlayers}`
                });
            }
        }
        
        lastKnownStatus = { ...status };

        const embed = await buildEmbed();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("🚀 CONNECT SERVER")
                .setStyle(ButtonStyle.Link)
                .setURL("https://cfx.re/join/8r7365")
        );

        const messages = await channel.messages.fetch({ limit: 1 });

        if (messages.size === 0) {
            await channel.send({ embeds: [embed], components: [row] });
        } else {
            const msg = messages.first();
            if (msg.author.id === client.user.id) {
                await msg.edit({ embeds: [embed], components: [row] });
            }
        }
        
        await updateBotPresence();
    } catch (error) {
        console.log("Error pada fungsi update utama:", error.message);
        await logger.error("⚠️ Error pada fungsi update", {
            error: error.message,
            stack: error.stack.substring(0, 500)
        });
    }
}

client.on("clientReady", async () => {
    console.log(`Bot online sebagai ${client.user.tag}`);
    botStartTime = Date.now();
    
    // Log bot startup
    await logger.success("🚀 Bot berhasil online!", {
        tag: client.user.tag,
        guilds: client.guilds.cache.size,
        startTime: new Date().toLocaleString('id-ID')
    });
    
    update();
    setInterval(update, 60000);
});

// Log error yang tidak tertangani
process.on('unhandledRejection', async (error) => {
    console.error('Unhandled Rejection:', error);
    await logger.error("💥 Unhandled Rejection Error", {
        error: error.message,
        stack: error.stack?.substring(0, 500)
    });
});

process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await logger.error("💥 Uncaught Exception Error", {
        error: error.message,
        stack: error.stack?.substring(0, 500)
    });
    process.exit(1);
});

// Log saat bot disconnect
client.on('disconnect', async () => {
    console.log('Bot disconnected from Discord');
    await logger.warning("⚠️ Bot terputus dari Discord", {
        timestamp: new Date().toLocaleString('id-ID'),
        uptime: formatUptime((Date.now() - botStartTime) / 1000)
    });
});

// Log saat bot error
client.on('error', async (error) => {
    console.error('Discord client error:', error);
    await logger.error("❌ Discord Client Error", {
        error: error.message,
        stack: error.stack?.substring(0, 500)
    });
});

// Graceful shutdown - Log sebelum bot mati
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await logger.warning("🛑 Bot dimatikan secara manual (SIGINT)", {
        uptime: formatUptime((Date.now() - botStartTime) / 1000),
        timestamp: new Date().toLocaleString('id-ID')
    });
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await logger.warning("🛑 Bot dimatikan secara manual (SIGTERM)", {
        uptime: formatUptime((Date.now() - botStartTime) / 1000),
        timestamp: new Date().toLocaleString('id-ID')
    });
    await client.destroy();
    process.exit(0);
});

client.login(BOT_TOKEN);