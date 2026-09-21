/* 公開用の 1 ファイル版を作る。index.html の <script src> をその場に展開するだけ。
 * 使い方: node web/build.js [出力先]   既定は web/preview.html
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const out = process.argv[2] || path.join(dir, 'preview.html');

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(dir, src), 'utf8');
  return '<script>\n/* ' + src + ' */\n' + code + '\n</script>';
});

fs.writeFileSync(out, html);
console.log(out + '  ' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
