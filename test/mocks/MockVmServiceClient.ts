import { VmServiceClient } from '../../src/core/interfaces';

export class MockVmServiceClient implements VmServiceClient {
  public isConnected = false;
  public logs: string[] = [];

  async connect(uri: string): Promise<void> {
    this.isConnected = true;
    this.logs.push(`connect: ${uri}`);
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logs.push("disconnect");
  }

  async getRenderObjectDiagnostics(subtreeDepth: number): Promise<any> {
    // Return a simplified structure mimicking a Flutter Inspector tree
    // This is the "Raw" tree that the VisionService will filter
    return {
      type: "RenderView",
      children: [
        {
          type: "RenderSemanticsAnnotations",
          properties: [{ name: "label", value: "Scan Button" }],
          children: [
            {
                type: "RenderMouseRegion",
                children: [
                    {
                        type: "RenderPointerListener",
                        children: [
                            {
                                type: "RenderObject",
                                description: "This is the button visual"
                            }
                        ]
                    }
                ]
            }
          ]
        },
        {
          type: "RenderParagraph",
          properties: [{ name: "text", value: "Welcome to Flutter" }]
        }
      ]
    };
  }

  async evaluate(expression: string): Promise<any> {
    return { result: "mocked result" };
  }
}
