import { SimulationEngine } from './core/SimulationEngine';
import { GameLoop } from './core/GameLoop';
import { Renderer } from './rendering/Renderer';
import { Controls } from './ui/Controls';
import { DEFAULT_CONFIG } from './core/SimulationConfig';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const controlsContainer = document.getElementById('controls') as HTMLDivElement;

const engine = new SimulationEngine(DEFAULT_CONFIG);
const renderer = new Renderer(canvas);
const gameLoop = new GameLoop(engine, renderer);

new Controls(controlsContainer, gameLoop, renderer);

// Initial render
renderer.configure(engine.grid);
renderer.render(engine.grid, engine.entities, engine.foods, 0);
