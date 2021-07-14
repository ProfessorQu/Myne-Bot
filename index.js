const mineflayer = require("mineflayer");
const pvp = require("mineflayer-pvp").plugin;
const minecraftHawkEye = require("minecrafthawkeye");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const armorManager = require("mineflayer-armor-manager");
const collectBlock = require("mineflayer-collectblock").plugin;

// Create the bot
const bot = mineflayer.createBot({
  host: "localhost",
  port: process.argv[2],
  version: "1.16.5",
  username: "TotallyNotABot",
});

// Load plugins
bot.loadPlugin(pvp);
bot.loadPlugin(minecraftHawkEye);
bot.loadPlugin(pathfinder);
bot.loadPlugin(armorManager);
bot.loadPlugin(collectBlock);

// Set mcData and movements
let mcData;
let movements;

bot.once("spawn", () => {
  mcData = require("minecraft-data")(bot.version);
  movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);
});

let mode = {
  name: undefined,
  target: undefined,
};

function health(username, args) {
  /* Tell what the current health is */
  bot.chat(`My current health is: ${bot.health}`);
  console.log(`Health: ${bot.health}`);
}

function food(username, args) {
  /* Tell what the current food and saturation levels are  */
  bot.chat(`My food is ${bot.food} and my saturation is ${bot.foodSaturation}`);
  console.log(`Food: ${bot.food}\tSaturation: ${bot.foodSaturation}`);
}

function items(username, args) {
  /* List all items in the bots inventory */
  // Get a list of all the display names
  let items = bot.inventory
    .items()
    .map((a) => ` '${a.count} ${a.displayName}'`);

  // Check if we have no items
  if (items.length == 0) {
    bot.chat(`I currently carry with me: nothing`);
    console.log(`Items: None`);
  } else {
    bot.chat(`I currently carry with me: ${items}`);
    console.log(`Items: ${items}`);
  }
}

function drop(username, args) {
  /* Drops an item out of the bot's inventory */
  stop(username, args);

  // Get player
  const player = bot.players[username];
  if (player.entity === undefined) {
    bot.chat(`I can't see you, ${username}`);
    return;
  }

  // Get parameters
  let count = 1;
  if (args.length === 3) count = parseInt(args[2]);

  let type = args[1];

  const itemType = mcData.itemsByName[type];
  if (!itemType) {
    bot.chat(`I don't know any block named ${type}.`);
    return;
  }
  const item = bot.inventory
    .items()
    .find((items) => items.name == itemType.name);

  if (!item) {
    bot.chat(`I don't carry that ${itemType.displayName} with me`);
    return;
  }

  // Go to the player
  come(username, args, false);
  bot.lookAt(player.entity.position);

  // Chat
  bot.chat(`Here, have ${count} ${item.displayName}`);
  console.log(`Threw ${count} ${item.displayName}`);

  bot.toss(item, null, count, (err) => {
    console.log(err);
  });
}

function come(username, args, log = true) {
  /* The bot comes to the user once */
  stop(username, args);

  // Get the player
  const player = bot.players[username];
  if (player.entity === undefined) {
    if (log) bot.chat(`I can't see you, ${username}`);
    return;
  }

  if (log) bot.chat(`I'm coming to you, ${username}`);

  // Get the goal for the player and go to it
  const goal = new goals.GoalFollow(player.entity);
  bot.pathfinder.goto(goal, () => {
    if (log) bot.chat(`I got to ${goal.entity.username}`);
  });
}

function shoot(username, args) {
  /* Shoot the player that issued the command */
  // Test if player exists
  const player = bot.players[username];
  if (player.entity === undefined) {
    bot.chat(`I can't see you, ${username}`);
    return;
  }

  // Get the target and shoot
  const target = bot.hawkEye.getPlayer(username);
  bot.hawkEye.oneShot(target, "bow");
}

function turret(username, args) {
  /* Shoot all mobs close to the bot */
  // Test if player exists
  const player = bot.players[username];
  if (player.entity === undefined) {
    bot.chat(`I can't see you, ${username}`);
    return;
  }

  // Get the target and keep shooting
  const target = bot.hawkEye.getPlayer(username);
}

