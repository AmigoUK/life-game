# Hex Life Simulation

An evolutionary life simulation on a hexagonal grid, built with TypeScript and HTML5 Canvas.

## Overview

Entities with DNA-encoded traits live on a hex grid, seeking food, reproducing, fighting, and evolving over generations. Watch natural selection shape populations in real time.

## Features

- **Hexagonal grid** with configurable radius (8-24)
- **Genetic system** — 16-gene DNA encoding traits: speed, aggression, vision, attack, defense, energy efficiency, cooperation, food storage capacity, color hue, and more
- **Reproduction** — crossover + mutation with heritable mutation resistance
- **Combat** — aggressive same-sex encounters with attack/defense rolls
- **Food ecosystem** — consumable food with respawn timers and pulsating visuals
- **Visual differentiation**:
  - Males (blue triangles up) vs Females (red-orange triangles down)
  - Energy borders: white = healthy, yellow = hungry
  - Aggression spikes on aggressive entities
  - Opacity reflects age
  - DNA hue creates visible genetic family lineages
  - Tribe membership shown with colored dots
- **Seasons** — cyclical spring/summer/autumn/winter system with configurable season length:
  - Spring spawns bonus food; winter freezes food respawn timers
  - Females limited to one birth per season
  - Entities store surplus food (evolvable storage capacity gene) and consume reserves in winter with metabolic efficiency cost
  - Season-colored HUD indicator and sparkline background bands
- **Tribes & cooperation** — cooperative entities form tribes with football team names (Real Madrid, Barcelona, Liverpool, etc.), share food, and defend each other in combat
- **Canvas legend** — bottom-left overlay explaining all visual elements
- **Analytics panel** with collapsible sections:
  - Population breakdown (M/F, births/deaths per tick, death causes)
  - Gene pool bars showing average trait values with genetic diversity index
  - Real-time sparkline chart with Y-axis scale labels, colored legend, and season background bands
  - Hall of Fame — top 3 most successful entities ranked by age + offspring score
  - Tribe Ranking — tribes sorted by score with kill/food-sharing stats
  - Seasonal Stats — winter survival rate, births/starvation by season, average food storage
- **Entity inspector** — click any entity to see detailed stats with descriptive gene labels and one-line explanations
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
    Tribe.ts          # Tribe registry, football team names, membership lifecycle
    Seasons.ts        # Deterministic season cycle manager (spring/summer/autumn/winter)
    SimulationEngine.ts  # Core tick loop: aging, movement, eating, combat, reproduction, tribes, seasons
    GameLoop.ts       # RAF loop, tick timing, renderer orchestration
    Analytics.ts      # Statistics, history, gene tracking, Hall of Fame, tribe ranking
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
