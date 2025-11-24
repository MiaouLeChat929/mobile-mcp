import WebSocket, { WebSocketServer } from 'ws';
import { RealVmServiceClient } from '../../src/infra/RealVmServiceClient';
import assert from 'assert';

describe('RealVmServiceClient', () => {
    let server: WebSocketServer;
    let client: RealVmServiceClient;
    let port: number;
    let onServerMessage: ((ws: WebSocket, msg: any) => void) | undefined;

    before((done) => {
        server = new WebSocketServer({ port: 0 });
        server.on('listening', () => {
            const addr = server.address();
            if (typeof addr === 'object' && addr) {
                port = addr.port;
                done();
            } else {
                done(new Error("Failed to get server port"));
            }
        });

        server.on('connection', (ws) => {
            ws.on('message', (data) => {
                if (onServerMessage) {
                    try {
                        onServerMessage(ws, JSON.parse(data.toString()));
                    } catch (e) {
                        console.error("Error in test message handler", e);
                    }
                }
            });
        });
    });

    after((done) => {
        server.close(done);
    });

    beforeEach(() => {
        client = new RealVmServiceClient();
        onServerMessage = undefined;
    });

    afterEach(async () => {
        await client.disconnect();
    });

    it('should connect successfully', async () => {
        await client.connect(`ws://127.0.0.1:${port}`);
        // Connection promise resolves on 'open', which implies successful handshake
    });

    it('should handle getRenderObjectDiagnostics success (Happy Path)', async () => {
        await client.connect(`ws://127.0.0.1:${port}`);

        const responsePromise = client.getRenderObjectDiagnostics(0);

        onServerMessage = (ws, req) => {
            assert.strictEqual(req.method, 'ext.flutter.inspector.getRootWidgetSummaryTree');
            const resp = {
                jsonrpc: '2.0',
                id: req.id,
                result: { type: 'Widget', name: 'App' }
            };
            ws.send(JSON.stringify(resp));
        };

        const result = await responsePromise;
        assert.deepStrictEqual(result, { type: 'Widget', name: 'App' });
    });

    it('should ignore interleaved events', async () => {
        await client.connect(`ws://127.0.0.1:${port}`);

        const responsePromise = client.getRenderObjectDiagnostics(0);

        onServerMessage = (ws, req) => {
            // Send an event first
            const event = {
                jsonrpc: '2.0',
                method: 'streamNotify',
                params: { streamId: 'Stdout', event: {} }
            };
            ws.send(JSON.stringify(event));

            // Then send response
            const resp = {
                jsonrpc: '2.0',
                id: req.id,
                result: { type: 'Widget', name: 'App' }
            };
            ws.send(JSON.stringify(resp));
        };

        const result = await responsePromise;
        assert.deepStrictEqual(result, { type: 'Widget', name: 'App' });
    });

    it('should timeout if no response received', async function() {
        this.timeout(6000);
        await client.connect(`ws://127.0.0.1:${port}`);

        onServerMessage = (ws, req) => {
            // Do nothing, simulate timeout
        };

        try {
            await client.getRenderObjectDiagnostics(0);
            assert.fail('Should have thrown timeout error');
        } catch (e: any) {
            assert.strictEqual(e.message, 'Request timed out after 5000ms');
        }
    });

    it('should throw not implemented for evaluate', async () => {
        try {
            await client.evaluate('1+1');
            assert.fail('Should have thrown');
        } catch (e: any) {
            assert.strictEqual(e.message, 'Not Implemented');
        }
    });
});
