/** Shared loaders for the node tests (data files are read once per process). */
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {decodeDataset, setProvinces} from '../js/model.js';
import {buildAreaIndex, attachFrames} from '../js/areas.js';
import {decodeLearning} from '../js/learning.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
export const readJSON = path => { if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(join(ROOT, path), 'utf8'))); return cache.get(path); };
export const readBytes = path => readFileSync(join(ROOT, path));
export const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
export const frameFiles = () => readdirSync(join(ROOT, 'data/frames')).filter(f => f.endsWith('.json')).sort();

let loaded = null;
/** The shipped data set, decoded exactly as the browser does (outlines attached only when asked). */
export function load({frames = []} = {}) {
  if (!loaded) {
    const indexJSON = readJSON('data/area-index.json'), provincesGeo = readJSON('data/provinces.geojson');
    setProvinces(indexJSON.provinces);
    const index = buildAreaIndex(indexJSON);
    const raw = readJSON('data/schools.json');
    const data = decodeDataset(raw, index);
    loaded = {raw, data, index, indexJSON, provincesGeo};
  }
  for (const code of frames) attachFrames(loaded.index, readJSON(`data/frames/${code}.json`));
  return loaded;
}

let learning = null;
/** The learning-service layer (0.2.0), decoded as the browser does (stations from data/schools.json). */
export function loadLearning() {
  if (!learning) {
    const {data, index} = load();
    const raw = readJSON('data/learning.json');
    learning = {learningRaw: raw, learning: decodeLearning(raw, index, new Map(data.stations.map(s => [s.id, s])))};
  }
  return {...load(), ...learning};
}
