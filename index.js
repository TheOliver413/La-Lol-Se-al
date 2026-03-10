require('dotenv').config();
const {
    Client, GatewayIntentBits, EmbedBuilder, Events,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType
} = require('discord.js');
const http = require('http');
const https = require('https');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

// Servidor dummy para Render/Heroku (Evita el error de port binding)
http.createServer((req, res) => {
    res.write('El bot está vivo!');
    res.end();
}).listen(process.env.PORT || 10000);

// --- Mecanismo ANTI-SLEEP (Auto-Ping) ---
const URL_RENDER = 'https://la-lol-se-al.onrender.com';
setInterval(() => {
    https.get(URL_RENDER, (res) => {
        console.log('📡 Auto-ping enviado...');
    }).on('error', (err) => console.error('Error auto-ping:', err.message));
}, 600000);

// Configuración del bot con los intents requeridos
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // Necesario para entrar al canal de voz
    ],
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`🤖 Bot listo! Autenticado como: ${readyClient.user.tag}`);
});

// Función para reproducir el sonido de pánico
async function playPanicSound(channel) {
    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource('https://www.myinstants.com/media/sounds/teemo-laugh.mp3');

        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
        });

        // Autocerrar si algo falla o tarda mucho
        setTimeout(() => {
            if (connection) connection.destroy();
        }, 15000);

    } catch (error) {
        console.error('Error en Voice:', error);
    }
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content.toUpperCase() === 'LOL SEÑAL') {
        const guild = message.guild;
        if (!guild) return;

        const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'lol');
        if (!role) return message.reply('❌ No se encontró el rol "lol".');

        // Estado local de la señal activa
        let playersByRole = {
            '🛡️ TOP': null,
            '⚔️ JNG': null,
            '🧙 MID': null,
            '🏹 ADC': null,
            '💉 SUP': null
        };

        const createEmbed = () => {
            let list = Object.entries(playersByRole).map(([lane, userId]) => {
                return `**${lane}:** ${userId ? `<@${userId}>` : '*Buscando...*'}`;
            }).join('\n');

            return new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle('🚀 ¡LA SEÑAL HA SIDO ACTIVADA!')
                .setDescription(`**POSICIONES EN LA GRIETA:**\n${list}\n\n*Haz clic en "¡VOY!" para elegir tu línea.*`)
                .setImage('https://i.imgur.com/AfFp7pu.png')
                .setTimestamp()
                .setFooter({ text: 'Protocolo de Emergencia LOL', iconURL: client.user.displayAvatarURL() });
        };

        const mainRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('voy_lol').setLabel('¡VOY! ⚔️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('no_puedo_lol').setLabel('No puedo ❌').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('panico_lol').setLabel('PANICO 😱').setStyle(ButtonStyle.Secondary)
        );

        const initialMsg = await message.channel.send('📡 **Detectando señal...**');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await initialMsg.delete();

        const mainMsg = await message.channel.send({
            content: `⚠️ **¡ATENCIÓN!** ${role}`,
            embeds: [createEmbed()],
            components: [mainRow]
        });

        // Notificaciones masivas
        await guild.members.fetch();
        const membersWithRole = role.members.filter(m => !m.user.bot);
        if (membersWithRole.size > 0) {
            const mentions = membersWithRole.map(m => `<@${m.id}>`).join(' ');
            message.channel.send(`⚔️ **Convocando:** ${mentions}`).then(m => setTimeout(() => m.delete(), 5000));
        }

        // Colector de interacciones
        const collector = mainMsg.createMessageComponentCollector({ time: 600000 });

        collector.on('collect', async i => {
            // --- BOTÓN VOY ---
            if (i.customId === 'voy_lol') {
                const laneRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('lane_TOP').setLabel('TOP').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('lane_JNG').setLabel('JNG').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('lane_MID').setLabel('MID').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('lane_ADC').setLabel('ADC').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('lane_SUP').setLabel('SUP').setStyle(ButtonStyle.Primary)
                );
                await i.reply({ content: '⚔️ **¿Qué línea vas a jugar?**', components: [laneRow], ephemeral: true });
            }

            // --- BOTÓN NO PUEDO ---
            else if (i.customId === 'no_puedo_lol') {
                Object.keys(playersByRole).forEach(key => {
                    if (playersByRole[key] === i.user.id) playersByRole[key] = null;
                });
                await mainMsg.edit({ embeds: [createEmbed()] });
                await i.reply({ content: 'Entendido. Borrado de la lista.', ephemeral: true });
            }

            // --- BOTÓN PÁNICO ---
            else if (i.customId === 'panico_lol') {
                const voiceChannel = i.member.voice.channel;
                if (voiceChannel) {
                    await i.reply({ content: '🔔 **Enviando señal sonora al canal de voz...**', ephemeral: true });
                    playPanicSound(voiceChannel);
                } else {
                    await i.reply({ content: '❌ Debes estar en un canal de voz para usar esto.', ephemeral: true });
                }
            }

            // --- BOTONES DE LÍNEA ---
            else if (i.customId.startsWith('lane_')) {
                const selectedLane = i.customId.replace('lane_', '');
                const fullLaneKey = Object.keys(playersByRole).find(k => k.includes(selectedLane));

                if (playersByRole[fullLaneKey] && playersByRole[fullLaneKey] !== i.user.id) {
                    return i.update({ content: `⚠️ ${selectedLane} ya está ocupado por <@${playersByRole[fullLaneKey]}>`, components: [] });
                }

                // Mover al jugador si ya estaba en otra
                Object.keys(playersByRole).forEach(key => {
                    if (playersByRole[key] === i.user.id) playersByRole[key] = null;
                });

                playersByRole[fullLaneKey] = i.user.id;
                await mainMsg.edit({ embeds: [createEmbed()] });
                await i.update({ content: `✅ ¡Vas a jugar **${selectedLane}**!`, components: [] });
            }
        });

        collector.on('end', () => {
            const rowDisabled = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('d').setLabel('Señal Expirada').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            mainMsg.edit({ components: [rowDisabled] }).catch(() => { });
        });
    }
});

process.on('unhandledRejection', error => console.error('Error detectado:', error));
client.login(process.env.DISCORD_TOKEN);
