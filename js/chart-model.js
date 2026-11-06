/**
 * Chart models — every chart describes scopeRows (filters before any area selection) over the same membership as
 * the map (the row's own matched district) and the same measure (students recorded, or schools). Ranking and top-N
 * trimming happen only after every district has been summarised.
 */
import {rankAreas, affsIn} from './profile-model.js';
import {rowValue} from './model.js';

export function buildChartModel(rows, index, groups, {limit = 20, metric = 'students'} = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const ranking = rankAreas(list, index, {metric}).filter(a => a.value > 0);
  const unplaced = list.filter(r => !r.area);
  return {metric, areas: ranking.slice(0, limit), totalAreas: ranking.length, values: ranking.map(a => a.value), groups, totalRows: list.length,
    placedRows: list.length - unplaced.length, unplacedValue: unplaced.reduce((s, r) => s + rowValue(r, metric), 0)};
}

/** District × school group matrix of the measure (equal cells; zero is a measured 0 in this selection). */
export function areaMatrix(model, {areaLimit = 12} = {}) {
  const areas = model.areas.slice(0, areaLimit);
  const groups = model.groups;
  const pos = new Map(groups.map((g, i) => [g.id, i]));
  const cells = areas.flatMap(a => {
    const values = new Array(groups.length).fill(0), counts = new Array(groups.length).fill(0);
    // Learning records (0.2.0): the columns are the services; a record with two services is in both columns.
    if (model.metric === 'learning') { for (const r of a.rows) for (const s of r.services || []) { const i = pos.get(s); if (i >= 0) { values[i]++; counts[i]++; } } }
    else for (const r of a.rows) { values[r.group] += rowValue(r, model.metric); counts[r.group]++; }
    // Students: a cell whose records all have unknown students is unknown, never a measured 0.
    return groups.map(g => ({areaId: a.id, areaName: a.name, groupId: g.id, group: g.index, groupName: g.th, value: values[g.index], count: counts[g.index],
      unknown: model.metric === 'students' && counts[g.index] > 0 && !values[g.index], total: a.value}));
  });
  return {areas, groups, cells, max: Math.max(0, ...cells.map(c => c.value))};
}

/** Affiliations (สังกัด) of the selection ranked by the measure; every affiliation counted, the list cut after ranking. */
export function affRanking(rows, {limit = 20, metric = 'students'} = {}) {
  const all = affsIn(Array.isArray(rows) ? rows : [], Infinity, metric);
  return {affs: all.slice(0, limit), total: all.length};
}
