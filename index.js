require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, REST, Routes, ActivityType } = require('discord.js');

// Khởi tạo client với các quyền (Intents) cần thiết
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

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
    }
];

// Hàm tự động tìm kênh chào mừng thích hợp
function findWelcomeChannel(guild) {
    // 1. Ưu tiên kênh hệ thống (System Channel) nếu bot có quyền gửi tin nhắn
    const systemChannel = guild.systemChannel;
    if (systemChannel && systemChannel.permissionsFor(guild.members.me).has('SendMessages')) {
        return systemChannel;
    }

    // 2. Tìm kiếm trong danh sách kênh dựa trên các từ khóa phổ biến
    const keywords = ['welcome', 'chào-mừng', 'general', 'chat-chung', 'luật-lệ', 'rules', 'tán-gẫu', 'discussion', 'lobby'];
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    
    for (const keyword of keywords) {
        const found = textChannels.find(c => c.name.toLowerCase().includes(keyword) && c.permissionsFor(guild.members.me).has('SendMessages'));
        if (found) return found;
    }

    // 3. Nếu không tìm thấy, lấy kênh văn bản đầu tiên mà bot có quyền gửi tin nhắn
    return textChannels.find(c => c.permissionsFor(guild.members.me).has('SendMessages'));
}

// Khi bot sẵn sàng hoạt động
client.once('clientReady', async () => {
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
                    { name: '`/help`', value: '📖 Xem lại bảng hướng dẫn này.' }
                )
                .setFooter({ text: 'Phiên bản cải tiến bởi Antigravity' })
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed] });
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
    console.error('❌ LỖI: Vui lòng cấu hình DISCORD_TOKEN chính xác trong file .env trước khi chạy bot!');
    process.exit(1);
}

client.login(token);