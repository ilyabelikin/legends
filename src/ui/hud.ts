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

  /** Scroll offset for event log (0 = bottom / newest) */
  private logScrollOffset = 0;
  /** Total wrapped lines last frame (for clamping scroll) */
  private logTotalLines = 0;
  /** Cached log panel bounds for hit testing */
  private logBounds = { x: 0, y: 0, w: 0, h: 0 };

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

  /**
   * Handle scroll wheel. Returns true if the cursor is over the log panel
   * (consumed — don't zoom the map).
   */
  handleScroll(screenX: number, screenY: number, deltaY: number): boolean {
    const b = this.logBounds;
    if (screenX >= b.x && screenX <= b.x + b.w &&
        screenY >= b.y && screenY <= b.y + b.h) {
      // Scroll up = positive offset (older entries), scroll down = toward newest
      this.logScrollOffset += deltaY > 0 ? -2 : 2;
      this.logScrollOffset = Math.max(0, Math.min(this.logScrollOffset, Math.max(0, this.logTotalLines - 5)));
      return true;
    }
    return false;
  }

  /** Reset scroll to bottom (newest) when new entries arrive */
  resetLogScroll(): void {
    this.logScrollOffset = 0;
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
    const logWidth = 480;
    const logHeight = 140;
    const logX = 8;
    const logY = this.height - logHeight - 50;
    const textX = logX + 8;
    const maxTextW = logWidth - 16;
    const lineHeight = 13;

    // Background
    ctx.fillStyle = 'rgba(10,10,20,0.8)';
    ctx.fillRect(logX, logY, logWidth, logHeight);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(logX, logY, logWidth, logHeight);

    this.logHitAreas = [];
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';

    // Pre-render entries into wrapped lines, then take only what fits
    const allLines: {
      text: string;
      color: string;
      locName?: string;
      locNameX?: number;
      locNameW?: number;
      locationId?: string;
    }[] = [];

    const entries = state.eventLog; // wrap all, then slice with scroll

    for (const entry of entries) {
      const prefix = `[${entry.turn}] `;
      const fullText = prefix + entry.message;
      const color = getLogColor(entry.type);

      // Location info for this entry
      const loc = entry.locationId ? state.world.locations.get(entry.locationId) : null;
      const locName = loc?.name;

      // Word-wrap the full text
      const wrapped = wrapText(ctx, fullText, maxTextW);

      for (let li = 0; li < wrapped.length; li++) {
        const line = wrapped[li];
        // Check if the location name falls on this line
        let nameOnLine: string | undefined;
        let locationId: string | undefined;
        if (locName && line.includes(locName)) {
          nameOnLine = locName;
          locationId = entry.locationId!;
        }
        allLines.push({ text: line, color, locName: nameOnLine, locationId });
      }
    }

    // Store total for scroll clamping, and cache panel bounds
    this.logTotalLines = allLines.length;
    this.logBounds = { x: logX, y: logY, w: logWidth, h: logHeight };

    // Clamp scroll offset
    const maxLines = Math.floor((logHeight - 12) / lineHeight);
    this.logScrollOffset = Math.max(0, Math.min(this.logScrollOffset, Math.max(0, allLines.length - maxLines)));

    // Slice with scroll: offset 0 = newest at bottom
    const endIdx = allLines.length - this.logScrollOffset;
    const startIdx = Math.max(0, endIdx - maxLines);
    const visibleLines = allLines.slice(startIdx, endIdx);

    let y = logY + 12;
    for (const line of visibleLines) {
      if (line.locName && line.locationId) {
        // Render with highlighted location name
        const nameIdx = line.text.indexOf(line.locName);
        const before = line.text.slice(0, nameIdx);
        const after = line.text.slice(nameIdx + line.locName.length);

        // Before
        ctx.fillStyle = line.color;
        ctx.fillText(before, textX, y);
        const beforeW = ctx.measureText(before).width;

        // Location name — highlighted + underlined
        ctx.fillStyle = PALETTE.uiHighlight;
        ctx.fillText(line.locName, textX + beforeW, y);
        const nameW = ctx.measureText(line.locName).width;
        ctx.fillRect(textX + beforeW, y + 2, nameW, 1);

        this.logHitAreas.push({
          x: textX + beforeW,
          y: y - lineHeight + 2,
          w: nameW,
          h: lineHeight,
          locationId: line.locationId,
        });

        // After
        ctx.fillStyle = line.color;
        ctx.fillText(after, textX + beforeW + nameW, y);
      } else {
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, textX, y);
      }

      y += lineHeight;
    }

    // Scroll indicators
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    if (this.logScrollOffset > 0) {
      ctx.fillStyle = PALETTE.uiHighlight;
      ctx.fillText('▼ newer', logX + logWidth - 8, logY + logHeight - 4);
    }
    if (startIdx > 0) {
      ctx.fillStyle = PALETTE.uiHighlight;
      ctx.fillText('▲ older', logX + logWidth - 8, logY + 10);
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
    if (this.engine.canEmbark()) {
      hints.push('B: Board Boat');
    }
    if (state.party.isSailing) {
      hints.push('(Sailing)');
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

/** Word-wrap a string to fit within maxWidth pixels */
function wrapText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = '  ' + word; // indent continuation lines
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
