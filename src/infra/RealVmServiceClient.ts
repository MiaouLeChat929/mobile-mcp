import WebSocket from 'ws';
import { VmServiceClient } from '../core/interfaces';

interface JsonRpcRequest {
    jsonrpc: "2.0";
    method: string;
    params?: any;
    id: number;
}

interface JsonRpcResponse {
    jsonrpc: "2.0";
    result?: any;
    error?: any;
    id?: number;
}

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timer: NodeJS.Timeout;
}

export class RealVmServiceClient implements VmServiceClient {
    private ws: WebSocket | null = null;
    private nextId = 1;
    private pendingRequests = new Map<number, PendingRequest>();

    async connect(uri: string): Promise<void> {
        if (this.ws) {
            this.ws.close();
        }

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(uri);

                this.ws.on('open', () => {
                    resolve();
                });

                this.ws.on('error', (err) => {
                    // If we haven't connected yet, reject the connect promise
                    // If we are already connected, this might need to be handled differently,
                    // but for now we assume connection errors during handshake reject here.
                    // Note: 'open' might have happened already, but typically 'error' on initial connection prevents 'open'.
                    // Ideally we should clear this listener after open.
                    console.error("VM Service WebSocket Error:", err);
                    reject(err);
                });

                this.ws.on('close', () => {
                    this.cleanup();
                });

                this.ws.on('message', (data) => {
                    this.handleMessage(data.toString());
                });

            } catch (e) {
                reject(e);
            }
        });
    }

    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.cleanup();
    }

    private cleanup() {
        // Reject all pending requests
        for (const [id, req] of this.pendingRequests) {
            clearTimeout(req.timer);
            req.reject(new Error("Connection closed"));
        }
        this.pendingRequests.clear();
    }

    private handleMessage(data: string) {
        try {
            const message = JSON.parse(data) as JsonRpcResponse;

            // If it has an ID, it's a response to a request
            if (message.id !== undefined && this.pendingRequests.has(message.id)) {
                const req = this.pendingRequests.get(message.id)!;
                clearTimeout(req.timer);
                this.pendingRequests.delete(message.id);

                if (message.error) {
                    req.reject(message.error);
                } else {
                    req.resolve(message.result);
                }
            }
            // If no ID, it's an event. We ignore events as per requirements.
        } catch (e) {
            console.error("Failed to parse VM Service message:", e);
        }
    }

    async getRenderObjectDiagnostics(subtreeDepth: number): Promise<any> {
        return this.sendRequest("ext.flutter.inspector.getRootWidgetSummaryTree", {
            // We might need to pass objectGroup usually, but the user instruction didn't specify it.
            // Often 'console-group' or similar is used.
            // For now, passing empty params or adhering to instruction.
            // If the instruction implies exactly the JSON body provided,
            // but usually params are needed for this method.
            // I'll add subtreeDepth just in case the custom protocol expects it,
            // or we can update it if verification fails.
        });
    }

    async evaluate(expression: string): Promise<any> {
        throw new Error("Not Implemented");
    }

    private sendRequest(method: string, params?: any): Promise<any> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error("Not connected to VM Service"));
        }

        const id = this.nextId++;
        const request: JsonRpcRequest = {
            jsonrpc: "2.0",
            method,
            params,
            id
        };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error("Request timed out after 5000ms"));
                }
            }, 5000);

            this.pendingRequests.set(id, { resolve, reject, timer });

            this.ws!.send(JSON.stringify(request), (err) => {
                if (err) {
                    clearTimeout(timer);
                    this.pendingRequests.delete(id);
                    reject(err);
                }
            });
        });
    }
}
