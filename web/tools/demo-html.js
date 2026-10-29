/* 体験版のページを作る。index.html に体験版のしるしを足し、一つ下の階層（demo/）から
 * 本体と同じ js・画像・音を読むようにするだけ。
 * 使い方: node web/tools/demo-html.js [出力先]   既定は web/demo/index.html
 * GitHub Pages では .github/workflows/pages.yml が _site/demo/index.html に書き出す。
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const out = process.argv[2] || path.join(dir, 'demo', 'index.html');

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const swap = (from, to) => {
  if (html.indexOf(from) < 0) throw new Error('index.html に見つからない: ' + from);
  html = html.replace(from, to);
};
swap('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">');
swap('<title>触って覚える！こどもの人工呼吸器</title>', '<title>触って覚える！こどもの人工呼吸器（体験版）</title>');
swap('<script src="vendor/pixi.min.js"></script>',
  '<script>window.VENTSIM_DEMO = true;</script>\n<script src="vendor/pixi.min.js"></script>');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out);
