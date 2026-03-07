require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Configuración del bot con los intents requeridos
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // Para acceder a los servidores y roles
        GatewayIntentBits.GuildMessages,    // Para recibir mensajes
        GatewayIntentBits.MessageContent,   // Para leer el contenido de los mensajes
        GatewayIntentBits.GuildMembers      // Para listar miembros del rol y enviar DMs
    ],
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`🤖 Bot listo! Autenticado como: ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    // Ignorar mensajes de otros bots
    if (message.author.bot) return;

    // Verificar si el mensaje es exactamente "LOL SEÑAL" (sin importar mayúsculas/minúsculas)
    if (message.content.toUpperCase() === 'LOL SEÑAL') {
        const guild = message.guild;
        if (!guild) return;

        const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'lol');
        if (!role) {
            return message.reply('❌ No se encontró un rol llamado "lol".');
        }

        try {
            // --- Secuencia de mensajes para dar suspenso ---
            const initialMsg = await message.channel.send('📡 **Detectando señal...**');
            await new Promise(resolve => setTimeout(resolve, 1000));
            await initialMsg.edit('🔍 **Buscando invocadores disponibles...**');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 1. Crear Botones
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('voy_lol')
                        .setLabel('¡VOY! ⚔️')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('no_puedo_lol')
                        .setLabel('No puedo ❌')
                        .setStyle(ButtonStyle.Danger),
                );

            // 2. Crear el Embed Inicial
            let confirmedPlayers = new Set();

            const createEmbed = (players) => {
                const list = players.size > 0
                    ? [...players].map(id => `<@${id}>`).join('\n')
                    : '*Nadie ha confirmado aún...*';

                return new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🚀 ¡LA SEÑAL HA SIDO ACTIVADA!')
                    .setDescription(`**EL EQUIPO TE NECESITA EN LA GRIETA.**\n\n**Invocadores Confirmados:**\n${list}`)
                    .setImage('https://i.imgur.com/AfFp7pu.png')
                    .setTimestamp()
                    .setFooter({ text: 'Protocolo de Emergencia LOL', iconURL: client.user.displayAvatarURL() });
            };

            await initialMsg.delete();

            const mainMsg = await message.channel.send({
                content: `⚠️ **¡ATENCIÓN!** ${role}`,
                embeds: [createEmbed(confirmedPlayers)],
                components: [row]
            });

            // 3. "Llamar" a los participantes e inicio de DMs
            await guild.members.fetch();
            const membersWithRole = role.members.filter(m => !m.user.bot);

            if (membersWithRole.size > 0) {
                const mentions = membersWithRole.map(m => `<@${m.id}>`).join(' ');
                await message.channel.send(`⚔️ **Convocando a los guerreros:** ${mentions}`);

                membersWithRole.forEach(member => {
                    member.send('🔥 **¡LA SEÑAL!** Confirma tu asistencia en el canal del servidor.')
                        .catch(() => { });
                });
            }

            // --- 4. COLECTOR DE BOTONES ---
            const collector = mainMsg.createMessageComponentCollector({ time: 300000 }); // Dura 5 minutos

            collector.on('collect', async i => {
                if (i.customId === 'voy_lol') {
                    confirmedPlayers.add(i.user.id);
                    await i.update({ embeds: [createEmbed(confirmedPlayers)] });
                } else if (i.customId === 'no_puedo_lol') {
                    confirmedPlayers.delete(i.user.id);
                    await i.update({ embeds: [createEmbed(confirmedPlayers)] });
                }
            });

            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('end1').setLabel('Expirado').setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );
                mainMsg.edit({ components: [disabledRow] }).catch(() => { });
            });

        } catch (error) {
            console.error('Error:', error);
            message.reply('Hubo un error al activar la señal.');
        }
    }
});

// Manejo de errores globales para evitar que el bot se detenga
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login con el token desde .env
client.login(process.env.DISCORD_TOKEN);
