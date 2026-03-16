require('dotenv').config();
const {
    Client, GatewayIntentBits, EmbedBuilder, Events,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType
} = require('discord.js');
const http = require('http');
const https = require('https');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

// Servidor dummy para Render
http.createServer((req, res) => {
    res.write('OK');
    res.end();
}).listen(process.env.PORT || 10000);

// Anti-sleep
const URL_RENDER = 'https://la-lol-se-al.onrender.com';
setInterval(() => {
    https.get(URL_RENDER, () => { }).on('error', () => { });
}, 600000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`🤖 Bot listo: ${readyClient.user.tag}`);
});

// Sonido de pánico
async function playPanicSound(channel) {
    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource('https://www.myinstants.com/media/sounds/siren.mp3');

        player.play(resource);
        connection.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => connection.destroy());
        setTimeout(() => { if (connection) connection.destroy(); }, 15000);
    } catch (e) { console.error(e); }
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content.toUpperCase() === 'LOL SEÑAL') {
        const guild = message.guild;
        if (!guild) return;

        const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'lol');
        if (!role) return message.reply('❌ No se encontró el rol "lol".');

        let playersByRole = {
            '🛡️ TOP': null, '⚔️ JNG': null, '🧙 MID': null, '🏹 ADC': null, '💉 SUP': null
        };

        const createEmbed = () => {
            let list = Object.entries(playersByRole).map(([lane, userId]) =>
                `**${lane}:** ${userId ? `<@${userId}>` : '*Buscando...*'}`
            ).join('\n');

            return new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle('🚀 ¡LA SEÑAL HA SIDO ACTIVADA!')
                .setDescription(`**POSICIONES EN LA GRIETA:**\n${list}\n\n*Haz clic en "¡VOY!" para elegir tu línea.*`)
                .setImage('https://i.imgur.com/AfFp7pu.png')
                .setTimestamp();
        };

        const mainRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('voy_lol').setLabel('¡VOY! ⚔️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('no_puedo_lol').setLabel('No puedo ❌').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('panico_lol').setLabel('PANICO 😱').setStyle(ButtonStyle.Secondary)
        );

        const mainMsg = await message.channel.send({
            content: `⚠️ **¡ATENCIÓN!** ${role}`,
            embeds: [createEmbed()],
            components: [mainRow]
        });

        // Menciones rápidas
        await guild.members.fetch();
        const members = role.members.filter(m => !m.user.bot);
        if (members.size > 0) {
            const mText = members.map(m => `<@${m.id}>`).join(' ');
            message.channel.send(`⚔️ **Convocando:** ${mText}`).then(msg => setTimeout(() => msg.delete(), 5000));
        }

        const collector = mainMsg.createMessageComponentCollector({ time: 600000 });

        collector.on('collect', async i => {
            try {
                // --- BOTÓN VOY ---
                if (i.customId === 'voy_lol') {
                    const laneRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('l_TOP').setLabel('TOP').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('l_JNG').setLabel('JNG').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('l_MID').setLabel('MID').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('l_ADC').setLabel('ADC').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('l_SUP').setLabel('SUP').setStyle(ButtonStyle.Primary)
                    );

                    const filter = (btn) => btn.user.id === i.user.id;
                    const response = await i.reply({ content: '⚔️ **Elige tu línea:**', components: [laneRow], ephemeral: true });

                    try {
                        const b = await response.awaitMessageComponent({ filter, time: 30000 });
                        const laneName = b.customId.replace('l_', '');
                        const fullKey = Object.keys(playersByRole).find(k => k.includes(laneName));

                        if (playersByRole[fullKey] && playersByRole[fullKey] !== b.user.id) {
                            await b.update({ content: `⚠️ ${laneName} ya está ocupado.`, components: [] });
                        } else {
                            Object.keys(playersByRole).forEach(k => { if (playersByRole[k] === b.user.id) playersByRole[k] = null; });
                            playersByRole[fullKey] = b.user.id;
                            await mainMsg.edit({ embeds: [createEmbed()] });
                            await b.update({ content: `✅ ¡Confirmado en **${laneName}**!`, components: [] });
                        }
                    } catch (e) {
                         // Tiempo expirado u otro error
                         await i.editReply({ content: '⏱️ Tiempo expirado.', components: [] }).catch(()=>{});
                    }
                }

                // --- BOTÓN NO PUEDO ---
                else if (i.customId === 'no_puedo_lol') {
                    Object.keys(playersByRole).forEach(k => { if (playersByRole[k] === i.user.id) playersByRole[k] = null; });
                    await mainMsg.edit({ embeds: [createEmbed()] });
                    await i.reply({ content: 'Borrado de la lista.', ephemeral: true });
                }

                // --- BOTÓN PÁNICO ---
                else if (i.customId === 'panico_lol') {
                    if (i.member.voice.channel) {
                        await i.reply({ content: '🔔 Alerta enviada.', ephemeral: true });
                        playPanicSound(i.member.voice.channel);
                    } else {
                        await i.reply({ content: '❌ Entra a un canal de voz primero.', ephemeral: true });
                    }
                }
            } catch (err) { console.error('Error Interaction:', err); }
        });

        collector.on('end', () => {
            const rowD = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('exp').setLabel('Señal Finalizada').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            mainMsg.edit({ components: [rowD] }).catch(() => { });
        });
    }
});

process.on('unhandledRejection', e => console.error(e));
client.login(process.env.DISCORD_TOKEN);
