import type { GameState, EventLogEntry } from '../types/game';
import type { GameEngine } from '../game/game-engine';
import type { Renderer } from '../render/renderer';
import { PALETTE } from '../render/palette';

/** A clickable region in the event log */
interface LogHitArea {
  x: number;
  y: number;
  w: number;
  h: number;
  locationId: string;
}

/**
 * Heads-Up Display — renders UI overlays on the game canvas.
 * Includes HUD bar, event log, tile info panel, and status displays.
 */
export class HUD {
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;
  private renderer: Renderer | null = null;
  private width = 0;
  private height = 0;

  /** Clickable log entry regions rebuilt every frame */
  private logHitAreas: LogHitArea[] = [];

  constructor(ctx: CanvasRenderingContext2D, engine: GameEngine) {
    this.ctx = ctx;
    this.engine = engine;
  }

  /** Give the HUD a reference to the renderer so it can move the camera */
  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  /** Render all HUD elements */
  render(state: GameState, screenWidth: number, screenHeight: number): void {
    this.width = screenWidth;
    this.height = screenHeight;

    this.renderTopBar(state);
    this.renderEventLog(state);
    this.renderBottomBar(state);
    this.renderTileInfo(state);
    this.renderPartyStatus(state);
  }

  /**
   * Handle a left-click at screen coordinates.
   * Returns true if the click hit a log entry (consumed).
   */
  handleClick(screenX: number, screenY: number, state: GameState): boolean {
    for (const area of this.logHitAreas) {
      if (
        screenX >= area.x && screenX <= area.x + area.w &&
        screenY >= area.y && screenY <= area.y + area.h
      ) {
        const loc = state.world.locations.get(area.locationId);
        if (loc && this.renderer) {
          this.renderer.camera.centerOnTile(loc.position.x, loc.position.y);
          state.selectedTile = { x: loc.position.x, y: loc.position.y };
        }
        return true;
      }
    }
    return false;
  }

  // ── Top Bar ─────────────────────────────────────────────

  private renderTopBar(state: GameState): void {
    const ctx = this.ctx;
    const barHeight = 32;

    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(0, 0, this.width - 180, barHeight);
    ctx.fillStyle = PALETTE.uiBorder;
    ctx.fillRect(0, barHeight, this.width - 180, 1);

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(this.engine.getDateString(), 12, 20);

    const weatherLabels: Record<string, string> = {
      clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain',
      storm: 'Storm', snow: 'Snow', fog: 'Fog',
      heatwave: 'Heat', blizzard: 'Blizzard',
    };
    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.fillText(`Weather: ${weatherLabels[state.weather] ?? state.weather}`, 300, 20);

    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText(`Turn ${state.turn}`, 480, 20);

    const popCount = Array.from(state.world.characters.values()).filter(c => c.isAlive).length;
    const locCount = Array.from(state.world.locations.values()).filter(l => !l.isDestroyed).length;
    ctx.fillText(`Pop: ${popCount} | Settlements: ${locCount}`, 570, 20);
  }

  // ── Event Log ───────────────────────────────────────────

  private renderEventLog(state: GameState): void {
    const ctx = this.ctx;
    const logWidth = 400;
    const logHeight = 180;
    const logX = 8;
    const logY = this.height - logHeight - 50;

    // Background
    ctx.fillStyle = 'rgba(10,10,20,0.8)';
    ctx.fillRect(logX, logY, logWidth, logHeight);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(logX, logY, logWidth, logHeight);

    // Title
    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('EVENT LOG', logX + 8, logY + 14);

    // Rebuild hit areas
    this.logHitAreas = [];

    const entries = state.eventLog.slice(-12);
    const lineHeight = 13;
    let y = logY + 28;

    for (const entry of entries) {
      ctx.font = '9px monospace';
      const prefix = `[${entry.turn}] `;
      const msg = entry.message;
      const maxChars = 54;
      const fullText = prefix + msg;
      const displayText = fullText.length > maxChars ? fullText.slice(0, maxChars) + '...' : fullText;

      // Find the location name inside the message so we can highlight just that part
      const loc = entry.locationId ? state.world.locations.get(entry.locationId) : null;
      const locName = loc?.name;
      const nameIdx = locName ? msg.indexOf(locName) : -1;

      if (locName && nameIdx >= 0) {
        // Split into: prefix + before-name + NAME + after-name
        const before = prefix + msg.slice(0, nameIdx);
        const after = msg.slice(nameIdx + locName.length);

        // Truncate: we need to check total length
        const totalLen = before.length + locName.length + after.length;
        const trimAfter = totalLen > maxChars
          ? after.slice(0, Math.max(0, maxChars - before.length - locName.length)) + '...'
          : after;

        const textX = logX + 8;

        // Draw "before" in normal color
        ctx.fillStyle = getLogColor(entry.type);
        ctx.fillText(before, textX, y);
        const beforeW = ctx.measureText(before).width;

        // Draw location name in bright color + underline
        ctx.fillStyle = PALETTE.uiHighlight;
        ctx.fillText(locName, textX + beforeW, y);
        const nameW = ctx.measureText(locName).width;
        ctx.fillRect(textX + beforeW, y + 2, nameW, 1);

        // Register hit area just for the name
        this.logHitAreas.push({
          x: textX + beforeW,
          y: y - lineHeight + 2,
          w: nameW,
          h: lineHeight,
          locationId: entry.locationId!,
        });

        // Draw "after" in normal color
        ctx.fillStyle = getLogColor(entry.type);
        ctx.fillText(trimAfter, textX + beforeW + nameW, y);
      } else {
        // No location — render as plain text
        ctx.fillStyle = getLogColor(entry.type);
        ctx.fillText(displayText, logX + 8, y);
      }

      y += lineHeight;
    }
  }

