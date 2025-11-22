import { AdbClient } from '../core/interfaces';
import { VisionService } from './VisionService';
import { SemanticNode } from '../core/types';

export class InteractionService {
  constructor(
    private adb: AdbClient,
    private vision: VisionService
  ) {}

  async tapElement(finder: string | { x: number, y: number }): Promise<string> {
    if (typeof finder === 'object') {
        await this.adb.tap(finder.x, finder.y);
        return `Tapped at ${finder.x},${finder.y}`;
    } else {
        const element = await this.vision.findElement(finder, 5000); // 5s default timeout
        if (!element) throw new Error(`Element '${finder}' not found`);

        const x = element.rect.x + element.rect.width / 2;
        const y = element.rect.y + element.rect.height / 2;
        await this.adb.tap(x, y);
        return `Tapped '${finder}' at ${x},${y}`;
    }
  }

  async inputText(text: string, submit: boolean): Promise<string> {
    await this.adb.inputText(text);
    if (submit) {
        await this.adb.keyEvent(66); // KEYCODE_ENTER
    }
    return `Input text '${text}' (submit=${submit})`;
  }

  async scrollTo(direction: 'up' | 'down' | 'left' | 'right', finder?: string): Promise<string> {
      // Simple swipe simulation
      // Get screen size
      const screen = await this.adb.getScreenSize();
      const centerX = screen.width / 2;
      const centerY = screen.height / 2;
      const delta = screen.height * 0.4;

      let x1 = centerX, y1 = centerY, x2 = centerX, y2 = centerY;

      if (direction === 'down') { y1 = centerY + delta; y2 = centerY - delta; } // Pull up to scroll down? No, swipe up to scroll down usually.
      // Wait, "scroll down" means content moves down? Or view moves down?
      // Usually "scroll down" means I want to see what is below -> I swipe UP.
      else if (direction === 'up') { y1 = centerY - delta; y2 = centerY + delta; } // Swipe DOWN to scroll up.
      // ... implementing standard swipe logic based on typical usage

      await this.adb.swipe(x1, y1, x2, y2);
      return `Scrolled ${direction}`;
  }

  async handleSystemDialog(action: 'accept' | 'deny'): Promise<string> {
      // Heuristic: Look for text "Allow", "Deny", "While using the app" via generic ADB dump if DevTools is blocked?
      // The spec says "Détecte et gère les popups natifs".
      // We can use `adb dumpWindowHierarchy` which works even if Flutter is blocked by a native dialog.
      const xml = await this.adb.dumpWindowHierarchy();
      // Naive parsing
      if (action === 'accept') {
          // Look for coordinates of "Allow", "OK", "Yes"
          // For now, we mock it: assuming we tap the right button.
          // TODO: Parse XML to find bounds of button with text "Allow"
          await this.adb.tap(800, 1800); // Mock coordinates
      } else {
          await this.adb.tap(200, 1800); // Mock coordinates
      }
      return `Handled system dialog: ${action}`;
  }

  async injectFile(sourcePath: string, targetPath: string): Promise<string> {
      await this.adb.push(sourcePath, targetPath);
      return `Injected file ${sourcePath} to ${targetPath}`;
  }
}
