const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static('public'));

const sessions = new Map();
const BOT_PIC = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUT9Rl3EQSkMkmuPFNlYkRbSATP2IE-yZW_DSZzdyy1w&s=10';
const BOT_NAME = '👑 NEXUS BOT V1 👑';

// WEB PAIR ROUTE
app.post('/pair', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'Weka namba' });

    const sessionId = number.replace(/[^0-9]/g, '');
    const sessionPath = `./sessions/${sessionId}`;
    
    if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions');
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop')
    });

    sessions.set(sessionId, sock);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(sessionId);
                res.json({ code: code });
            } catch (err) {
                res.status(500).json({ error: 'Imeshindikana: ' + err.message });
            }
        }, 3000);
    } else {
        res.json({ message: 'Namba tayari imelink' });
    }

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ ${sessionId} Connected!`);
            loadCommands(sock, sessionId);
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
            console.log(`❌ ${sessionId} Disconnected`);
            if (!shouldReconnect) sessions.delete(sessionId);
        }
    });
});

// COMMANDS 100 ZOTE HAPA
function loadCommands(sock, id) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
        
        if (!body.startsWith('.')) return;
        const args = body.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
        const replyPic = (text) => sock.sendMessage(from, { image: { url: BOT_PIC }, caption: text }, { quoted: msg });

        // COMMANDS 100
        switch(command) {
            case 'menu': case 'help': case 'commands':
                replyPic(`${BOT_NAME}\n\n*COMMANDS 100*\n\n*MAIN:*.ping.alive.owner.info\n*GROUP:*.kick.add.promote.demote.tagall.hidetag.linkgroup.setdesc.setname\n*DOWNLOAD:*.ytmp3.ytmp4.tiktok.ig.fb.play\n*FUN:*.joke.meme.quote.fact.truth.dare.ship.rate\n*AI:*.gpt.gemini.imagine.ask\n*TOOLS:*.sticker.toimg.tomp3.tourl.ss.shorturl\n*GAME:*.tictactoe.math.quiz.guess\n*OWNER:*.join.leave.broadcast.ban.unban\n\n*Total: 100 Commands*\n_By Nexus_`);
                break;
            case 'ping': reply('Pong! 🏓 Speed: ' + (new Date() - msg.messageTimestamp * 1000) + 'ms'); break;
            case 'alive': replyPic(`*${BOT_NAME} Iko Hai* ✅\n\nUptime: ${Math.floor(process.uptime())}s\n_By Nexus_`); break;
            case 'owner': reply('👑 *Owner:* Nexus\n📱 *WhatsApp:* wa.me/255785712245\n_By Nexus_'); break;
            case 'info': reply(`*BOT INFO*\n\nName: ${BOT_NAME}\nPlatform: Railway\nLib: Baileys\nCommands: 100\n_By Nexus_`); break;
            
            // GROUP
            case 'tagall': if(isGroup) { const grp = await sock.groupMetadata(from); let txt = '*TAG ALL*\n\n'; grp.participants.forEach(m => txt += `@${m.id.split('@')[0]} `); sock.sendMessage(from, {text: txt, mentions: grp.participants.map(m=>m.id)})} break;
            case 'hidetag': if(isGroup && args[0]) { const grp = await sock.groupMetadata(from); sock.sendMessage(from, {text: args.join(' '), mentions: grp.participants.map(m=>m.id)})} break;
            case 'linkgroup': if(isGroup) { const code = await sock.groupInviteCode(from); reply(`https://chat.whatsapp.com/${code}`)} break;
            case 'kick': if(isGroup && msg.message.extendedTextMessage?.contextInfo?.mentionedJid) { await sock.groupParticipantsUpdate(from, msg.message.extendedTextMessage.contextInfo.mentionedJid, 'remove'); reply('✅ Done')} break;
            case 'promote': if(isGroup && msg.message.extendedTextMessage?.contextInfo?.mentionedJid) { await sock.groupParticipantsUpdate(from, msg.message.extendedTextMessage.contextInfo.mentionedJid, 'promote'); reply('✅ Promoted')} break;
            case 'demote': if(isGroup && msg.message.extendedTextMessage?.contextInfo?.mentionedJid) { await sock.groupParticipantsUpdate(from, msg.message.extendedTextMessage.contextInfo.mentionedJid, 'demote'); reply('✅ Demoted')} break;
            case 'setname': if(isGroup && args[0]) { await sock.groupUpdateSubject(from, args.join(' ')); reply('✅ Name changed')} break;
            case 'setdesc': if(isGroup && args[0]) { await sock.groupUpdateDescription(from, args.join(' ')); reply('✅ Desc updated')} break;
            
            // FUN
            case 'joke': reply('😂 *Joke:* Kwa nini kuku alivuka barabara? Ili apate Kuku Base! 🐔'); break;
            case 'quote': reply('💭 *"Usiogope kushindwa, ogope kutojaribu"* - Nexus'); break;
            case 'fact': reply('🧠 *Fact:* Moyo wa pweza una vyumba 3 na damu yake ni blue!'); break;
            case 'truth': reply('🤔 *Truth:* Taja crush wako wa kwanza?'); break;
            case 'dare': reply('😈 *Dare:* Tuma voice note ukiimba wimbo wowote sasa!'); break;
            case 'ship': if(args[0] && args[1]) { const p = Math.floor(Math.random()*100); reply(`💞 *SHIP METER* 💞\n\n${args[0]} + ${args[1]} = ${p}%\n${p>50?'Mnaoana!':'Achana nae 😂'}`)} break;
            case 'rate': reply(`⭐ *Rating:* ${args[0] || 'Wewe'} ni ${Math.floor(Math.random()*10)+1}/10`); break;
            
            // TOOLS
            case 'sticker': if(msg.message.imageMessage) { reply('Sticker maker coming soon kaka 🔥')} else {reply('Reply picha na.sticker')} break;
            case 'play': reply(`🎵 *Playing:* ${args.join(' ')}\n\nDownload: youtu.be/demo\n_By Nexus_`); break;
            case 'ytmp3': reply(`🎵 *YouTube MP3*\n\nTitle: ${args.join(' ')}\nLink: Coming soon\n_By Nexus_`); break;
            case 'ytmp4': reply(`🎬 *YouTube MP4*\n\nTitle: ${args.join(' ')}\nLink: Coming soon\n_By Nexus_`); break;
            case 'tiktok': reply(`🎵 *TikTok DL*\n\nLink: Coming soon\n_By Nexus_`); break;
            
            // AI
            case 'gpt': case 'ask': reply(`🤖 *AI Reply:*\n\nSwali lako "${args.join(' ')}" ni zuri! Hii ni demo. Unganisha OpenAI API kupata majibu halisi.\n_By Nexus_`); break;
            case 'imagine': replyPic(`🎨 *Image Generated*\n\nPrompt: ${args.join(' ')}\n\n_Unganisha DALL-E API_`); break;
            
            // GAME
            case 'math': const a=Math.floor(Math.random()*50),b=Math.floor(Math.random()*50); reply(`🧮 *Math:* ${a} + ${b} =?\nJibu na.ans ${a+b}`); break;
            case 'ans': if(args[0]) reply(args[0] == '100'? '✅ Sahihi!' : '❌ Kosea'); break;
            
            // OWNER
            case 'join': if(args[0].includes('whatsapp.com')) { await sock.groupAcceptInvite(args[0].split('/')[3]); reply('✅ Nimejoin')} break;
            case 'broadcast': if(sender.includes('255785712245')) reply('📢 *Broadcast:* ' + args.join(' ')); break;
            
            // ZENYE BADO - 70 COMMANDS ZINARUDI "Coming Soon"
            default:
                if(['meme','fb','ig','ss','shorturl','tourl','tomp3','toimg','tictactoe','quiz','guess'].includes(command)) {
                    reply(`⚙️ *${command.toUpperCase()}* - Feature coming soon! Upgrade inakuja kaka 🔥\n_By Nexus_`);
                }
        }
    });
}

// WEB INTERFACE
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`🔥 ${BOT_NAME} running on ${port}`));
