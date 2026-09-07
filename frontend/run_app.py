import http.server
import socketserver
import webbrowser
import os
import sys
import subprocess
import shutil

PORT = 5173
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
SCRATCH_NODE = os.path.normpath(os.path.join(DIRECTORY, "..", "node", "node-v20.18.0-win-x64"))

def run():
    # If portable or system Node is available, run Vite
    node_path = shutil.which("node") or (os.path.join(SCRATCH_NODE, "node.exe") if os.path.exists(os.path.join(SCRATCH_NODE, "node.exe")) else None)
    npm_path = shutil.which("npm") or (os.path.join(SCRATCH_NODE, "npm.cmd") if os.path.exists(os.path.join(SCRATCH_NODE, "npm.cmd")) else None)

    if node_path and npm_path:
        print(f"==================================================")
        print(f" LifeSync — Starting Vite React Dev Server")
        print(f" Node: {node_path}")
        print(f" http://localhost:{PORT}")
        print(f"==================================================")
        env = os.environ.copy()
        if os.path.exists(SCRATCH_NODE):
            env["PATH"] = SCRATCH_NODE + os.pathsep + env.get("PATH", "")
        subprocess.run([npm_path, "run", "dev"], cwd=DIRECTORY, env=env)
        return

    # Fallback to simple HTTP server
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=DIRECTORY, **kwargs)

        def do_GET(self):
            if self.path in ('/', '/index.html'):
                self.path = '/LifeSync_App.html'
            return super().do_GET()

    print(f"==================================================")
    print(f" LifeSync — Intelligent Task & Calendar Workspace ")
    print(f" Running at: http://localhost:{PORT}")
    print(f" Press Ctrl+C to stop the server")
    print(f"==================================================")

    webbrowser.open(f"http://localhost:{PORT}")

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down LifeSync server.")

if __name__ == "__main__":
    run()

