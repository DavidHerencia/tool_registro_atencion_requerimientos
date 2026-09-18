var CATALOG_RUNTIME_CACHE_ = {};
var CATALOG_RUNTIME_CACHE_MS_ = 15000;

function getCatalogRows_(sheetName) {
  var cached = CATALOG_RUNTIME_CACHE_[sheetName];
  if (cached && Date.now() - cached.loadedAt < CATALOG_RUNTIME_CACHE_MS_) return cached.rows;
  var rows = sheetObjects_(getAppSpreadsheet_().getSheetByName(sheetName));
  CATALOG_RUNTIME_CACHE_[sheetName] = { loadedAt: Date.now(), rows: rows };
  return rows;
}

function searchCatalog(kind, query, options) {
  query = String(query || '').trim().toLowerCase();
  options = options || {};
  if (query.length < 2) return [];
  var settings = getPublishedConfiguration().settings;
  var limit = Math.min(Number(options.limit || settings.max_catalog_results || 12), 25);
  var name = kind === 'users' ? SHEETS.USERS : SHEETS.PROCESSES;
  var searchable = kind === 'users' ? ['p_registro', 'full_name', 'email'] : ['taxonomy', 'name', 'description'];
  var catalogRows = getCatalogRows_(name);
  var rows = catalogRows.filter(function(row) {
    return asBool_(row.active) && searchable.some(function(key) { return String(row[key] || '').toLowerCase().indexOf(query) !== -1; });
  });
  if (kind === 'processes' && options.level) rows = rows.filter(function(row) { return row.level === options.level; });
  return rows.slice(0, limit).map(function(row) {
    return kind === 'users'
      ? { id: row.user_id, label: row.full_name + ' (' + row.p_registro + ')', subtitle: row.email, entity: row }
      : { id: row.process_id, label: row.taxonomy + ' | ' + row.name, subtitle: row.level + ' | ' + row.description, entity: enrichProcessContext_(row, catalogRows) };
  });
}

function enrichProcessContext_(row, allRows) {
  var entity = {};
  Object.keys(row).forEach(function(key) { entity[key] = row[key]; });
  if (row.level === 'N5') {
    var parent = allRows.filter(function(candidate) { return candidate.process_id === row.parent_process_id; })[0];
    if (parent) entity.parent = { process_id: parent.process_id, taxonomy: parent.taxonomy, name: parent.name, process_owner_name: parent.process_owner_name };
  } else if (row.level === 'N4') {
    entity.related_variants = allRows.filter(function(candidate) {
      return candidate.parent_process_id === row.process_id && candidate.process_owner_id === row.process_owner_id && asBool_(candidate.active);
    }).slice(0, 10).map(function(candidate) { return { taxonomy: candidate.taxonomy, name: candidate.name }; });
  }
  return entity;
}

function getProcessChildren(processId, page) {
  page = Math.max(1, Number(page || 1));
  var all = getCatalogRows_(SHEETS.PROCESSES).filter(function(row) { return asBool_(row.active) && row.parent_process_id === processId; });
  var start = (page - 1) * 10;
  return { items: all.slice(start, start + 10), page: page, total: all.length, hasPrevious: page > 1, hasNext: start + 10 < all.length };
}

function getTeamContacts(topic) {
  var keywords = { aris: 'ARIS', maturity: 'Madurez', governance: 'Gobierno de procesos' };
  var keyword = keywords[topic] || '';
  return getCatalogRows_(SHEETS.TEAM).filter(function(row) { return asBool_(row.active) && (!keyword || String(row.specialty).indexOf(keyword) !== -1); });
}
