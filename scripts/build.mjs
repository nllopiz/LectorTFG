import { createReadStream, createWriteStream } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

const ASSETS_DIR = join(ROOT, 'assets');
const CSS_DIR = join(ROOT, 'css');
const JS_DIR = join(ROOT, 'js');

const IGNORE = new Set([
  'sources',
  'scripts',
  'tests',
  'package.json',
  'package-lock.json',
  'eslint.config.js',
  '.github',
  'README.md',
  'Panorama y plan de mejora.md',
  'node_modules',
  '.git',
]);


async function copyFile(src, dest) {
  await rm(dest, { force: true, recursive: true });
  const parent = dirname(dest);
  await mkdir(parent, { recursive: true });
  const read = createReadStream(src);
  const write = createWriteStream(dest);
  return new Promise((resolve, reject) => {
    read.on('error', reject);
    write.on('error', reject);
    write.on('finish', resolve);
    read.pipe(write);
  });
}

async function copyDirectory(srcDir, destDir) {
  await rm(destDir, { force: true, recursive: true });
  await mkdir(destDir, { recursive: true });

  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      // Skip files whose parent directory name is in IGNORE
      const parts = srcPath.split(sep);
      const dirName = parts[parts.length - 2];
      if (IGNORE.has(dirName)) {
        continue;
      }
      await copyFile(srcPath, destPath);
    }
  }
}

// Helper: copy entire JS dir
async function copyJSDirectory(srcDir, destDir) {
  await rm(destDir, { force: true, recursive: true });
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('Iniciando build de publicación...');
  console.log('ROOT:', ROOT);

  // Crear dist/
  await mkdir(DIST, { recursive: true });

  // 1. index.html
  console.log('Copiando index.html...');
  await copyFile(join(ROOT, 'index.html'), join(DIST, 'index.html'));

  // 2. css/app.css
  console.log('Copiando css/app.css...');
  await copyFile(join(CSS_DIR, 'app.css'), join(DIST, 'css', 'app.css'));

  // 3. js/ (app.js, video-analyses.js, y el resto)
  console.log('Copiando js/...');
  await copyJSDirectory(JS_DIR, join(DIST, 'js'));

  // 4. assets/favicon.svg
  console.log('Copiando assets/favicon.svg...');
  const favSrc = join(ASSETS_DIR, 'favicon.svg');
  const favDst = join(DIST, 'assets', 'favicon.svg');
  if (existsSync(favSrc)) {
    await mkdir(dirname(favDst), { recursive: true });
    await copyFile(favSrc, favDst);
  }

  // 5. assets/fonts/
  console.log('Copiando assets/fonts/...');
  const fontsSrc = join(ASSETS_DIR, 'fonts');
  const fontsDst = join(DIST, 'assets', 'fonts');
  if (existsSync(fontsSrc)) {
    await rm(fontsDst, { force: true, recursive: true });
    await mkdir(fontsDst, { recursive: true });
    const fontEntries = await readdir(fontsSrc, { withFileTypes: true });
    for (const entry of fontEntries) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        await copyFile(join(fontsSrc, entry.name), join(fontsDst, entry.name));
      }
    }
  }

  // 6. assets/images/
  console.log('Copiando assets/images/...');
  const imagesSrc = join(ASSETS_DIR, 'images');
  const imagesDst = join(DIST, 'assets', 'images');
  if (existsSync(imagesSrc)) {
    await rm(imagesDst, { force: true, recursive: true });
    await mkdir(imagesDst, { recursive: true });
    const imageEntries = await readdir(imagesSrc, { withFileTypes: true });
    for (const entry of imageEntries) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        await copyFile(join(imagesSrc, entry.name), join(imagesDst, entry.name));
      }
    }
  }

  // 7. video-analyses.json
  console.log('Copiando video-analyses.json...');
  await copyFile(join(ROOT, 'video-analyses.json'), join(DIST, 'video-analyses.json'));

  console.log('Build finalizado.');
  console.log('Los archivos se encuentran en la carpeta dist/.');
  console.log('Archivos omitidos (no se despliegan):');
  for (const ignore of IGNORE) {
    console.log('  -', ignore);
  }
}

main().catch(err => {
  console.error('Error en el build:', err);
  process.exit(1);
});