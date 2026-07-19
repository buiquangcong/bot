require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, REST, Routes, ActivityType, Events, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus } = require('@discordjs/voice');
const play = require('play-dl');

// Khởi tạo client với các quyền (Intents) cần thiết
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Bộ lưu trữ kết nối âm thanh và đầu phát nhạc
const voiceConnections = new Map();

// Định nghĩa danh sách Slash Commands
const commands = [
    {
        name: 'ping',
        description: 'Kiểm tra độ trễ của bot 🚀',
    },
    {
        name: 'serverinfo',
        description: 'Xem thông tin chi tiết về server này 📊',
    },
    {
        name: 'userinfo',
        description: 'Xem thông tin chi tiết về một thành viên 👤',
        options: [
            {
                name: 'target',
                type: 6, // USER type
                description: 'Thành viên muốn xem (để trống để xem bản thân)',
                required: false
            }
        ]
    },
    {
        name: 'help',
        description: 'Hiển thị danh sách các lệnh hỗ trợ 📖',
    },
    {
        name: 'play',
        description: 'Phát nhạc từ link YouTube vào phòng thoại của bạn 🎵',
        options: [
            {
                name: 'url',
                type: 3, // STRING type
                description: 'Liên kết YouTube (video) để phát',
                required: true
            }
        ]
    },
    {
        name: 'stop',
        description: 'Dừng phát nhạc và rời khỏi phòng thoại ⏹️',
    },
    {
        name: 'ban',
        description: 'Trục xuất (Ban) thành viên ra khỏi server 🚫',
        options: [
            {
                name: 'target',
                type: 6, // USER type
                description: 'Thành viên muốn trục xuất',
                required: true
            },
            {
                name: 'reason',
                type: 3, // STRING type
                description: 'Lý do trục xuất',
                required: false
            }
        ]
    }
];