  // ── Bottom Bar ──────────────────────────────────────────

  private renderBottomBar(state: GameState): void {
    const ctx = this.ctx;
    const barHeight = 40;
    const barY = this.height - barHeight;

    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(0, barY, this.width, barHeight);
    ctx.fillStyle = PALETTE.uiBorder;
    ctx.fillRect(0, barY, this.width, 1);

    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // Build contextual action hints
    const hints = ['WASD: Pan', 'Right-click: Move', 'SPACE: End Turn', 'R: Rest'];
    if (this.engine.canBuyFood()) {
      hints.push('F: Buy Food');
    }
    hints.push('Scroll: Zoom', 'C: Center');

    ctx.fillStyle = '#8a8070';
    ctx.fillText(hints.join(' | '), this.width / 2, barY + 15);

    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.textAlign = 'left';
    ctx.fillText(
      `Actions: ${state.party.actionPoints}/${state.party.maxActionPoints}`,
      12, barY + 30,
    );

    ctx.fillText(`Gold: ${state.party.gold}`, 200, barY + 30);

    const leader = state.party.members[0];
    if (leader) {
      const pct = leader.health / leader.maxHealth;
      ctx.fillStyle = pct > 0.6 ? PALETTE.uiSafe : pct > 0.3 ? PALETTE.uiHighlight : PALETTE.uiDanger;
      ctx.fillText(`HP: ${Math.round(leader.health)}/${leader.maxHealth}`, 320, barY + 30);
    }

    const tile = state.world.tiles[state.party.position.y]?.[state.party.position.x];
    if (tile?.locationId) {
      const loc = state.world.locations.get(tile.locationId);
      if (loc && !loc.isDestroyed) {
        ctx.fillStyle = PALETTE.uiHighlight;
        ctx.textAlign = 'right';
        ctx.fillText(`At: ${loc.name} (${loc.type})`, this.width - 12, barY + 30);
      }
    }
  }

  // ── Tile Info Panel ─────────────────────────────────────

  private renderTileInfo(state: GameState): void {
    if (!state.selectedTile) return;
    const ctx = this.ctx;
    const info = this.engine.getTileInfo(state.selectedTile.x, state.selectedTile.y);
    if (info.length === 0) return;

    const panelWidth = 220;
    const panelHeight = info.length * 16 + 24;
    const panelX = this.width - panelWidth - 12;
    const panelY = 180;

    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TILE INFO', panelX + 8, panelY + 14);

    let y = panelY + 30;
    for (const line of info) {
      ctx.fillStyle = PALETTE.uiText;
      ctx.font = '9px monospace';
      ctx.fillText(line, panelX + 8, y);
      y += 16;
    }
  }

  // ── Party Status Panel ──────────────────────────────────

  private renderPartyStatus(state: GameState): void {
    const ctx = this.ctx;
    const leader = state.party.members[0];
    if (!leader) return;

    const panelX = 8;
    const panelY = 40;
    const panelWidth = 180;
    const panelHeight = 100;

    ctx.fillStyle = 'rgba(10,10,20,0.8)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(leader.name, panelX + 8, panelY + 14);

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = '9px monospace';
    ctx.fillText('Level: Adventurer', panelX + 8, panelY + 28);
    ctx.fillText(`STR:${leader.stats.strength} DEX:${leader.stats.dexterity} INT:${leader.stats.intelligence}`, panelX + 8, panelY + 42);
    ctx.fillText(`CHR:${leader.stats.charisma} END:${leader.stats.endurance}`, panelX + 8, panelY + 56);

    const barX = panelX + 8;
    const barY = panelY + 64;
    const barW = panelWidth - 16;
    const barH = 8;
    const pct = leader.health / leader.maxHealth;

    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = pct > 0.6 ? PALETTE.uiSafe : pct > 0.3 ? PALETTE.uiHighlight : PALETTE.uiDanger;
    ctx.fillRect(barX, barY, barW * pct, barH);

    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText(`Combat: ${leader.skills['combat'] ?? 0} | Survival: ${leader.skills['survival'] ?? 0}`, panelX + 8, panelY + 88);
  }
}

// ── Helpers ──────────────────────────────────────────────

function getLogColor(type: EventLogEntry['type']): string {
  switch (type) {
    case 'combat': return '#c04040';
    case 'trade': return '#3080b0';
    case 'political': return '#8030a0';
    case 'discovery': return '#30a030';
    case 'danger': return '#c07030';
    case 'social': return '#c080c0';
    case 'system': return '#808070';
    default: return '#908878';
  }
}

/** Brighter version for clickable entries */
function getLogColorBright(type: EventLogEntry['type']): string {
  switch (type) {
    case 'combat': return '#f06060';
    case 'trade': return '#50c0f0';
    case 'political': return '#c050e0';
    case 'discovery': return '#50e050';
    case 'danger': return '#f0a050';
    case 'social': return '#f0b0f0';
    case 'system': return '#c0b8a8';
    default: return PALETTE.uiText;
  }
}
