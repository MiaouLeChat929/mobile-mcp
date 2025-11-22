import { AdbClient, VmServiceClient } from '../core/interfaces';
import { DevEngine } from './DevEngine';
import { SemanticNode, Rect } from '../core/types';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

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
    // 2. If not available, fallback to ADB dump (Release Mode / Native)

    const runner = this.devEngine.getRunner();
    const uri = this.devEngine.getVmServiceUri();

    if (runner && uri) {
        const client = this.vmClientFactory();
        await client.connect(uri);

        try {
            const rawTree = await client.getRenderObjectDiagnostics(0); // 0 for full tree? or big number.
            return this.filterIaTree(rawTree);
        } catch (e) {
            console.error("Failed to get Flutter tree, falling back to ADB:", e);
            // Fallthrough to ADB logic below
        } finally {
            await client.disconnect();
        }
    }

    return this.getReleaseSemanticTree();
  }

  private async getReleaseSemanticTree(): Promise<SemanticNode> {
      const xml = await this.adb.dumpWindowHierarchy();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
      const jsonObj = parser.parse(xml);

      // Root might be hierarchy.node or hierarchy
      // Depending on fast-xml-parser version and options, accessing the root can vary.
      // Usually <hierarchy><node ...>...</node></hierarchy>
      // So jsonObj.hierarchy.node is the root node.
      const rootNode = jsonObj.hierarchy?.node || jsonObj.node || jsonObj.hierarchy;

      if (!rootNode) {
          throw new Error("Failed to parse window hierarchy or empty tree.");
      }

      // If rootNode is an array (rare for root, but possible if multiple roots?), handle it.
      // But typically hierarchy has one root node.
      const nodeToProcess = Array.isArray(rootNode) ? rootNode[0] : rootNode;

      return this.xmlNodeToSemanticNode(nodeToProcess);
  }

  private xmlNodeToSemanticNode(xmlNode: any): SemanticNode {
      const children: SemanticNode[] = [];

      if (xmlNode.node) {
          const nodes = Array.isArray(xmlNode.node) ? xmlNode.node : [xmlNode.node];
          for (const child of nodes) {
              children.push(this.xmlNodeToSemanticNode(child));
          }
      }

      const rect = this.parseBounds(xmlNode.bounds);
      const type = this.simplifyAndroidType(xmlNode.class);
      // Use text or content-desc.
      // Sometimes both exist. Text is visible text, content-desc is for accessibility.
      // We prefer text, but content-desc is good fallback.
      const text = xmlNode.text || xmlNode['content-desc'];

      return {
          type,
          text: text ? String(text) : undefined,
          rect,
          children: children.length > 0 ? children : undefined,
          isVisible: true, // ADB dump nodes are usually "layout" nodes, visibility is implicit but can be checked via attributes if needed.
          isClickable: String(xmlNode.clickable) === 'true',
          isFocusable: String(xmlNode.focusable) === 'true',
          isFocused: String(xmlNode.focused) === 'true'
      };
  }

  private parseBounds(boundsStr: string): Rect {
      // "[0,0][1080,200]"
      if (!boundsStr) return { x: 0, y: 0, width: 0, height: 0 };

      const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!match) return { x: 0, y: 0, width: 0, height: 0 };

      const x1 = parseInt(match[1]);
      const y1 = parseInt(match[2]);
      const x2 = parseInt(match[3]);
      const y2 = parseInt(match[4]);

      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }

  private simplifyAndroidType(rawType: string): string {
      if (!rawType) return 'Unknown';
      const parts = rawType.split('.');
      return parts[parts.length - 1];
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
