import type { GameState, EventLogEntry } from '../types/game';
import type { GameEngine } from '../game/game-engine';
import type { Renderer } from '../render/renderer';
import type { Location } from '../types/location';
import { PALETTE } from '../render/palette';
import { getItemSprite } from '../render/sprites/item-sprites';

/** A clickable region in the event log */
interface LogHitArea {
  x: number;
  y: number;
  w: number;
  h: number;
  locationId: string;
}

/** A clickable sell button in inventory */
interface SellButtonArea {
  x: number;
  y: number;
  w: number;
  h: number;
  itemIndex: number;
}

/** A clickable buy button in market */
interface BuyButtonArea {
  x: number;
  y: number;
  w: number;
  h: number;
  resourceId: string;
  storageIndex: number;
}

/** The clickable end turn button */
interface TurnButtonArea {
  x: number;
  y: number;
  w: number;
  h: number;
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
  /** Whether to show the inventory panel */
  private showInventory = false;
  /** Clickable sell button regions in inventory */
  private sellButtonAreas: SellButtonArea[] = [];
  /** Clickable buy button regions in market */
  private buyButtonAreas: BuyButtonArea[] = [];
  /** Current inventory tab: 'inventory' or 'market' */
  private inventoryTab: 'inventory' | 'market' = 'inventory';
  /** Clickable end turn button area */
  private turnButtonArea: TurnButtonArea | null = null;

  constructor(ctx: CanvasRenderingContext2D, engine: GameEngine) {
    this.ctx = ctx;
    this.engine = engine;
  }

  /** Give the HUD a reference to the renderer so it can move the camera */
  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  /** Toggle inventory panel visibility */
  toggleInventory(tab?: 'inventory' | 'market'): void {
    const wasOpen = this.showInventory;
    this.showInventory = !this.showInventory;
    
    // If opening or tab is specified, set the tab
    if (this.showInventory && tab) {
      this.inventoryTab = tab;
    } else if (!wasOpen && !tab) {
      // Default to inventory tab when opening without specifying
      this.inventoryTab = 'inventory';
    }
  }

  /** Open inventory to a specific tab, or close if already on that tab */
  openInventoryTab(tab: 'inventory' | 'market'): void {
    if (this.showInventory && this.inventoryTab === tab) {
      // Already open on this tab, close it
      this.showInventory = false;
    } else {
      // Either closed, or open on different tab - switch to this tab
      this.showInventory = true;
      this.inventoryTab = tab;
    }
  }

  /** Check if inventory is currently shown (blocks input) */
  isInventoryOpen(): boolean {
    return this.showInventory;
  }

  /** Handle click on inventory sell/buy buttons and tabs */
  handleInventoryClick(screenX: number, screenY: number): boolean {
    if (!this.showInventory) return false;
    
    // Check tab clicks (basic tab switching areas)
    const state = this.engine.state;
    const tile = state.world.tiles[state.party.position.y]?.[state.party.position.x];
    const loc = tile?.locationId ? state.world.locations.get(tile.locationId) : null;
    const atMarket = loc && !loc.isDestroyed && loc.buildings.some(b => b.isOperational && b.type === 'market');
    
    if (atMarket) {
      const margin = 80;
      const panelX = margin;
      const panelY = margin;
      
      // Inventory tab area
      if (screenX >= panelX + 20 && screenX <= panelX + 120 && screenY >= panelY + 100 && screenY <= panelY + 120) {
        this.inventoryTab = 'inventory';
        return true;
      }
      // Market tab area
      if (screenX >= panelX + 130 && screenX <= panelX + 230 && screenY >= panelY + 100 && screenY <= panelY + 120) {
        this.inventoryTab = 'market';
        return true;
      }
    }
    
    // Check sell button clicks
    for (const area of this.sellButtonAreas) {
      if (
        screenX >= area.x && screenX <= area.x + area.w &&
        screenY >= area.y && screenY <= area.y + area.h
      ) {
        this.engine.sellInventoryItem(area.itemIndex);
        return true;
      }
    }
    
    // Check buy button clicks
    for (const area of this.buyButtonAreas) {
      if (
        screenX >= area.x && screenX <= area.x + area.w &&
        screenY >= area.y && screenY <= area.y + area.h
      ) {
        this.engine.buyMarketItem(area.resourceId, area.storageIndex);
        return true;
      }
    }
    
    return false;
  }

