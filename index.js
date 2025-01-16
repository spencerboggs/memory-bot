/**
 * @fileoverview Memory Bot
 * Copyright (c) 2025 Spencer Boggs
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } = require("discord.js");
const fs = require("fs");
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const memoryFilePath = './shortTermMemory.json';
const shortTermMemory = {};
const MEMORY_LIMIT = 1000;

client.slashCommands = new Collection();
const slashCommands = [];
const commandSlashFiles = fs.readdirSync('./src/slash-commands').filter(file => file.endsWith(".js"));

for (const file of commandSlashFiles) {
    const command = require(`./src/slash-commands/${file}`);

    if (!command.data || !command.data.name) {
        console.error(`Command file ${file} is missing a valid 'data' property with 'name'.`);
        continue;
    }

    client.slashCommands.set(command.data.name, command);
    slashCommands.push(command.data.toJSON());
}

client.once("ready", async () => {
    console.clear();
    console.log("\x1b[1mMemory Bot IS ONLINE!\x1b[0m\n");

    client.user.setPresence({
        activities: [{ name: `Destiny 2`, type: ActivityType.Playing }],
        status: 'dnd'
    });

    const today = new Date();
    const date = today.toISOString().split("T")[0];
    const time = today.toTimeString().split(" ")[0];
    console.log(`Online since: ${date} at ${time}\n`);

    console.log(`Current Server Count: ${client.guilds.cache.size}`);
    client.guilds.cache.forEach(guild => {
        console.log(` - ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
    });

    const clientId = process.env.CLIENT_ID;
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    (async () => {
        try {
            console.log("\x1b[32mRegistering Slash Commands...\x1b[0m");
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: slashCommands }
            );
            console.log(`Registered ${data.length} slash commands.`);
        } catch (error) {
            console.error("Failed to register slash commands:", error);
        }
    })();
});

client.on("interactionCreate", async interaction => {
    if (interaction.isCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        if (!command) return;

        if (!shortTermMemory[interaction.user.id]) {
            shortTermMemory[interaction.user.id] = [];
        }

        shortTermMemory[interaction.user.id].push({
            username: interaction.user.username,
            userId: interaction.user.id,
            timestamp: new Date().toISOString(),
            message: sanitizeMessage(interaction.commandName),
            server: interaction.guild ? interaction.guild.name : 'DM',
            channel: interaction.channel.name
        });

        shortTermMemory[interaction.user.id].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        saveMemoryToFile();

        try {
            await command.execute(client, interaction);
        } catch (err) {
            console.error("Error executing command:", err);
            await interaction.reply({ content: `An error occurred: ${err.message}`, ephemeral: true });
        }
    }
});

client.on("messageCreate", async message => {
    if (message.author.bot) return;

    if (!shortTermMemory[message.author.id]) {
        shortTermMemory[message.author.id] = [];
    }

    const messageData = {
        username: message.author.username,
        userId: message.author.id,
        timestamp: new Date().toISOString(),
        message: sanitizeMessage(message.content),
        server: message.guild ? message.guild.name : 'DM',
        channel: message.channel.name
    };

    shortTermMemory[message.author.id].push(messageData);

    shortTermMemory[message.author.id].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    saveMemoryToFile();

    if (shortTermMemory[message.author.id].length > MEMORY_LIMIT) {
        shortTermMemory[message.author.id].shift();
    }

    const commands = JSON.parse(fs.readFileSync(path.resolve('./src/commands.json')));
    if (commands[message.content.toLowerCase()]) {
        message.channel.send(commands[message.content.toLowerCase()].res);
    }
});

function sanitizeMessage(message) {
    return message.replace(/[^\x00-\x7F]/g, '');
}

function saveMemoryToFile() {
    const memoryData = Object.values(shortTermMemory).flat();
    memoryData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    fs.writeFileSync(memoryFilePath, JSON.stringify(memoryData, null, 2), 'utf8');
}

client.login(process.env.TOKEN);
