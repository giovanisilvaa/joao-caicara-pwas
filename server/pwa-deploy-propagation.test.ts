import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('verificacao de propagacao do deploy dos PWAs', () => {
  it('confere no Firebase os mesmos arquivos publicados pelo repositorio', () => {
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
    expect(workflow).toContain('Verify PWA deployment propagation');
    expect(workflow).toContain("verificar_arquivo '/pdv/service-worker.js' 'client/public/pdv/service-worker.js'");
    expect(workflow).toContain("verificar_arquivo '/garcom/service-worker.js' 'client/public/garcom/service-worker.js'");
    expect(workflow).toContain("verificar_arquivo '/garcom/waiter-speed.js' 'client/public/garcom/waiter-speed.js'");
    expect(workflow).toContain("verificar_arquivo '/garcom/waiter-speed.css' 'client/public/garcom/waiter-speed.css'");
    expect(workflow).toContain("verificar_arquivo '/pwa-live-update.js' 'client/public/pwa-live-update.js'");
    expect(workflow).toContain("verificar_arquivo '/pdv/' 'client/public/pdv/index.html'");
    expect(workflow).toContain("verificar_arquivo '/garcom/' 'client/public/garcom/index.html'");
    expect(workflow).toContain('cmp -s');
  });

  it('valida no-store nos pontos criticos depois da publicacao', () => {
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
    expect(workflow).toContain('verificar_no_cache');
    expect(workflow).toContain("grep -qi '^cache-control:.*no-store'");
    expect(workflow).toContain("verificar_no_cache '/pdv/service-worker.js'");
    expect(workflow).toContain("verificar_no_cache '/garcom/service-worker.js'");
    expect(workflow).toContain("verificar_no_cache '/pwa-live-update.js'");
    expect(workflow).toContain("verificar_no_cache '/pdv/'");
    expect(workflow).toContain("verificar_no_cache '/garcom/'");
  });

  it('faz a verificacao depois do Hosting e antes das regras do banco', () => {
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
    const deployHosting = workflow.indexOf('Deploy to Firebase Hosting');
    const verify = workflow.indexOf('Verify PWA deployment propagation');
    const deployDb = workflow.indexOf('Deploy Realtime Database rules');
    expect(deployHosting).toBeGreaterThanOrEqual(0);
    expect(verify).toBeGreaterThan(deployHosting);
    expect(deployDb).toBeGreaterThan(verify);
  });
});
