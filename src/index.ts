export * from "./discordProxy.js";
export * from "./agent.js";

// import * as Discord             from "discord.js";
// import { createDiscordProxy }   from "./discordProxy.js";

// import {
//     createProxyServer,
//     createHttpProxyAgent,
//     setHttpGlobalAgent
// } from "./agent.js";

// process.on("uncaughtException"  , console.error);
// process.on("unhandledRejection" , console.error);

// createDiscordProxy({
//     authorizationMapping: new Map([
//         [ "Blendship:1225194127126171838", "MTIyNTE5NDEyNzEyNjE3MTgzOA.Ghnlk1.uvJDqW3_kiieINwvuAi0BAAyQDoZ0awKm8alHg" ],
//     ]),
//     listeners: [
//         {
//             host: "127.0.0.1",
//             port: 7212,
//         },
//     ],
// });

// createProxyServer({
//     proxyConnectionUri: "socks://animeoProxy:AnimeoTroJoli2024@38.242.212.177",
//     // proxyConnectionUri: "socks://pepo:1337pepo@162.55.188.65",
//     listeners: [
//         {
//             port: 3983,
//             host: "127.0.0.1",
//         }
//     ],
// });

// setHttpGlobalAgent(
//     createHttpProxyAgent({
//         host    : "127.0.0.1",
//         port    : 3983,
//         noDelay : true,
//         timeout : 10_000
//     })
// );

// const client = new Discord.Client({
//     intents: [ "Guilds" ],
//     rest: {
//         api     : "http://127.0.0.1:7212",
//         // agent   : Agent.undiciProxyAgent,
//     },
// });

// client.login("Blendship:1225194127126171838");
