/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { libPath } from '../../package';

export const allSkills = ['playwright-cli', 'playwright-component-testing', 'playwright-trace'] as const;

export type SkillName = typeof allSkills[number];
export type SkillTarget = 'claude' | 'agents';

export async function installSkills(skills: readonly SkillName[], target: SkillTarget = 'claude', options?: { global?: boolean, cliCommand?: string }) {
  const cwd = process.cwd();
  const baseDir = options?.global ? os.homedir() : cwd;
  for (const skill of skills) {
    const sourceDir = libPath('tools', 'skills', skill);
    if (!fs.existsSync(sourceDir))
      throw new Error(`Skill source directory not found: ${sourceDir}`);
    const destDir = path.join(baseDir, `.${target}`, 'skills', skill);
    await fs.promises.cp(sourceDir, destDir, { recursive: true });
    if (skill === 'playwright-cli' && options?.cliCommand)
      await renderPlaywrightCliCommand(destDir, options.cliCommand);
    console.log(`✅ Skill installed to \`${options?.global ? destDir : path.relative(cwd, destDir)}\`.`);
  }
}

async function renderPlaywrightCliCommand(dir: string, cliCommand: string) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await renderPlaywrightCliCommand(entryPath, cliCommand);
    } else if (entry.name.endsWith('.md')) {
      const content = await fs.promises.readFile(entryPath, 'utf8');
      await fs.promises.writeFile(entryPath, renderShellCommands(content, cliCommand));
    }
  }
}

function renderShellCommands(content: string, cliCommand: string) {
  const shellLanguages = new Set(['bash', 'batch', 'powershell', 'ps1', 'sh', 'shell', 'zsh']);
  let inShellBlock = false;
  return content.split('\n').map(line => {
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      inShellBlock = inShellBlock ? false : shellLanguages.has(fence[1]);
      return line;
    }
    if (!inShellBlock)
      return line;
    return line.replace(/(^\s*(?:>\s*)?|(?:\$\(|&&|\|\||[;|])\s*)playwright-cli(?=\s|$)/g, (_, prefix) => prefix + cliCommand);
  }).join('\n');
}
