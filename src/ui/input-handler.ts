import type { GameEngine } from "../game/game-engine";
import type { Renderer } from "../render/renderer";
import type { HUD } from "./hud";
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT } from "../render/camera";

/**
 * Handles all player input: keyboard, mouse, and touch.
 *
 * Controls:
 *   WASD / Arrows    — pan camera
 *   Left-click       — select tile (inspect)
 *   Right-click      — move party toward that tile
 *   Scroll wheel     — zoom
 *   Middle-drag      — pan camera
 *   Space / Enter    — end turn
 *   R                — rest
 *   F                — buy food
 *   C                — center on party
 *   +/-              — zoom
 */
export class InputHandler {
  private engine: GameEngine;
  private renderer: Renderer;
  private canvas: HTMLCanvasElement;

  private hud: HUD | null = null;

  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private dragDistance = 0; // track drag distance to distinguish click vs drag
  private keysDown = new Set<string>();

  constructor(
    engine: GameEngine,
    renderer: Renderer,
    canvas: HTMLCanvasElement,
  ) {
    this.engine = engine;
    this.renderer = renderer;
    this.canvas = canvas;

    this.setupEventListeners();
  }

  /** Give the input handler a reference to the HUD for click-through */
  setHUD(hud: HUD): void {
    this.hud = hud;
  }

