/* 公開用の 1 ファイル版を作る。index.html の <script src> をその場に展開するだけ。
 * 使い方: node web/build.js [出力先]   既定は web/preview.html
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const out = process.argv[2] || path.join(dir, 'preview.html');

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
// 生成画像の一覧があれば埋め込む（file:// では fetch できないため）。画像そのものは assets/ を相対参照する。
const manifestPath = path.join(dir, 'assets', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  html = html.replace('<script src="assets.js"></script>',
    '<script>window.VENT_MANIFEST = ' + fs.readFileSync(manifestPath, 'utf8').trim() + ';</script>\n<script src="assets.js"></script>');
}
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(dir, src), 'utf8');
  return '<script>\n/* ' + src + ' */\n' + code + '\n</script>';
});

fs.writeFileSync(out, html);
console.log(out + '  ' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
