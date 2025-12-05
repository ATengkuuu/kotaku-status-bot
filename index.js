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

const BOT_TOKEN = "// Masukkan token bot Discord Anda di sini"; // Masukkan token bot Discord Anda di sini
const CHANNEL_ID = "// 1445586504742207630";
const SERVER_IP = "// http://74.63.203.195"; // contoh: http://103.xxx.xxx:30120
const LOGO_URL = "https://cdn.discordapp.com/attachments/1445254812894494872/1445689776970666165/kotakurp.png?ex=69314306&is=692ff186&hm=2216cf40938dde4930e26eafa493b9c5e9d029e42f2489e29ee92438b2ee692f.png";
const BG_URL = "https://cdn.discordapp.com/attachments/1445254812894494872/1445689776970666165/kotakurp.png?ex=69314306&is=692ff186&hm=2216cf40938dde4930e26eafa493b9c5e9d029e42f2489e29ee92438b2ee692f.png";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Variabel untuk menyimpan waktu mulai bot
let botStartTime = Date.now();

async function getUptime() {
    const uptimeMs = Date.now() - botStartTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
}

async function getStatus() {
    // Cek apakah ada file maintenance.txt (full maintenance)
    try {
        if (fs.existsSync('./maintenance.txt')) {
            const maintenanceText = fs.readFileSync('./maintenance.txt', 'utf8').trim();
            return {
                online: false,
                players: 0,
                maxPlayers: 0,
                maintenance: true,
                adminOnly: false,
                maintenanceReason: maintenanceText || 'Server sedang dalam perbaikan'
            };
        }
    } catch (err) {
        console.log('Error reading maintenance file:', err.message);
    }

    // Cek apakah ada file admin-only.txt (hanya admin yang bisa masuk)
    try {
        if (fs.existsSync('./admin-only.txt')) {
            const adminText = fs.readFileSync('./admin-only.txt', 'utf8').trim();
            
            // Tetap cek status server untuk player count
            try {
                const info = await axios.get(`${SERVER_IP}/info.json`);
                const players = await axios.get(`${SERVER_IP}/players.json`);
                const count = players.data.length;
                const max = info.data.vars.sv_maxClients;
                
                return {
                    online: true,
                    players: count,
                    maxPlayers: max,
                    maintenance: false,
                    adminOnly: true,
                    adminReason: adminText || 'Server hanya untuk admin sementara'
                };
            } catch (e) {
                // Jika server offline tapi file admin-only ada, tetap return admin-only
                return {
                    online: false,
                    players: 0,
                    maxPlayers: 0,
                    maintenance: false,
                    adminOnly: true,
                    adminReason: adminText || 'Server hanya untuk admin sementara'
                };
            }
        }
    } catch (err) {
        console.log('Error reading admin-only file:', err.message);
    }

    // Cek status server normal (public)
    try {
        const info = await axios.get(`${SERVER_IP}/info.json`);
        const players = await axios.get(`${SERVER_IP}/players.json`);

        const count = players.data.length;
        const max = info.data.vars.sv_maxClients;

        return {
            online: true,
            players: count,
            maxPlayers: max,
            maintenance: false,
            adminOnly: false
        };
    } catch (e) {
        return {
            online: false,
            players: 0,
            maxPlayers: 0,
            maintenance: false,
            adminOnly: false
        };
    }
}

async function buildEmbed() {
    const status = await getStatus();

    // Warna embed tetap biru muda
    const embedColor = 0x00BFFF; // Selalu biru muda

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle("✨ **Kotaku Roleplay** — Server Status ✨")
        .setThumbnail(LOGO_URL)
        .setImage(BG_URL)
        .addFields(
            {
                name: status.maintenance ? "🔴 Status" : (status.adminOnly ? "🟡 Status" : (status.online ? "🟢 Status" : "🔴 Status")),
                value: `\`\`\`\n${status.maintenance ? "🔧 Maintenance" : (status.adminOnly ? "🛡️ Admin Only" : (status.online ? "Online" : "Offline"))}\n\`\`\``,
                inline: true
            },
            {
                name: "👥 Players",
                value: `\`\`\`\n${status.players} / ${status.maxPlayers}\n\`\`\``,
                inline: true
            },
            ...(status.maintenance ? [{
                name: "🔧 Info Maintenance", 
                value: `\`\`\`\n${status.maintenanceReason}\n\`\`\``,
                inline: false
            }] : []),
            ...(status.adminOnly ? [{
                name: "🛡️ Info Admin Only",
                value: `\`\`\`\n${status.adminReason}\n\`\`\``,
                inline: false
            }] : []),
            {
                name: "⏳ Restart Info",
                value: `Cek pengumuman restart di <#1444684560418865245>`,
                inline: false
            },
            {
                name: "🕒 **Server Uptime**",
                value: `\`\`\`\n${await getUptime()}\n\`\`\``,
                inline: true
            },
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
        )
        .setFooter({ text: "Kotaku Roleplay" })
        .setTimestamp();

    return embed;
}

async function updateBotPresence() {
    try {
        const status = await getStatus();
        const playerCount = status.players;
        const maxPlayers = status.maxPlayers;
        
        let activityName;
        if (status.maintenance) {
            activityName = "🔧 Server Maintenance";
        } else if (status.adminOnly) {
            activityName = "🛡️ Admin Only Mode";
        } else {
            activityName = `${playerCount}/${maxPlayers} Players Online`;
        }
        
        client.user.setPresence({
            status: "online",
            activities: [
                {
                    name: activityName,
                    type: 3 // Watching
                }
            ]
        });
    } catch (error) {
        console.log('Error updating bot presence:', error.message);
        // Fallback status jika ada error
        client.user.setPresence({
            status: "online",
            activities: [
                {
                    name: "KOTAKU Roleplay 2.0",
                    type: 3
                }
            ]
        });
    }
}

async function update() {
    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = await buildEmbed();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("🚀 CONNECT SERVER")
            .setStyle(ButtonStyle.Link)
            .setURL("https://cfx.re/join/minerva-dop")
    );

    const messages = await channel.messages.fetch({ limit: 1 });

    if (messages.size === 0) {
        await channel.send({ embeds: [embed], components: [row] });
    } else {
        const msg = messages.first();
        await msg.edit({ embeds: [embed], components: [row] });
    }
    
    // Update bot presence setiap kali update embed
    await updateBotPresence();
}

client.on("clientReady", async () => {
    console.log(`Bot online sebagai ${client.user.tag}`);
    botStartTime = Date.now(); // Reset start time ketika bot siap
    
    // Tampilkan info players saat bot start
    try {
        const status = await getStatus();
        console.log(`👥 Players Online: ${status.players}/${status.maxPlayers}`);
    } catch (error) {
        console.log('Error getting player count:', error.message);
    }
    
    // Initial update dan set interval
    update();
    setInterval(update, 60000);
});

// Link button langsung ke CFX, tidak perlu interaction handler

client.login(BOT_TOKEN);