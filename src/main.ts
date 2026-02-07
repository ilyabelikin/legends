import { GameEngine } from './game/game-engine';
import { Renderer } from './render/renderer';
import { InputHandler } from './ui/input-handler';
import { HUD } from './ui/hud';

/**
 * LEGENDS — A Living World Adventure
 *
 * Main entry point. Sets up the game engine, renderer, input handling,
 * and runs the game loop.
 */

// === Initialization ===
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const loadingScreen = document.getElementById('loading-screen') as HTMLDivElement;
const loadingBar = document.getElementById('loading-bar') as HTMLDivElement;

// Create engine and renderer
const engine = new GameEngine();
const renderer = new Renderer(canvas);
const hud = new HUD(canvas.getContext('2d')!, engine);
hud.setRenderer(renderer);

// Resize canvas to fill viewport
function handleResize(): void {
  renderer.resize();
}
window.addEventListener('resize', handleResize);
handleResize();

// === Loading Screen ===
function updateLoadingBar(phase: string, progress: number): void {
  loadingBar.style.width = `${Math.round(progress * 100)}%`;
  const label = loadingScreen.querySelector('p');
  if (label) label.textContent = phase;
}

// === Start Game ===
async function startGame(): Promise<void> {
  // Generate world with progress updates
  const seed = Math.floor(Math.random() * 999999999);

  // Use setTimeout to allow DOM updates during generation
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      engine.newGame({ seed, width: 128, height: 128 }, updateLoadingBar);
      resolve();
    }, 50);
  });

  // Center camera on player start position
  renderer.camera.centerOnTile(
    engine.state.party.position.x,
    engine.state.party.position.y,
  );
  // Set camera immediately (skip smooth animation)
  renderer.camera.x = renderer.camera.targetX;
  renderer.camera.y = renderer.camera.targetY;

  // Fade out loading screen
  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 500);

  // Set up input handling
  const input = new InputHandler(engine, renderer, canvas);
  input.setHUD(hud);

  // === Game Loop ===
  let lastTime = performance.now();
  let stepTimer = 0;
  const STEP_INTERVAL = 0.12; // seconds between each path step

  function gameLoop(currentTime: number): void {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Update input (continuous key handling)
    input.update();

    // Advance queued party movement one step at a time
    if (engine.state.party.queuedPath.length > 0) {
      stepTimer += deltaTime;
      if (stepTimer >= STEP_INTERVAL) {
        stepTimer = 0;
        engine.tickPartyMovement();
      }
    } else {
      stepTimer = 0;
    }

    // Render
    renderer.render(engine.state, deltaTime);

    // Render HUD on top
    const ctx = canvas.getContext('2d')!;
    hud.render(engine.state, renderer.camera.screenWidth, renderer.camera.screenHeight);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

// Start with a small delay to ensure DOM is ready
startGame().catch(console.error);
