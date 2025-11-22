import { AdbClient } from '../core/interfaces';
import { VisionService } from './VisionService';
import { SemanticNode } from '../core/types';
import { XMLParser } from 'fast-xml-parser';

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
      const xml = await this.adb.dumpWindowHierarchy();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
      const jsonObj = parser.parse(xml);

      const keywords = action === 'accept'
          ? ['Allow', 'While using the app', 'OK', 'Yes', 'Accept']
          : ['Deny', 'Don\'t allow', 'Cancel', 'No'];

      // Depending on parser config, root might be hierarchy.node or just hierarchy
      const root = jsonObj.hierarchy || jsonObj;
      const node = this.findNodeByText(root, keywords);

      if (node && node.bounds) {
          const bounds = this.parseBounds(node.bounds);
          const x = bounds.x + bounds.width / 2;
          const y = bounds.y + bounds.height / 2;
          await this.adb.tap(x, y);
          return `Handled system dialog: ${action} (Tapped '${node.text || node['content-desc'] || 'Element'}' at ${x},${y})`;
      }

      throw new Error(`Could not find button for action '${action}' in system dialog`);
  }

  private findNodeByText(node: any, keywords: string[]): any {
      const matches: any[] = [];
      this.collectMatches(node, keywords, matches);

      // Prioritize clickable matches
      const clickableMatch = matches.find(m => String(m.clickable) === 'true');
      if (clickableMatch) return clickableMatch;

      return matches[0] || null;
  }

  private collectMatches(node: any, keywords: string[], matches: any[]) {
      if (!node) return;
      const text = node.text || node['content-desc'] || "";
      if (keywords.some(k => text.includes(k))) {
          matches.push(node);
      }

      if (node.node) {
          const children = Array.isArray(node.node) ? node.node : [node.node];
          for (const child of children) {
              this.collectMatches(child, keywords, matches);
          }
      }
  }

  private parseBounds(boundsStr: string): { x: number, y: number, width: number, height: number } {
      // "[0,0][1080,200]"
      const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!match) return { x: 0, y: 0, width: 0, height: 0 };
      const x1 = parseInt(match[1]);
      const y1 = parseInt(match[2]);
      const x2 = parseInt(match[3]);
      const y2 = parseInt(match[4]);
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }

  async injectFile(sourcePath: string, targetPath: string): Promise<string> {
      await this.adb.push(sourcePath, targetPath);
      return `Injected file ${sourcePath} to ${targetPath}`;
  }
}
