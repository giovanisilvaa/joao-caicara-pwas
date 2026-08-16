import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['client/public/garcom/index.html', 'client/public/pdv/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(script => script.trim());
  scripts.forEach((script, index) => new vm.Script(script, { filename: `${file}#script-${index + 1}` }));
  console.log(`${file}: ${scripts.length} script(s) válidos`);
}