  private setupEventListeners(): void {
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.onKeyUp(e));

    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e), {
      passive: false,
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.canvas.addEventListener("touchstart", (e) => this.onTouchStart(e));
    this.canvas.addEventListener("touchmove", (e) => this.onTouchMove(e), {
      passive: false,
    });
    this.canvas.addEventListener("touchend", () => this.onTouchEnd());
  }

  // ── Keyboard ──────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent): void {
    console.log(`[InputHandler] Key pressed: "${e.key}"`);
    this.keysDown.add(e.key.toLowerCase());
    const state = this.engine.state;
    if (!state || state.gameOver) {
      console.log(`[InputHandler] No state or game over, ignoring key`);
      return;
    }

    // Toggle inventory panel (always allowed)
    if (e.key === "i" || e.key === "I") {
      if (this.hud) {
        this.hud.openInventoryTab("inventory");
      }
      return;
    }

    // Open inventory to Market tab (always allowed)
    if (e.key === "m" || e.key === "M") {
      if (this.hud) {
        this.hud.openInventoryTab("market");
      }
      return;
    }

    // Close inventory with Escape
    if (e.key === "Escape" && this.hud?.isInventoryOpen()) {
      this.hud.toggleInventory();
      return;
    }

    // Block all other input when inventory is open
    if (this.hud?.isInventoryOpen()) {
      return;
    }

    switch (e.key) {
      // End turn
      case "Enter":
      case " ":
        console.log(`[InputHandler] Space/Enter detected, calling endTurn()`);
        e.preventDefault();
        this.engine.cancelMovement();
        this.engine.endTurn();
        break;

      // Center camera on party
      case "c":
      case "C":
        this.renderer.camera.centerOnTile(
          state.party.position.x,
          state.party.position.y,
        );
        break;

      // Rest
      case "r":
      case "R":
        this.engine.cancelMovement();
        this.engine.rest();
        break;

      // Hunt wild game
      case "h":
      case "H":
        this.engine.cancelMovement();
        this.engine.hunt();
        break;

      // Escape — cancel movement
      case "Escape":
        this.engine.cancelMovement();
        state.selectedTile = null;
        break;

      // Zoom
      case "+":
      case "=":
        this.renderer.camera.zoomAt(
          1.2,
          this.renderer.camera.screenWidth / 2,
          this.renderer.camera.screenHeight / 2,
        );
        break;
      case "-":
      case "_":
        this.renderer.camera.zoomAt(
          0.8,
          this.renderer.camera.screenWidth / 2,
          this.renderer.camera.screenHeight / 2,
        );
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.key.toLowerCase());
  }

  // ── Mouse ─────────────────────────────────────────────

  private onMouseDown(e: MouseEvent): void {
    // Any button can start a pan (we distinguish on mouseUp)
    this.isPanning = true;
    this.dragDistance = 0;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);

      // Only pan with middle-button drag or if enough distance on any button
      if (e.buttons === 4 || this.dragDistance > 6) {
        this.renderer.camera.pan(dx, dy);
      }
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    const wasDrag = this.dragDistance > 6;
    this.isPanning = false;

    if (wasDrag) return; // it was a camera pan, not a click

    const state = this.engine.state;
    if (!state) return;

    // Let inventory handle clicks when open
    if (this.hud?.isInventoryOpen()) {
      if (
        e.button === 0 &&
        this.hud?.handleInventoryClick(e.clientX, e.clientY)
      ) {
        return;
      }
      // Block other clicks when inventory is open
      return;
    }

    // Let the HUD handle clicks on log entries first
    if (e.button === 0 && this.hud?.handleClick(e.clientX, e.clientY, state)) {
      return;
    }

    // Minimap click → center camera on that point
    const mmTile = this.renderer.handleMinimapClick(
      e.clientX,
      e.clientY,
      state.world.width,
      state.world.height,
    );
    if (mmTile) {
      this.renderer.camera.centerOnTile(mmTile.tx, mmTile.ty);
      return;
    }

    const tile = this.pickTile(e.clientX, e.clientY);
    if (!tile) return;

    if (e.button === 0) {
      state.selectedTile = { x: tile.x, y: tile.y };
    } else if (e.button === 2) {
      this.engine.cancelMovement();
      this.engine.movePartyToward(tile.x, tile.y);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    // Let HUD handle scroll if cursor is over the event log
    if (this.hud?.handleScroll(e.clientX, e.clientY, e.deltaY)) return;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.renderer.camera.zoomAt(factor, e.clientX, e.clientY);
  }

  // ── Touch ─────────────────────────────────────────────

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isPanning = true;
      this.dragDistance = 0;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (this.isPanning && e.touches.length === 1) {
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.renderer.camera.pan(dx, dy);
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }
  }

  private onTouchEnd(): void {
    this.isPanning = false;
  }

  // ── Tile Picking (elevation-corrected) ────────────────

  /**
   * Convert a screen position to the tile the user is pointing at,
   * accounting for elevation offset in the isometric view.
   * With discrete elevation levels, we can directly calculate the correct tile.
   */
  private pickTile(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } | null {
    const state = this.engine.state;
    if (!state) return null;

    const cam = this.renderer.camera;
    const { wx, wy } = cam.screenToWorld(screenX, screenY);

    // First pass — flat isometric conversion
    let tx = Math.round((wx / (TILE_WIDTH / 2) + wy / (TILE_HEIGHT / 2)) / 2);
    let ty = Math.round((wy / (TILE_HEIGHT / 2) - wx / (TILE_WIDTH / 2)) / 2);

    // Clamp to world bounds
    tx = Math.max(0, Math.min(state.world.width - 1, tx));
    ty = Math.max(0, Math.min(state.world.height - 1, ty));

    // Single refinement to account for elevation (discrete levels make this reliable)
    const tile = state.world.tiles[ty][tx];
    const elevOffset = tile.elevation * ELEVATION_HEIGHT;
    const corrWy = wy + elevOffset;
    const cx = Math.round(
      (wx / (TILE_WIDTH / 2) + corrWy / (TILE_HEIGHT / 2)) / 2,
    );
    const cy = Math.round(
      (corrWy / (TILE_HEIGHT / 2) - wx / (TILE_WIDTH / 2)) / 2,
    );

    tx = Math.max(0, Math.min(state.world.width - 1, cx));
    ty = Math.max(0, Math.min(state.world.height - 1, cy));

    return { x: tx, y: ty };
  }

  // ── Continuous Camera Pan (called every frame) ────────

  /** Smooth WASD / Arrow camera panning */
  update(): void {
    // Block camera panning when inventory is open
    if (this.hud?.isInventoryOpen()) {
      return;
    }

    const speed = 40;

    let dx = 0;
    let dy = 0;

    // WASD and arrow keys both pan the camera
    if (this.keysDown.has("a") || this.keysDown.has("arrowleft")) dx += speed;
    if (this.keysDown.has("d") || this.keysDown.has("arrowright")) dx -= speed;
    if (this.keysDown.has("w") || this.keysDown.has("arrowup")) dy += speed;
    if (this.keysDown.has("s") || this.keysDown.has("arrowdown")) dy -= speed;

    if (dx !== 0 || dy !== 0) {
      this.renderer.camera.pan(dx, dy);
    }
  }
}