  /** Render all HUD elements */
  render(state: GameState, screenWidth: number, screenHeight: number): void {
    this.width = screenWidth;
    this.height = screenHeight;

    this.renderTopBar(state);
    this.renderEndTurnButton(state);
    this.renderEventLog(state);
    this.renderBottomBar(state);
    this.renderTileInfo(state);
    this.renderPartyStatus(state);
    if (this.showInventory) {
      this.renderInventory(state);
    }
  }

  /**
   * Handle a left-click at screen coordinates.
   * Returns true if the click hit a log entry (consumed).
   */
  handleClick(screenX: number, screenY: number, state: GameState): boolean {
    // Check turn button first
    if (this.turnButtonArea) {
      const btn = this.turnButtonArea;
      if (screenX >= btn.x && screenX <= btn.x + btn.w &&
          screenY >= btn.y && screenY <= btn.y + btn.h) {
        this.engine.endTurn();
        return true;
      }
    }

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

  // ── End Turn Button ─────────────────────────────────────

  private renderEndTurnButton(state: GameState): void {
    const ctx = this.ctx;
    const buttonWidth = 140;
    const buttonHeight = 70;
    const buttonX = this.width - buttonWidth - 12;
    const barHeight = 24; // bottom bar height (updated to match new smaller bar)
    const buttonY = this.height - barHeight - buttonHeight - 8; // 8px padding above bottom bar

    const noAP = state.party.actionPoints === 0;
    
    // Blinking effect when no action points
    let opacity = 1.0;
    if (noAP) {
      const blinkSpeed = 3; // blinks per second
      opacity = 0.7 + 0.3 * Math.sin(Date.now() * blinkSpeed * Math.PI / 1000);
    }

    // Button background (always green, but blinks when no AP)
    ctx.globalAlpha = opacity;
    ctx.fillStyle = 'rgba(80, 140, 80, 0.9)';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#60b060';
    ctx.lineWidth = 2;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.globalAlpha = 1.0;

    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('END TURN', buttonX + buttonWidth / 2, buttonY + 22);
    
    // Turn number
    ctx.font = '10px monospace';
    ctx.fillStyle = '#b0a090';
    ctx.fillText(`Turn ${state.turn}`, buttonX + buttonWidth / 2, buttonY + 38);
    
    // Action points
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = PALETTE.uiHighlight;
    const apText = `AP: ${state.party.actionPoints}/${state.party.maxActionPoints}`;
    ctx.fillText(apText, buttonX + buttonWidth / 2, buttonY + 56);

    // Store click area
    this.turnButtonArea = {
      x: buttonX,
      y: buttonY,
      w: buttonWidth,
      h: buttonHeight
    };
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
    const barHeight = 24;
    const barY = this.height - barHeight;

    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(0, barY, this.width, barHeight);
    ctx.fillStyle = PALETTE.uiBorder;
    ctx.fillRect(0, barY, this.width, 1);

    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // Build contextual action hints
    const hints = ['WASD: Pan', 'Right-click: Move', 'SPACE: End Turn', 'R: Rest', 'I: Inventory'];
    if (this.engine.isAtMarket()) {
      hints.push('M: Market');
    }
    if (this.engine.canHunt()) {
      hints.push('H: Hunt');
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

  // ── Inventory Panel ─────────────────────────────────────

  private renderInventory(state: GameState): void {
    const { party } = state;
    const ctx = this.ctx;
    
    // Clear sell/buy button areas
    this.sellButtonAreas = [];
    this.buyButtonAreas = [];
    
    // Check if at marketplace
    const tile = state.world.tiles[party.position.y]?.[party.position.x];
    const loc = tile?.locationId ? state.world.locations.get(tile.locationId) : null;
    const atMarket = loc && !loc.isDestroyed && loc.buildings.some(b => b.isOperational && b.type === 'market');
    
    // Full-screen overlay
    const margin = 80;
    const panelWidth = this.width - margin * 2;
    const panelHeight = this.height - margin * 2;
    const panelX = margin;
    const panelY = margin;

    // Semi-transparent dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Main panel
    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(atMarket ? 'TRADING' : 'INVENTORY', this.width / 2, panelY + 30);

    // Close hint
    ctx.font = '10px monospace';
    ctx.fillStyle = '#8a8070';
    ctx.fillText('Press I or ESC to close', this.width / 2, panelY + 50);

    // Gold display
    ctx.font = '12px monospace';
    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.textAlign = 'left';
    ctx.fillText(`Gold: ${party.gold}`, panelX + 20, panelY + 80);

    // Party leader stats
    const leader = party.members[0];
    if (leader) {
      ctx.fillText(`HP: ${Math.round(leader.health)}/${leader.maxHealth}`, panelX + 180, panelY + 80);
      ctx.fillText(`Food Need: ${Math.round(leader.needs.food)}`, panelX + 340, panelY + 80);
    }
    
    // Tabs if at market
    if (atMarket && loc) {
      // Inventory tab
      const invTabX = panelX + 20;
      const invTabY = panelY + 100;
      const tabW = 100;
      const tabH = 20;
      
      ctx.fillStyle = this.inventoryTab === 'inventory' ? 'rgba(80, 80, 100, 0.8)' : 'rgba(40, 40, 50, 0.6)';
      ctx.fillRect(invTabX, invTabY, tabW, tabH);
      ctx.strokeStyle = this.inventoryTab === 'inventory' ? PALETTE.uiHighlight : '#4a4a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(invTabX, invTabY, tabW, tabH);
      ctx.fillStyle = PALETTE.uiHighlight;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('INVENTORY', invTabX + tabW / 2, invTabY + 14);
      
      // Market tab
      const mktTabX = panelX + 130;
      ctx.fillStyle = this.inventoryTab === 'market' ? 'rgba(80, 80, 100, 0.8)' : 'rgba(40, 40, 50, 0.6)';
      ctx.fillRect(mktTabX, invTabY, tabW, tabH);
      ctx.strokeStyle = this.inventoryTab === 'market' ? PALETTE.uiHighlight : '#4a4a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(mktTabX, invTabY, tabW, tabH);
      ctx.fillStyle = PALETTE.uiHighlight;
      ctx.fillText('MARKET', mktTabX + tabW / 2, invTabY + 14);
    }

    const startY = atMarket ? panelY + 130 : panelY + 110;
    
    // Render active tab content
    if (atMarket && loc && this.inventoryTab === 'market') {
      this.renderMarketTab(loc, panelX, startY, panelWidth);
      return;
    }

    // Render inventory tab (default)
    this.renderInventoryTab(state, loc, atMarket, panelX, startY, panelWidth);
  }

  private renderInventoryTab(state: GameState, loc: Location | null, atMarket: boolean, panelX: number, startY: number, panelWidth: number): void {
    const { party } = state;
    const ctx = this.ctx;
    
    ctx.font = '12px monospace';
    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.textAlign = 'left';
    ctx.fillText('YOUR ITEMS:', panelX + 20, startY);

    if (party.inventory.length === 0) {
      ctx.fillStyle = '#8a8070';
      ctx.fillText('(empty - hunt animals or trade to gather items)', panelX + 20, startY + 30);
      return;
    }

    // Draw items in a grid layout
    const itemsPerRow = 2;
    const columnWidth = (panelWidth - 60) / itemsPerRow;
    let row = 0;
    let col = 0;

    for (let i = 0; i < party.inventory.length; i++) {
      const stack = party.inventory[i];
      const x = panelX + 20 + col * columnWidth;
      const y = startY + 30 + row * 60;

      // Item box
      ctx.fillStyle = 'rgba(40, 40, 50, 0.8)';
      ctx.fillRect(x, y, columnWidth - 10, 50);
      ctx.strokeStyle = '#4a4a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, columnWidth - 10, 50);

      // Draw item icon
      const sprite = getItemSprite(stack.resourceId);
      ctx.drawImage(sprite, x + 8, y + 8);

      // Item name
      ctx.fillStyle = PALETTE.uiHighlight;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(stack.resourceId.toUpperCase(), x + 28, y + 18);

      // Quantity and quality
      const qtyStr = (Math.round(stack.quantity * 10) / 10).toFixed(1);
      const qualStr = (stack.quality * 100).toFixed(0);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#b0a090';
      ctx.fillText(`Qty: ${qtyStr}`, x + 28, y + 34);
      ctx.fillText(`Quality: ${qualStr}%`, x + 28, y + 46);

      // Sell button if at market
      if (atMarket && loc) {
        const price = loc.marketPrices[stack.resourceId] ?? 3;
        const sellValue = Math.floor(price * stack.quality * stack.quantity);
        
        const btnX = x + columnWidth - 90;
        const btnY = y + 10;
        const btnW = 80;
        const btnH = 30;
        
        // Button background
        ctx.fillStyle = 'rgba(80, 140, 80, 0.8)';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = '#60b060';
        ctx.lineWidth = 1;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        
        // Button text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELL', btnX + btnW / 2, btnY + 13);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(`${sellValue}g`, btnX + btnW / 2, btnY + 25);
        
        // Register click area
        this.sellButtonAreas.push({
          x: btnX,
          y: btnY,
          w: btnW,
          h: btnH,
          itemIndex: i
        });
      }

      col++;
      if (col >= itemsPerRow) {
        col = 0;
        row++;
      }
    }
  }

  private renderMarketTab(loc: Location, panelX: number, startY: number, panelWidth: number): void {
    const ctx = this.ctx;
    const party = this.engine.state.party;
    
    ctx.font = '12px monospace';
    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.textAlign = 'left';
    ctx.fillText(`MARKET GOODS (${loc.name}):`, panelX + 20, startY);

    // Filter to food and common goods
    const marketGoods = loc.storage.filter(s => s.quantity > 0);
    
    if (marketGoods.length === 0) {
      ctx.fillStyle = '#8a8070';
      ctx.fillText('(no goods available for purchase)', panelX + 20, startY + 30);
      return;
    }

    // Draw market goods in a grid
    const itemsPerRow = 2;
    const columnWidth = (panelWidth - 60) / itemsPerRow;
    let row = 0;
    let col = 0;

    for (let i = 0; i < marketGoods.length; i++) {
      const stack = marketGoods[i];
      const x = panelX + 20 + col * columnWidth;
      const y = startY + 30 + row * 60;

      // Item box
      ctx.fillStyle = 'rgba(40, 40, 50, 0.8)';
      ctx.fillRect(x, y, columnWidth - 10, 50);
      ctx.strokeStyle = '#4a4a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, columnWidth - 10, 50);

      // Draw item icon
      const sprite = getItemSprite(stack.resourceId);
      ctx.drawImage(sprite, x + 8, y + 8);

      // Item name
      ctx.fillStyle = PALETTE.uiHighlight;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(stack.resourceId.toUpperCase(), x + 28, y + 18);

      // Quantity and quality
      const qtyStr = (Math.round(stack.quantity * 10) / 10).toFixed(1);
      const qualStr = (stack.quality * 100).toFixed(0);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#b0a090';
      ctx.fillText(`Stock: ${qtyStr}`, x + 28, y + 34);
      ctx.fillText(`Quality: ${qualStr}%`, x + 28, y + 46);

      // Buy button
      const price = loc.marketPrices[stack.resourceId] ?? 3;
      const buyValue = Math.floor(price * stack.quality);
      
      const btnX = x + columnWidth - 90;
      const btnY = y + 10;
      const btnW = 80;
      const btnH = 30;
      
      // Check if can afford
      const canAfford = party.gold >= buyValue;
      
      // Button background
      ctx.fillStyle = canAfford ? 'rgba(80, 120, 180, 0.8)' : 'rgba(80, 60, 60, 0.6)';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = canAfford ? '#5090d0' : '#604040';
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      
      // Button text
      ctx.fillStyle = canAfford ? '#ffffff' : '#909090';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BUY', btnX + btnW / 2, btnY + 13);
      ctx.font = '9px monospace';
      ctx.fillStyle = canAfford ? '#e0e0e0' : '#808080';
      ctx.fillText(`${buyValue}g`, btnX + btnW / 2, btnY + 25);
      
      // Register click area if can afford
      if (canAfford) {
        // Find the original index in loc.storage
        const originalIndex = loc.storage.findIndex(s => 
          s.resourceId === stack.resourceId && 
          Math.abs(s.quality - stack.quality) < 0.01 &&
          Math.abs(s.quantity - stack.quantity) < 0.01
        );
        
        this.buyButtonAreas.push({
          x: btnX,
          y: btnY,
          w: btnW,
          h: btnH,
          resourceId: stack.resourceId,
          storageIndex: originalIndex
        });
      }

      col++;
      if (col >= itemsPerRow) {
        col = 0;
        row++;
      }
    }
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
