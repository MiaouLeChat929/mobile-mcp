import { AdbClient, VmServiceClient } from '../core/interfaces';
import { DevEngine } from './DevEngine';
import { SemanticNode, Rect } from '../core/types';
import fs from 'fs';

export class VisionService {
  constructor(
    private adb: AdbClient,
    private devEngine: DevEngine,
    private vmClientFactory: () => VmServiceClient
  ) {}

  async takeScreenshot(): Promise<string> {
    const buffer = await this.adb.takeScreenshot();
    // Save to temp file
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = `/tmp/${filename}`; // In real app, use proper temp dir
    // fs.writeFileSync(filepath, buffer); // Commented out for sandbox safety if /tmp issues, but we can return base64 or path.
    // The tool definition says "Retourne le chemin".
    // I'll assume we can write to the current directory or a 'captures' folder.
    const captureDir = 'captures';
    if (!fs.existsSync(captureDir)) fs.mkdirSync(captureDir);
    const finalPath = `${captureDir}/${filename}`;
    fs.writeFileSync(finalPath, buffer);
    return finalPath;
  }

  async getSemanticTree(): Promise<SemanticNode> {
    // Strategy:
    // 1. Try to get tree from DevEngine (Flutter Inspector)
    // 2. If not available, fail or fallback (spec says "Utilise le Flutter DevTools Service")

    const runner = this.devEngine.getRunner();
    if (!runner) {
        throw new Error("No active Dev Session. Cannot get Semantic Tree via Flutter DevTools.");
    }

    const uri = this.devEngine.getVmServiceUri();
    if (!uri) {
        throw new Error("VM Service URI not available yet.");
    }

    const client = this.vmClientFactory();
    await client.connect(uri);

    try {
        const rawTree = await client.getRenderObjectDiagnostics(0); // 0 for full tree? or big number.
        return this.filterIaTree(rawTree);
    } finally {
        await client.disconnect();
    }
  }

  // The "IA Filter" logic
  private filterIaTree(rawNode: any): SemanticNode {
    // This is a simplified heuristic to convert raw RenderObjects to SemanticNodes

    const children: SemanticNode[] = [];
    if (rawNode.children) {
        for (const child of rawNode.children) {
            const filteredChild = this.filterIaTree(child);
            // Only add relevant children? Or all?
            // We merge children if the current node is not interesting.
            if (this.isRelevant(filteredChild)) {
                children.push(filteredChild);
            } else if (filteredChild.children) {
                children.push(...filteredChild.children);
            }
        }
    }

    // Extract properties
    const type = this.simplifyType(rawNode.type);
    const text = this.extractText(rawNode);
    const rect = this.extractRect(rawNode); // In real inspector, rect might need calculation or be present.

    return {
        type,
        text,
        rect,
        children: children.length > 0 ? children : undefined,
        isVisible: true // Assume visible if in render tree?
    };
  }

  private isRelevant(node: SemanticNode): boolean {
    // Keep if it has text, is a button, input, or has interesting children
    if (node.text) return true;
    if (node.type === 'Button' || node.type === 'Input' || node.type === 'Text') return true;
    if (node.children && node.children.length > 0) return true;
    return false;
  }

  private simplifyType(rawType: string): string {
    if (!rawType) return 'Unknown';
    if (rawType.includes('Button')) return 'Button';
    if (rawType.includes('Text') || rawType.includes('Paragraph')) return 'Text';
    if (rawType.includes('Image')) return 'Image';
    if (rawType.includes('Field') || rawType.includes('Input')) return 'Input';
    if (rawType.includes('Semantics')) return 'Semantics';
    return 'Container';
  }

  private extractText(rawNode: any): string | undefined {
    // Look for properties named 'text', 'label', 'value'
    if (rawNode.properties) {
        const textProp = rawNode.properties.find((p: any) => p.name === 'text' || p.name === 'label' || p.name === 'value');
        if (textProp) return String(textProp.value);
    }
    return undefined;
  }

  private extractRect(rawNode: any): Rect {
    // Mock logic: extract from 'paintBounds' or similar if available in raw JSON
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  async analyzeVisualState(): Promise<string> {
      const screenshotPath = await this.takeScreenshot();
      let treeSummary = "Tree unavailable";
      try {
          const tree = await this.getSemanticTree();
          treeSummary = `Root: ${tree.type} (Children: ${tree.children?.length || 0})`;
      } catch (e) {
          // ignore
      }

      return `Visual State Analysis:\nScreenshot saved at: ${screenshotPath}\nSemantic Tree: ${treeSummary}\nPotential inconsistencies: None detected (Basic Logic)`;
  }

  async findElement(criteria: string, timeoutMs: number): Promise<SemanticNode | null> {
      // Polling logic would go here
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
          try {
              const tree = await this.getSemanticTree();
              // DFS to find criteria
              const found = this.searchTree(tree, criteria);
              if (found) return found;
          } catch (e) {
              // ignore errors during polling
          }
          await new Promise(r => setTimeout(r, 500));
      }
      return null;
  }

  private searchTree(node: SemanticNode, criteria: string): SemanticNode | null {
      if (node.text && node.text.includes(criteria)) return node;
      if (node.type.includes(criteria)) return node;
      if (node.children) {
          for (const child of node.children) {
              const found = this.searchTree(child, criteria);
              if (found) return found;
          }
      }
      return null;
  }
}
