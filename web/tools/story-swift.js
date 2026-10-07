/* story.js の台本を iPhone 版の StoryScenes.swift に書き出す。
 *   node web/tools/story-swift.js > swift/VentilatorSim/Sources/VentilatorCore/StoryScenes.swift
 * 台本は story.js だけを直し、これで書き出し直す（web/test.js の 26 番が一致を確かめる）。 */
const ST = require('../story.js');

const q = (s) => JSON.stringify(s);   // Swift の文字列リテラルとしてもそのまま通る

function line(l) {
  const args = [`.${l.who}`, q(l.say)];
  if (l.mood) args.push(`mood: ${q(l.mood)}`);
  if (l.bg) args.push(`bg: ${q(l.bg)}`);
  if (l.name) args.push(`name: ${q(l.name)}`);
  if (l.case) args.push(`caseID: ${q(l.case)}`);
  if (l.input === 'name') args.push('asksName: true');
  if (l.pick) args.push(`pick: ${q(l.pick)}`);
  if (l.when) args.push(`when: ${q(l.when)}`);
  if (l.choose) {
    args.push('choices: [\n' + l.choose.map(c => {
      const ca = [`label: ${q(c.label)}`, `reply: ${q(c.reply)}`];
      if (c.who) ca.push(`who: .${c.who}`);
      if (c.mood) ca.push(`mood: ${q(c.mood)}`);
      if (c.name) ca.push(`name: ${q(c.name)}`);
      if (c.case) ca.push(`caseID: ${q(c.case)}`);
      return `                StoryChoice(${ca.join(', ')})`;
    }).join(',\n') + '\n            ]');
  }
  return `            StoryLine(${args.join(', ')})`;
}

function scene(s) {
  const card = s.card ? `StoryCard(kicker: ${q(s.card.kicker)}, title: ${q(s.card.title)}, sub: ${q(s.card.sub)})` : 'nil';
  const end = s.end ? `StoryEnd(label: ${q(s.end.label)}, action: ${q(s.end.action)}, say: ${q(s.end.say || '')})` : 'nil';
  return `        StoryScene(id: ${q(s.id)}, kind: ${q(s.kind)}, chapter: ${s.chapter ? q(s.chapter) : 'nil'},
                   title: ${q(s.title)},
                   card: ${card},
                   bg: ${q(s.bg)}, time: ${q(s.time)},${s.bgm ? ` bgm: ${q(s.bgm)},` : ''} end: ${end}, lines: [
${s.lines.map(line).join(',\n')}
        ])`;
}

function note(n) {
  const args = [`id: ${q(n.id)}`, `kind: .${n.kind}`, `scene: ${q(n.scene)}`, `hint: ${q(n.hint)}`, `title: ${q(n.title)}`];
  if (n.text) args.push(`text: ${q(n.text)}`);
  if (n.source) args.push(`source: ${q(n.source)}`);
  if (n.before) args.push(`before: ${q(n.before)}`);
  if (n.now) args.push(`now: ${q(n.now)}`);
  return `        StoryNote(${args.join(',\n                  ')})`;
}

function render() {
  return `// このファイルは web/tools/story-swift.js が web/story.js から書き出したもの。手で直さないこと。
// 台本を直すときは story.js を直し、node web/tools/story-swift.js > このファイル で書き出し直す。

extension StoryLibrary {
    public static let scenes: [StoryScene] = [
${ST.SCENES.map(scene).join(',\n')}
    ]

    /// 研修手帳（web/story.js の NOTEBOOK）。
    public static let notebook: [StoryNote] = [
${ST.NOTEBOOK.map(note).join(',\n')}
    ]
}
`;
}

if (require.main === module) process.stdout.write(render());
module.exports = { render };