function mine(username, args) {
  /* Makes the bot mine a certain block type (args[1]) amount (args[2]) */
  stop(username, args);

  // Get parameters
  let count = 1;
  if (args.length === 3) count = parseInt(args[2]);

  let type = args[1];

  const blockType = mcData.blocksByName[type];
  if (!blockType) {
    bot.chat(`I don't know any block named ${type}.`);
    return;
  }

  // Find blocks
  const blocks = bot.findBlocks({
    matching: blockType.id,
    maxDistance: 64,
    count: count,
  });

  if (blocks.length === 0) {
    bot.chat("I see no block nearby.");
    return;
  }

  // Create the list of targets
  const targets = [];
  for (let i = 0; i < Math.min(blocks.length, count); i++) {
    targets.push(bot.blockAt(blocks[i]));
  }

  bot.chat(`I found ${targets.length} ${blockType.displayName}(s).`);
  console.log(`Found ${targets.length} ${blockType.displayName}`);

  bot.collectBlock.collect(targets, (err) => {
    if (err) {
      // An error occurred, report it.
      bot.chat(err.message);
      console.log(err);
    } else {
      // All blocks have been collected.
      bot.chat("Done.");
      console.log(`Done mining ${targets.length} ${blockType.displayName}`);
    }
  });
}

function guard(username, args, log = true) {
  /* Gaurd a certain user */
  stop(username, args);

  // Get the player
  const player = bot.players[username];
  if (player.entity === undefined) {
    if (log) bot.chat(`I can't see you, ${username}`);
    return;
  }

  if (log) bot.chat(`I'm coming to guard you, ${username}`);

  // Set the mode
  mode.name = "guard";
  mode.target = player;

  // Follow the user
  const goal = new goals.GoalFollow(player.entity, 2);
  bot.pathfinder.setGoal(goal, true);
}

function stop(username, args) {
  // Reset the pathfinder and pvp plugins
  bot.pathfinder.setGoal(null);
  bot.pvp.attack(null);

  // Reset mode
  mode.name = undefined;
  mode.target = undefined;
}

bot.on("chat", (username, message) => {
  /* Run the commands when a chat message was send */
  if (username === bot.username) return;

  args = message.split(" ");

  // Choose command
  if (args[0] === "health") {
    health(username, args);
  } else if (args[0] === "food") {
    food(username, args);
  } else if (args[0] === "items") {
    items(username, args);
    /** NOTE: This command doesn't work
   * } else if (args[0] === "drop") {
    drop(username, args); */
  } else if (args[0] === "come") {
    come(username, args);
  } else if (args[0] === "shoot") {
    shoot(username, args);
  } else if (args[0] === "turret") {
    turret(username, args);
  } else if (args[0] === "mine") {
    mine(username, args);
  } else if (args[0] === "guard") {
    guard(username, args);
  } else if (args[0] === "stop") {
    stop(username, args);
  }
});

function equipWeapons() {
  /* Equip weapons */
  const items = bot.inventory.items();

  // Equip shield
  const shield = items.find((items) => items.name === "shield");
  if (shield) bot.equip(shield, "off-hand");

  // Get sword
  const swords = items.filter((items) => items.name.includes("sword"));

  function findSword(name) {
    return swords.find((swords) => swords.name.includes(name));
  }

  const sword_tiers = [
    "wooden",
    "gold",
    "stone",
    "iron",
    "diamond",
    "netherite",
  ];

  let sword;
  for (const sword_tier of sword_tiers) {
    sword = findSword(sword_tier);
  }

  // Test if the bot is not mining or building
  if (!bot.pathfinder.isMining() && !bot.pathfinder.isBuilding() && sword) {
    bot.equip(sword, "hand");
  }
}

bot.on("physicTick", () => {
  // Define mobfilter
  let mobFilter;
  if (mode.name === undefined) {
    mobFilter = (e) =>
      e.type === "mob" && e.position.distanceTo(bot.entity.position) < 8;
  } else if (mode.name === "gaurd") {
    mobFilter = (e) =>
      e.type === "mob" &&
      e.position.distanceTo(mode.target.entity.position) < 8;
  }

  // Get mob
  const mob = bot.nearestEntity(mobFilter);

  if (mob) {
    equipWeapons();
    bot.pvp.attack(mob);
  }
});

bot.on("stoppedAttacking", () => {
  if (mode.name === undefined) {
    return;
  } else if (mode.name === "guard") {
    guard(mode.target.username, [], false);
  }
});
