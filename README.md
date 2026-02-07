# LEGENDS — A Living World Adventure

A turn-based adventure game set in a procedurally generated living world with a complex economy, feudal politics, and emergent events. Built entirely in TypeScript with isometric pixel art rendering.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Controls

| Key               | Action                                             |
| ----------------- | -------------------------------------------------- |
| **W/A/S/D/Q/E**   | Move party (isometric directions: NW/W/SE/E/SW/NE) |
| **Arrow Keys**    | Move party (N/W/S/E)                               |
| **Enter / Space** | End turn (advance world simulation)                |
| **R**             | Rest (heal at settlements, camp in wilderness)     |
| **F**             | Buy food at a settlement                           |
| **C**             | Center camera on party                             |
| **+/-**           | Zoom in/out                                        |
| **P**             | Pause simulation                                   |
| **Mouse Drag**    | Pan camera                                         |
| **Scroll Wheel**  | Zoom                                               |
| **Click**         | Select tile for info                               |

## World Generation

The world is procedurally generated in layers:

1. **Terrain & Elevation** — Simplex noise creates continents, mountains, and ocean basins
2. **Temperature** — Based on latitude and elevation
3. **Moisture** — Noise + proximity to water bodies
4. **Biomes** — Classified from elevation, moisture, and temperature (13 biome types)
5. **Resources** — Placed according to biome suitability
6. **Settlements** — Scored and placed based on resource access, water proximity, and terrain
7. **Roads** — A\* pathfinding connects settlements with paths, roads, and highways
8. **Population** — Families created with jobs, skills, relationships
9. **Creatures** — Wildlife and monsters placed by biome
10. **Politics** — Countries formed, rulers assigned, diplomacy established

## Biomes

Ocean, Beach, Desert, Grassland, Forest, Dense Forest, Jungle, Hills, Mountains, Snow Peaks, Tundra, Swamp, Savanna

## Economy

### Resources

- **Raw**: Wood, Stone, Iron Ore, Gold Ore, Coal, Salt
- **Food**: Wheat, Fish, Berries, Meat, Exotic Fruit, Bread, Ale
- **Materials**: Wool, Herbs, Rare Herbs, Hides
- **Processed**: Lumber, Iron Ingots, Gold Ingots, Fabric, Leather, Tools, Medicine
- **Military**: Weapons, Armor

### Production Chains

Resources flow through production chains: `Iron Ore + Coal → Iron Ingot → Weapons/Tools/Armor`

Each settlement has buildings with workers who produce goods based on available inputs. Worker skill level affects quality and speed. Seasonal effects modify production rates.

### Trade Routes

Settlements with complementary supply/demand automatically establish trade routes. Goods are transported by hauling, cart, horse cart, or ship depending on distance. Routes can be raided by bandits.

### Storage & Spoilage

Resources require appropriate storage (dry, cold, secure). Perishable goods spoil over time. Storage capacity limits how much a settlement can stockpile.

## Characters

Every human in the world is modeled individually:

- **Stats**: Strength, Dexterity, Intelligence, Charisma, Endurance
- **Needs**: Food, Shelter, Safety, Social, Purpose (each 0-100)
- **Personality**: Ambition, Courage, Greed, Loyalty, Kindness, Curiosity
- **Skills**: Job-specific skills that improve with practice
- **Relationships**: Spouse, Parent, Child, Lord, Vassal, Friend, Rival, etc.

### Jobs

Farmer, Miner, Lumberjack, Fisher, Blacksmith, Weaver, Baker, Brewer, Tanner, Merchant, Soldier, Guard, Hunter, Herbalist, Scholar, Priest, Noble, Adventurer

### AI Decision Engine

NPCs make probabilistic decisions each turn based on:

- Current needs (hunger drives food-seeking, low safety drives caution)
- Personality traits (ambitious characters seek advancement, curious ones explore)
- Available options at their location
- Social relationships

All AI weights are configurable in `src/ai/decision-engine.ts`.

## Political System

- **Countries** form around the largest settlements
- **Rulers** govern from capital cities
- **Lords** control individual settlements as vassals
- **Diplomacy**: Alliances, rivalries, trade agreements, wars, and truces
- **Wars** can break out between rival nations
- **Peace treaties** end prolonged conflicts

## Creatures & Events

### Creatures

- **Wildlife**: Wolves, Bears, Deer, Sheep, Boars
- **Dragons**: Named legendary creatures that migrate, hoard treasure, and attack settlements
- **Bandits**: Outlaws that raid trade routes and prey on travelers

### Emergent Events

- Dragon attacks on settlements
- Bandit raids on poorly defended villages
- War declarations between rival nations
- Plagues in dense populations
- Famines during harsh winters
- Bountiful harvests in autumn
- Monster migrations during seasonal changes
- Births, deaths, and marriages

## Settlement Growth

Settlements evolve: `Homestead → Hamlet → Village → Town → City`

Growth depends on food surplus, prosperity, trade activity, and happiness. Settlements can also decline from famine, attacks, or low morale.

## Architecture

The codebase is organized into small, focused modules:

```
src/
├── types/        # TypeScript type definitions (13 files)
├── utils/        # Seeded RNG, Simplex noise, math, pathfinding
├── data/         # Static definitions: biomes, resources, recipes, names, creatures, items
├── world/        # Procedural generation: terrain, moisture, biomes, resources, settlements, roads, politics
├── entities/     # Character factory and population
├── economy/      # Production, trade, storage
├── ai/           # NPC decision engine, creature AI, world events
├── game/         # Game engine, turn manager
├── render/       # Isometric renderer, camera, pixel art sprites
├── ui/           # Input handling, HUD
└── main.ts       # Entry point
```

## Extending

The game is designed for easy extension:

- **New biomes**: Add to `src/types/biome.ts` and `src/data/biome-data.ts`
- **New resources**: Add to `src/data/resource-data.ts`
- **New recipes**: Add to `src/data/production-data.ts`
- **New creatures**: Add to `src/data/creature-data.ts`
- **New items**: Add to `src/data/item-data.ts`
- **New buildings**: Add to `src/types/location.ts`
- **AI behaviors**: Modify weights in `src/ai/decision-engine.ts`

## Tech Stack

- **TypeScript** — Strict mode, ES2022 target
- **Vite** — Fast development server and bundling
- **Canvas 2D** — Pixel-perfect isometric rendering
- **Zero dependencies** — No runtime libraries needed
