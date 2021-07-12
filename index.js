const mineflayer = require("mineflayer");
const pvp = require("mineflayer-pvp").plugin;
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const armorManager = require("mineflayer-armor-manager");
const collectBlock = require("mineflayer-collectblock").plugin;

const bot = mineflayer.createBot({
  host: "localhost",
  port: 49627,
  version: "1.16.5",
  username: "TotallyNotABot",
});

bot.loadPlugin(pvp);
bot.loadPlugin(pathfinder);
bot.loadPlugin(armorManager);
bot.loadPlugin(collectBlock);

let mcData;
let movements;
bot.once("spawn", () => {
  mcData = require("minecraft-data")(bot.version);
  movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);
});

bot.on("chat", (username, message) => {
  args = message.split(" ");

  if (args[0] === "health") {
    bot.chat(`Mine own current health is: ${bot.health}`);
  } else if (args[0] === "food") {
    bot.chat(
      `Mine own food is ${bot.food} and mine own saturation is ${bot.foodSaturation}`
    );
  } else if (args[0] === "items") {
    let items = bot.inventory
      .items()
      .map((a) => ` '${a.count} ${a.displayName}'`);

    if (items.length == 0) {
      bot.chat(`I currently carryeth with me: nothing`);
    } else {
      bot.chat(`I currently carryeth with me: ${items}`);
    }
  } else if (args[0] === "come") {
    const player = bot.players[username];
    if (player.entity === undefined) {
      bot.chat(`I can't seeth thee, ${username}`);
      return;
    }

    bot.chat(`I'm coming to thee, ${username}`);

    const goal = new goals.GoalFollow(player.entity);
    bot.pathfinder.goto(goal, () => {
      bot.chat(`I did get to ${goal.entity.username}`);
    });
  } else if (args[0] === "mine") {
    let count = 1;
    if (args.length === 3) count = parseInt(args[2]);

    let type = args[1];

    const blockType = mcData.blocksByName[type];
    if (!blockType) {
      bot.chat(`I don't know any blocks named ${type}.`);
      return;
    }

    const blocks = bot.findBlocks({
      matching: blockType.id,
      maxDistance: 64,
      count: count,
    });

    if (blocks.length === 0) {
      bot.chat("I don't see that block nearby.");
      return;
    }

    const targets = [];
    for (let i = 0; i < Math.min(blocks.length, count); i++) {
      targets.push(bot.blockAt(blocks[i]));
    }

    bot.chat(`Found ${targets.length} ${type}(s)`);

    bot.collectBlock.collect(targets, (err) => {
      if (err) {
        // An error occurred, report it.
        bot.chat(err.message);
        console.log(err);
      } else {
        // All blocks have been collected.
        bot.chat("Done");
      }
    });
  }
});
