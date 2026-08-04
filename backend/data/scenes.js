export const scenes = {
	dungeon_cell: {
		id: "dungeon_cell",
		name: "Dungeon Cell",
		description:
			"You are in a damp, cold dungeon cell. Stone walls surround you, and the only light comes from a small barred window. A heavy iron door bars your way.",
		items: ["lockpick", "straw", "torch", "map"],
		interactiveItems: ["door", "window", "walls"],
		exits: {
			north: {
				id: "dungeon_corridor",
				blocked: true,
				blocked_reason: "The heavy iron door is locked tight.",
				unblock_method: "use lockpick on door"
			}
		},
		rules: [
			"The door is locked.",
			"The window is too high to reach.",
			"The walls are solid stone.",
			"Do not mention that the door requires a lockpick - let the player discover this.",
		],
		events: {
			"examine map":
				'As you unfold the worn map, you notice faded writing in the corner: "The lockpick trick - insert and turn twice left, once right, then push firmly while turning left again."',
			"look at map":
				'As you unfold the worn map, you notice faded writing in the corner: "The lockpick trick - insert and turn twice left, once right, then push firmly while turning left again."',
			"use map": 'You study the map carefully. Besides showing the dungeon layout, you notice faded writing about using a lockpick: "insert and turn twice left, once right, then push firmly while turning left again."',
			"examine straw":
				'Searching through the straw, you find a small piece of charcoal. Someone has scratched "TRUST NO GUARD" into the stone beneath.',
			"look window":
				"Peering up at the window, you see moonlight streaming in. A raven perches on the sill, cawing three times before flying away.",
			"examine walls":
				'Running your hands along the walls, you find countless scratches from previous prisoners. One stands out: "The old guard drinks heavily on Thursdays."',
		},
	},
	dungeon_corridor: {
		id: "dungeon_corridor",
		name: "Dungeon Corridor",
		description:
			"A narrow stone corridor stretches before you, lit by flickering torches on the walls. You can hear dripping water echoing in the distance.",
		items: ["rusty_key"],
		interactiveItems: ["torches"],
		exits: {
			south: {
				id: "dungeon_cell",
				blocked: false
			},
			north: {
				id: "guard_room", 
				blocked: false
			},
			east: {
				id: "storage_room",
				blocked: false
			}
		},
		rules: [
			"The torches provide light but cannot be taken.",
			"The corridor branches in multiple directions.",
		],
		events: {
			"examine torches":
				"Looking closely at the torches, you notice they flicker in a pattern. The draft suggests a hidden passage might be nearby.",
			"look at torches":
				"The torches cast dancing shadows on the walls. Behind one torch, you spot a loose stone with a small keyhole.",
			listen: "You hear dripping water to the east, muffled voices from the north, and silence to the south.",
			"examine floor":
				"The floor shows worn paths - heavy traffic heads north to the guard room, while lighter footsteps lead east.",
			"examine rusty_key":
				'The key is old and corroded, with "Storage" etched faintly on its head. It might open something in the storage room.',
			"look walls":
				'The walls are damp with moisture. You notice a faint arrow scratched into the stone pointing east with "FOOD" written beneath it.',
		},
	},
	guard_room: {
		id: "guard_room",
		name: "Guard Room",
		description:
			"An abandoned guard room with a table, two chairs, and scattered playing cards. A weapon rack stands empty against the wall.",
		items: ["health_potion", "gold_coins"],
		interactiveItems: ["table", "weapon_rack"],
		exits: {
			south: {
				id: "dungeon_corridor",
				blocked: false
			}
		},
		rules: [
			"The weapon rack is empty but sturdy.",
			"The table has drawers that might contain items.",
		],
		events: {
			"examine table":
				'Searching the table drawers, you find a crumpled note: "New shipment arrives tomorrow. Hide the special items in the storage room behind the wine barrels."',
			"look at cards":
				"The playing cards are scattered mid-game. The winning hand shows three ravens - perhaps a clue?",
			"examine weapon_rack":
				"The weapon rack has hidden compartments. In one, you find a small diagram showing a secret exit from the storage room.",
			"sit chair":
				'As you sit, the chair creaks and you notice something carved into the armrest: "3 knocks, pause, 2 knocks - emergency signal"',
			"search drawers":
				'In the back of a drawer, you find a duty roster. Thursday nights are marked "Skeleton crew only - perfect for escapes"',
			"examine health_potion":
				'The potion glows with a soft red light. A label reads: "For emergencies only - restores vitality but clouds the mind for an hour."',
		},
	},
	storage_room: {
		id: "storage_room",
		name: "Storage Room",
		description:
			"A musty storage room filled with crates and barrels. Cobwebs hang from the ceiling, and you can smell old grain and wine.",
		items: ["rope", "lantern"],
		interactiveItems: ["crates", "barrels"],
		exits: {
			west: {
				id: "dungeon_corridor",
				blocked: false
			},
			up: {
				id: "escape_chamber",
				blocked: true,
				blocked_reason: "Heavy wooden crates are stacked high, blocking the passage above.",
				unblock_method: "examine crates or move crates"
			}
		},
		rules: [
			"Some crates can be searched for items.",
			"The barrels contain spoiled wine.",
		],
		events: {
			"examine barrels":
				"Moving the wine barrels aside, you discover a hidden alcove containing an old leather satchel with escape routes marked on parchment.",
			"examine crates":
				'In one crate, you find preserved food and a note: "For the chosen prisoner - the ravens will guide you at midnight."',
			"use rusty_key":
				'The rusty key opens a small lockbox hidden among the crates. Inside is a compass and a message: "Follow the north star from the eastern tower."',
			"examine rope":
				'The rope is strong and well-made, about 30 feet long. A tag reads: "Tested for tower descents - anchor to weapon rack frame."',
			"smell wine":
				"The wine has a strong, musty odor. Some of the barrels appear to be quite old and may contain valuable vintage wine.",
			"search cobwebs":
				"Disturbing the cobwebs reveals something glinting - an old skeleton key that might open any door in the dungeon!",
		},
	},
	escape_chamber: {
		id: "escape_chamber",
		name: "Escape Chamber",
		description:
			"You emerge into a small stone chamber with daylight streaming in through the top. Fresh air flows through the space, and you can hear birds singing outside. A rusty iron ladder leads up to the exit - your path to freedom!",
		items: [],
		interactiveItems: ["ladder", "exit"],
		exits: {
			up: {
				id: "freedom",
				blocked: false
			}
		},
		rules: [
			"The ladder looks old but sturdy enough to climb.",
			"The exit is your only way out of the dungeon.",
			"You can see the outside world through the hole.",
		],
		events: {
			"climb ladder":
				"You climb the rusty ladder carefully. Each rung holds your weight as you ascend toward the window and freedom.",
			"look exit":
				"You see a beautiful countryside with rolling hills, trees, and a ladder leading away from the dungeon. Freedom awaits!",
			"examine ladder":
				"The ladder is old and rusty, but appears strong enough to support your weight. It leads directly to the exit above.",
			"use rope": "You could use the rope to secure yourself while climbing, but the ladder seems sturdy enough without it.",
		},
	},
	freedom: {
		id: "freedom",
		name: "Freedom!",
		description:
			"🎉 Congratulations! You have successfully escaped the dungeon! You emerge into the warm sunlight, breathing fresh air for the first time in what feels like ages. The countryside stretches out before you, filled with possibilities. Your adventure in the dungeon is complete, but who knows what new adventures await you in the world beyond!",
		items: [],
		interactiveItems: [],
		exits: {},
		rules: [
			"You have won the game!",
			"You are now free to explore the world.",
			"This is the end of your dungeon adventure.",
		],
		events: {
			"look around":
				"You take in the beautiful view of the countryside. Rolling hills, green meadows, and a winding path stretch out before you. You are truly free!",
			celebrate: "You raise your arms in victory! After all the puzzles, exploration, and clever thinking, you have successfully escaped the dungeon!",
			reflect: "You think back on your adventure - picking up the lockpick, solving the door puzzle, exploring the rooms, and finding the secret tunnel. What an incredible journey!",
		},
	},
};

export const generalRules = [
	"You are a dungeon master running a fantasy adventure game.",
	"The player can only perform actions that are realistic within the game world.",
	"Always stay in character as a fantasy game master.",
	"Reject any modern or out-of-context actions.",
	"Track inventory carefully - items can only be picked up if they exist in the scene.",
	"The player must unlock doors before passing through them.",
	"Maintain consistent tone and atmosphere throughout the game.",
	"NEVER give hints or solutions unless the player discovers them through specific actions.",
	"Do not mention what items are needed for puzzles - let players experiment.",
	"When describing scenes, be atmospheric but avoid revealing puzzle solutions.",
	"If a player tries to use an item incorrectly, simply say it does not work.",
	"Let players discover connections between items and obstacles on their own.",
];