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
  if (l.choose) {
    args.push('choices: [\n' + l.choose.map(c =>
      `                StoryChoice(label: ${q(c.label)}, reply: ${q(c.reply)})`).join(',\n') + '\n            ]');
  }
  return `            StoryLine(${args.join(', ')})`;
}

function scene(s) {
  const card = s.card ? `StoryCard(kicker: ${q(s.card.kicker)}, title: ${q(s.card.title)}, sub: ${q(s.card.sub)})` : 'nil';
  const end = s.end ? `StoryEnd(label: ${q(s.end.label)}, action: ${q(s.end.action)}, say: ${q(s.end.say || '')})` : 'nil';
  return `        StoryScene(id: ${q(s.id)}, kind: ${q(s.kind)}, chapter: ${s.chapter ? q(s.chapter) : 'nil'},
                   title: ${q(s.title)},
                   card: ${card},
                   bg: ${q(s.bg)}, time: ${q(s.time)}, end: ${end}, lines: [
${s.lines.map(line).join(',\n')}
        ])`;
}

function render() {
  return `// このファイルは web/tools/story-swift.js が web/story.js から書き出したもの。手で直さないこと。
// 台本を直すときは story.js を直し、node web/tools/story-swift.js > このファイル で書き出し直す。

extension StoryLibrary {
    public static let scenes: [StoryScene] = [
${ST.SCENES.map(scene).join(',\n')}
    ]
}
`;
}

if (require.main === module) process.stdout.write(render());
module.exports = { render };
