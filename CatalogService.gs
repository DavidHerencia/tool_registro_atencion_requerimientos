var CATALOG_RUNTIME_CACHE_ = {};
var CATALOG_RUNTIME_CACHE_MS_ = 15000;

function getCatalogRows_(sheetName) {
  var cached = CATALOG_RUNTIME_CACHE_[sheetName];
  if (cached && Date.now() - cached.loadedAt < CATALOG_RUNTIME_CACHE_MS_) return cached.rows;
  var rows = sheetObjects_(getAppSpreadsheet_().getSheetByName(sheetName));
  CATALOG_RUNTIME_CACHE_[sheetName] = { loadedAt: Date.now(), rows: rows };
  return rows;
}