// Hàm tự động tìm kênh chào mừng thích hợp
function findWelcomeChannel(guild) {
    // 1. Ưu tiên kênh hệ thống (System Channel) nếu bot có quyền gửi tin nhắn
    const systemChannel = guild.systemChannel;
    if (systemChannel && systemChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
        return systemChannel;
    }

    // 2. Tìm kiếm trong danh sách kênh dựa trên các từ khóa phổ biến
    const keywords = ['welcome', 'chào-mừng', 'general', 'chat-chung', 'luật-lệ', 'rules', 'tán-gẫu', 'discussion', 'lobby'];
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    
    for (const keyword of keywords) {
        const found = textChannels.find(c => c.name.toLowerCase().includes(keyword) && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
        if (found) return found;
    }

    // 3. Nếu không tìm thấy, lấy kênh văn bản đầu tiên mà bot có quyền gửi tin nhắn
    return textChannels.find(c => c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
}

// Khi bot sẵn sàng hoạt động
client.once(Events.ClientReady, async () => {
    console.log(`🤖 Bot ${client.user.tag} đã online và sẵn sàng hoạt động!`);
    
    // Thiết lập trạng thái hoạt động xịn sò
    client.user.setActivity('thành viên mới 🌟', { type: ActivityType.Watching });

    // Đăng ký Slash Commands tự động lên Discord API
    const token = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;
    if (!token || token === 'YOUR_DISCORD_BOT_TOKEN_HERE' || token === '') {
        console.warn('⚠️ CẢNH BÁO: Chưa cấu hình Discord Bot Token hợp lệ trong file .env!');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('🔄 Đang đăng ký các lệnh Slash (Slash Commands)...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Đã đăng ký thành công các lệnh Slash toàn hệ thống!');
    } catch (error) {
        console.error('❌ Lỗi khi đăng ký lệnh Slash:', error);
    }
});

// Sự kiện khi có người mới tham gia server
client.on('guildMemberAdd', async member => {
    console.log(`👤 Thành viên mới tham gia: ${member.user.tag}`);
    
    // Tự động nhận diện kênh chào mừng thích hợp
    const channel = findWelcomeChannel(member.guild);
    if (!channel) {
        console.log(`⚠️ Không tìm được kênh văn bản hợp lệ để gửi lời chào tại server: ${member.guild.name}`);
        return;
    }

    console.log(`🎯 Tự động nhận diện kênh chào mừng: #${channel.name} (${channel.id})`);

    // Tạo Embed lời chào cực kỳ xịn sò
    const embed = new EmbedBuilder()
        .setColor('#9B59B6') // Màu tím premium
        .setTitle('🎉 CHÀO MỪNG THÀNH VIÊN MỚI! 🎉')
        .setDescription(`Chào mừng <@${member.id}> đã gia nhập **${member.guild.name}**! Chúc bạn có những giây phút vui vẻ cùng chúng mình nhé. ❤️`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: '👤 Tên tài khoản', value: `\`${member.user.tag}\``, inline: true },
            { name: '📆 Ngày tạo tài khoản', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F> (<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>)`, inline: true },
            { name: '🔢 Bạn là thành viên thứ', value: `**#${member.guild.memberCount}**`, inline: false }
        )
        .setFooter({ text: `Server: ${member.guild.name}`, iconURL: member.guild.iconURL() })
        .setTimestamp();

    try {
        await channel.send({ content: `Chào mừng <@${member.id}>!`, embeds: [embed] });
        console.log(`✅ Đã gửi tin nhắn chào mừng đến kênh #${channel.name}`);
    } catch (error) {
        console.error('❌ Gặp lỗi khi gửi tin nhắn chào mừng:', error);
    }
});

// Xử lý các Slash Commands khi người dùng gọi lệnh
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'ping') {
            const sent = await interaction.reply({ content: '⚡ Đang đo độ trễ...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            const apiLatency = Math.round(client.ws.ping);
            
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🚀 Kết quả kiểm tra độ trễ (Ping)')
                .addFields(
                    { name: '🤖 Bot Latency', value: `\`${latency}ms\``, inline: true },
                    { name: '💻 API Latency', value: `\`${apiLatency}ms\``, inline: true }
                )
                .setTimestamp();
                
            await interaction.editReply({ content: null, embeds: [embed] });
        }
        
        else if (commandName === 'serverinfo') {
            const { guild } = interaction;
            const memberCount = guild.memberCount;
            const owner = await guild.fetchOwner();
            
            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle(`📊 Thông tin Server: ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: '👑 Chủ sở hữu', value: `${owner.user.tag} (<@${owner.id}>)`, inline: true },
                    { name: '📅 Ngày tạo', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: true },
                    { name: '👥 Tổng thành viên', value: `**${memberCount}** thành viên`, inline: true },
                    { name: '💬 Số kênh', value: `**${guild.channels.cache.size}** kênh`, inline: true },
                    { name: '🌟 Cấp độ Boost', value: `Cấp ${guild.premiumTier} (${guild.premiumSubscriptionCount} Boosts)`, inline: true }
                )
                .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
                .setTimestamp();
                
            if (guild.bannerURL()) {
                embed.setImage(guild.bannerURL({ size: 1024 }));
            }
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'userinfo') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`👤 Thông tin thành viên: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                .addFields(
                    { name: '🏷️ Định danh (Tag/ID)', value: `Tag: \`${targetUser.tag}\`\nID: \`${targetUser.id}\``, inline: true },
                    { name: '📅 Ngày tạo tài khoản', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`, inline: true }
                )
                .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
                .setTimestamp();
                
            if (member) {
                embed.addFields(
                    { name: '📥 Ngày gia nhập Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: true },
                    { name: '🎭 Vai trò (Roles)', value: member.roles.cache.filter(r => r.name !== '@everyone').map(r => `<@&${r.id}>`).join(' ') || 'Không có', inline: false }
                );
            }
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setColor('#E67E22')
                .setTitle('📖 Danh sách Lệnh Hỗ Trợ')
                .setDescription('Dưới đây là danh sách các lệnh Slash khả dụng:')
                .addFields(
                    { name: '`/ping`', value: '⚡ Xem độ phản hồi của bot.' },
                    { name: '`/serverinfo`', value: '📊 Hiển thị thông tin chi tiết về Server này.' },
                    { name: '`/userinfo [thành_viên]`', value: '👤 Xem chi tiết thông tin và ngày tham gia của thành viên.' },
                    { name: '`/play [link_youtube]`', value: '🎵 Tham gia kênh voice và phát nhạc từ YouTube.' },
                    { name: '`/stop`', value: '⏹️ Dừng nhạc và rời kênh voice.' },
                    { name: '`/ban [thành_viên] [lý_do]`', value: '🚫 Trục xuất một thành viên ra khỏi server.' },
                    { name: '`/help`', value: '📖 Xem lại bảng hướng dẫn này.' }
                )
                .setFooter({ text: 'Phiên bản cải tiến bởi Antigravity' })
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'play') {
            const url = interaction.options.getString('url');
            const voiceChannel = interaction.member.voice.channel;

            if (!voiceChannel) {
                return interaction.reply({ content: '❌ Bạn phải tham gia một phòng thoại trước!', ephemeral: true });
            }

            const ytValidate = await play.yt_validate(url);
            if (!ytValidate || ytValidate !== 'video') {
                return interaction.reply({ content: '❌ Vui lòng cung cấp một liên kết video YouTube hợp lệ!', ephemeral: true });
            }

            await interaction.deferReply();

            try {
                // Tham gia kênh thoại
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });

                // Lấy stream âm thanh từ YouTube
                const stream = await play.stream(url);
                const resource = createAudioResource(stream.stream, {
                    inputType: stream.type
                });

                // Khởi tạo player
                const player = createAudioPlayer();
                player.play(resource);
                connection.subscribe(player);

                // Lấy thông tin video cơ bản
                const videoInfo = await play.video_basic_info(url);
                const videoTitle = videoInfo.video_details.title;
                const videoDuration = videoInfo.video_details.durationRaw;
                const videoThumbnail = videoInfo.video_details.thumbnails[0]?.url;

                // Lưu connection và player vào map
                voiceConnections.set(interaction.guildId, { connection, player });

                // Xử lý khi connection bị ngắt hoặc hủy
                connection.on(VoiceConnectionStatus.Disconnected, () => {
                    player.stop();
                    connection.destroy();
                    voiceConnections.delete(interaction.guildId);
                });

                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎵 Đang phát nhạc từ YouTube')
                    .setDescription(`**[${videoTitle}](${url})**`)
                    .setThumbnail(videoThumbnail)
                    .addFields(
                        { name: '⏱️ Thời lượng', value: `\`${videoDuration}\``, inline: true },
                        { name: '🎤 Kênh thoại', value: `<#${voiceChannel.id}>`, inline: true }
                    )
                    .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('❌ Lỗi khi phát nhạc:', error);
                await interaction.editReply({ content: '❌ Gặp lỗi trong quá trình kết nối hoặc lấy stream từ YouTube!' });
            }
        }

        else if (commandName === 'stop') {
            const activeConn = voiceConnections.get(interaction.guildId);
            if (!activeConn) {
                return interaction.reply({ content: '❌ Bot hiện không phát nhạc hoặc không ở trong kênh thoại nào!', ephemeral: true });
            }

            try {
                activeConn.player.stop();
                activeConn.connection.destroy();
                voiceConnections.delete(interaction.guildId);
                await interaction.reply({ content: '⏹️ Đã dừng phát nhạc và rời khỏi kênh thoại!' });
            } catch (error) {
                console.error('❌ Lỗi khi dừng phát nhạc:', error);
                await interaction.reply({ content: '❌ Có lỗi xảy ra khi dừng phát nhạc!', ephemeral: true });
            }
        }

        else if (commandName === 'ban') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({ content: '❌ Bạn không có quyền trục xuất thành viên!', ephemeral: true });
            }

            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({ content: '❌ Bot không có quyền trục xuất thành viên trong server này! Vui lòng cấp quyền cho bot.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') || 'Không có lý do.';

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (targetMember) {
                if (!targetMember.bannable) {
                    return interaction.reply({ content: '❌ Không thể trục xuất thành viên này! Có thể họ có vai trò (Role) cao hơn bot.', ephemeral: true });
                }
            }

            await interaction.deferReply();

            try {
                await interaction.guild.members.ban(targetUser.id, { reason });
                
                const embed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🚫 Trục xuất thành viên thành công')
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 Thành viên', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
                        { name: '🛡️ Người thực hiện', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                        { name: '📝 Lý do', value: `\`${reason}\``, inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('❌ Lỗi khi thực hiện lệnh ban:', error);
                await interaction.editReply({ content: '❌ Gặp lỗi khi cố gắng ban thành viên này!' });
            }
        }
    } catch (error) {
        console.error(`❌ Lỗi khi xử lý lệnh ${commandName}:`, error);
        const errorMessage = { content: '❌ Đã xảy ra lỗi khi thực thi lệnh này!', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Đăng nhập bot bằng Token từ file .env
const token = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;
if (!token || token === 'YOUR_DISCORD_BOT_TOKEN_HERE' || token === '') {
    console.error('❌ LỖI: Vui lòng cấu hình DISCORD_TOKEN trong file .env (hoặc Environment Variables của Railway) trước khi chạy bot!');
    process.exit(1);
}

client.login(token);