/* 公開用の 1 ファイル版を作る。index.html の <script src> をその場に展開するだけ。
 * 使い方: node web/build.js [出力先]                  既定は web/preview.html（こども版）
 *         node web/build.js --edition adult [出力先]  成人版。既定は web/preview-adult.html
 *         node web/build.js --edition adult --dev     成人版を展開せずに web/adult.html へ（file:// で開いて確かめる用）
 * 成人版は index.html をそのまま使い、症例・レッスン・物語の 3 ファイルを adult/ のものに差し替え、
 * window.VENT_EDITION = 'adult' を埋め込む（画面の文言は edition.js が切り替える）。
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const args = process.argv.slice(2);
const ei = args.indexOf('--edition');
const edition = ei >= 0 ? args.splice(ei, 2)[1] : 'peds';
const di = args.indexOf('--dev');
const dev = di >= 0 && !!args.splice(di, 1);
const adult = edition === 'adult';
const out = args[0] || path.join(dir, adult ? (dev ? 'adult.html' : 'preview-adult.html') : 'preview.html');

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
if (adult) {
  const title = 'おとなの人工呼吸器シミュレーター';
  html = html.split('こどもの人工呼吸器シミュレーター').join(title);
  html = html.replace('<script src="vendor/pixi.min.js"></script>',
    '<script>window.VENT_EDITION = \'adult\';</script>\n<script src="vendor/pixi.min.js"></script>');
  for (const f of ['scenarios.js', 'lessons.js', 'story.js']) {
    html = html.replace('<script src="' + f + '"></script>', '<script src="adult/' + f + '"></script>');
  }
}
if (!dev) {
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
}

fs.writeFileSync(out, html);
console.log(out + '  ' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
