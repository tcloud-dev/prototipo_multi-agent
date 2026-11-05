// Grava um arquivo so quando o conteudo esta pronto: escreve num temporario e renomeia. Evita o arquivo de 0 bytes que sobra
// quando o comando e interrompido no meio (o que acontecia com `comando > arquivo`).
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeAtomic(file, data) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}
