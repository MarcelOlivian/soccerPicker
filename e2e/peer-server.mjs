// Minimal local PeerServer for e2e/live.spec.ts, started via the `peer`
// package's programmatic API rather than its CLI. The CLI's `--host` flag
// doesn't reliably stop an internal listener from also trying to bind the
// IPv6 wildcard address (::), which fails outright on hosts without IPv6
// support; binding explicitly here via the JS API avoids that entirely and
// is safe everywhere the CLI would otherwise be flaky.
import { PeerServer } from 'peer';

const port = Number(process.argv[2] || 9000);
const path = process.argv[3] || '/peerjs';

const server = PeerServer({ port, path, host: '127.0.0.1' });
server.on('connection', () => {});
server.on('error', (err) => {
  console.error('PEER_SERVER_ERROR', err);
  process.exit(1);
});

console.log(`PEER_SERVER_READY port=${port} path=${path}`);
