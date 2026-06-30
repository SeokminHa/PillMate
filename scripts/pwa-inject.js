const fs = require("fs");
const path = require("path");

const indexPath = path.resolve(__dirname, "..", "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("dist/index.html not found — run `npm run web:build` first");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf-8");

const pwaTags = `
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#3B82F6">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="PillMate">
    <link rel="apple-touch-icon" href="/assets/images/icon.png">
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js');
        });
      }
    </script>`;

if (html.includes('rel="manifest"')) {
  console.log("PWA tags already present — skipping");
  process.exit(0);
}

html = html.replace("</head>", pwaTags + "\n  </head>");

fs.writeFileSync(indexPath, html, "utf-8");
console.log("PWA tags injected into dist/index.html");
