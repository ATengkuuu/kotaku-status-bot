# Kotaku Status Bot

Discord bot untuk monitoring status server FiveM Kotarist Roleplay.

## 🚀 Setup

1. **Clone repository ini**
   ```bash
   git clone <repository-url>
   cd kotaku-status-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Buat file `.env`**
   - Copy file `.env.example` menjadi `.env`
   - Isi semua nilai yang diperlukan:
   
   ```env
   # Discord Bot Configuration
   BOT_TOKEN=your_bot_token_here
   CHANNEL_ID=your_channel_id_here
   WEBHOOK_URL=your_discord_webhook_url_here
   
   # FiveM Server Configuration
   CFX_SERVER_ID=your_server_id_here
   
   # TX Admin Configuration
   TX_ADMIN_IP=your_txadmin_ip_here
   TX_ADMIN_PORT=40120
   
   # URLs (Opsional)
   LOGO_URL=your_logo_url_here
   BG_URL=your_background_url_here
   ```

4. **Jalankan bot**
   ```bash
   npm start
   ```

## 📝 Cara Mendapatkan Credentials

### Bot Token
1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Buat aplikasi baru atau pilih yang sudah ada
3. Ke tab "Bot" → klik "Reset Token" → copy token

### Channel ID
1. Aktifkan Developer Mode di Discord (Settings → Advanced → Developer Mode)
2. Klik kanan channel → Copy ID

### Webhook URL
1. Buka Server Settings → Integrations → Webhooks
2. Klik "New Webhook"
3. Pilih channel untuk log
4. Copy Webhook URL

### CFX Server ID
- Dari URL `cfx.re/join/8r7365` → ID nya adalah `8r7365`

## ⚙️ Fitur

- ✅ Real-time server status monitoring
- ✅ Player count tracking
- ✅ Server uptime display
- ✅ Maintenance mode support
- ✅ Admin-only mode support
- ✅ Automatic Discord webhook logging
- ✅ Error tracking & notification

## 🔒 Keamanan

File `.env` **TIDAK AKAN** ter-push ke GitHub karena sudah ada di `.gitignore`.
Jangan pernah share file `.env` atau credentials Anda!

## 📄 License

ISC
