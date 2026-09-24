/* bgm.js の楽譜と音色を iPhone 版の App/BGMScore.swift に書き出す。
 *   node web/tools/bgm-swift.js > swift/VentilatorSim/App/BGMScore.swift
 * 曲や音色は bgm.js だけを直し、これで書き出し直す（web/test.js の 27 番が一致を確かめる）。
 * 合成の手順は App/BGMPlayer.swift が bgm.js の voiceInto / Reverb / Renderer と同じ形で持つ。 */
const B = require('../bgm.js');

const num = (v) => {
  const s = String(v);
  return /[.e]/.test(s) ? s : s + '.0';
};

function inst(name, p) {
  const f = (k, d = 0) => num(p[k] == null ? d : p[k]);
  return `        "${name}": BGMInstrument(kind: .${p.kind}, attack: ${f('a')}, tau: ${f('tau')}, release: ${f('rel')}, ` +
    `gain: ${f('gain')}, pan: ${f('pan')},\n` +
    `                           index: ${f('index')}, indexTau: ${f('indexTau', 1)}, indexBase: ${f('indexBase')}, ` +
    `partial: ${f('partial', 1)}, partialGain: ${f('partialGain')}, partialTau: ${f('partialTau', 1)}, detune: ${f('detune')})`;
}

function song(name) {
  const s = B.SONGS[name];
  const notes = B.score(name).map(n => `            BGMNote(inst: "${n.i}", t: ${num(n.t)}, d: ${num(n.d)}, f: ${num(n.f)}, v: ${num(n.v)})`);
  return `        "${name}": BGMSong(length: ${num(+B.length(name).toFixed(6))}, feedback: ${num(s.reverb.feedback)}, ` +
    `damp: ${num(s.reverb.damp)}, wet: ${num(s.reverb.wet)}, notes: [\n${notes.join(',\n')}\n        ])`;
}

function render() {
  return `// このファイルは web/tools/bgm-swift.js が web/bgm.js から書き出したもの。手で直さないこと。
// 曲や音色を直すときは bgm.js を直し、node web/tools/bgm-swift.js > このファイル で書き出し直す。

enum BGMScore {
    static let rate: Double = ${num(B.RATE)}
    static let gain: Float = ${num(B.GAIN)}
    static let duck: Float = ${num(B.DUCK)}
    static let fade: Double = ${num(B.FADE)}

    static let instruments: [String: BGMInstrument] = [
${Object.keys(B.INST).map(k => inst(k, B.INST[k])).join(',\n')}
    ]

    static let songs: [String: BGMSong] = [
${Object.keys(B.SONGS).map(song).join(',\n')}
    ]
}
`;
}

if (require.main === module) process.stdout.write(render());
module.exports = { render };
