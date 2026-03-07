# Hex Life Simulation

An evolutionary life simulation on a hexagonal grid, built with TypeScript and HTML5 Canvas.

## Overview

Entities with DNA-encoded traits live on a hex grid, seeking food, reproducing, fighting, and evolving over generations. Watch natural selection shape populations in real time.

## Features

- **Hexagonal grid** with configurable radius (8-24)
- **Genetic system** — 16-gene DNA encoding traits: speed, aggression, vision, attack, defense, energy efficiency, size, color hue, and more
- **Reproduction** — crossover + mutation with heritable mutation resistance
- **Combat** — aggressive same-sex encounters with attack/defense rolls
- **Food ecosystem** — consumable food with respawn timers and pulsating visuals
- **Visual differentiation**:
  - Males (blue triangles up) vs Females (red-orange triangles down)
  - Energy borders: white = healthy, yellow = hungry
  - Aggression spikes on aggressive entities
  - Size reflects energy, opacity reflects age
  - DNA hue creates visible genetic family lineages
- **Canvas legend** — bottom-left overlay explaining all visual elements
- **Analytics panel** with collapsible sections:
  - Population breakdown (M/F, births/deaths per tick, death causes)
  - Gene pool bars showing average trait values with genetic diversity index
  - Real-time sparkline chart (population history, last 200 ticks)
- **Animated effects** — floating skull, heart, and sword icons for deaths, births, and combat

## Tech Stack

- TypeScript (ES2022)
- Vite (dev server + bundler)
- HTML5 Canvas (zero dependencies)

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Controls

- **Start/Stop** — toggle simulation (or press Space)
- **Speed slider** — adjust tick interval (50-1000ms)
- **Grid Radius** — select grid size (resets simulation)
- **Reset** — restart with fresh population

## Project Structure

```
src/
  core/
    types.ts          # Shared interfaces (EntityState, FoodState, HexCoord)
    constants.ts      # Simulation parameters
    HexGrid.ts        # Hex coordinate math and grid operations
    DNA.ts            # Gene encoding, crossover, mutation
    Entity.ts         # Entity factory
    Food.ts           # Food creation, consumption, respawn
    SimulationEngine.ts  # Core tick loop: aging, movement, eating, combat, reproduction
    GameLoop.ts       # RAF loop, tick timing, renderer orchestration
    Analytics.ts      # Statistics collection, history buffer, gene tracking
  rendering/
    Renderer.ts       # Main renderer orchestrating sub-renderers
    HexRenderer.ts    # Grid drawing with cached ImageData
    EntityRenderer.ts # Entity triangles with color, borders, aggression spikes
    FoodRenderer.ts   # Food circles with pulsation and respawn preview
    EffectsRenderer.ts  # Floating emoji effects (death, birth, combat)
    UIOverlay.ts      # HUD stats + visual legend
  ui/
    Controls.ts       # DOM control panel with analytics sections and sparkline
  main.ts             # Entry point
```

## License

MIT
