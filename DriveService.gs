function collectEvidence_(formData, requestId, ticket, config, evidence, onProgress) {
  if (Array.isArray(evidence)) evidence = { links: [], byField: {} };
  evidence = evidence || { links: [], byField: {} };
  evidence.links = evidence.links || []; evidence.byField = evidence.byField || {};
  ['manager_evidence', 'owner_evidence', 'xml_source'].forEach(function(key) {
    if (evidence.byField[key] && evidence.byField[key].length) return;
    var file = formData[key + '_file'], value = formData[key], link = '';
    if (isNonEmptyBlob_(file)) link = saveBlobToCustody_(file, key, requestId, ticket, config);
    else if (key === 'xml_source' && typeof value === 'string' && value.trim()) link = saveTextXmlToCustody_(value, requestId, ticket, config);
    else if (typeof value === 'string' && /^https?:\/\//i.test(value)) link = copyDriveLinkToCustody_(value, key, requestId, ticket, config);
    if (link) { evidence.byField[key] = [link]; evidence.links.push(link); if (onProgress) onProgress(evidence); }
  });
  return evidence;
}
function isBlob_(value) { return value && typeof value.getBytes === 'function' && typeof value.getName === 'function'; }
function getCustodyFolder_(requestId, ticket, config) {
  var settings = config.settings || {}, root = settings.drive_root_folder_id ? DriveApp.getFolderById(settings.drive_root_folder_id) : DriveApp.getRootFolder();
  var yearName = String(new Date().getFullYear()), yearFolders = root.getFoldersByName(yearName), yearFolder = yearFolders.hasNext() ? yearFolders.next() : root.createFolder(yearName);
  var ticketFolders = yearFolder.getFoldersByName(ticket);
  return ticketFolders.hasNext() ? ticketFolders.next() : yearFolder.createFolder(ticket);
}
function saveBlobToCustody_(blob, key, requestId, ticket, config) {
  var folder = getCustodyFolder_(requestId, ticket, config), name = key + '-' + (blob.getName() || requestId), existing = findCustodyFile_(folder, name);
  return existing ? existing.getUrl() : folder.createFile(blob.copyBlob()).setName(name).getUrl();
}
function saveTextXmlToCustody_(xml, requestId, ticket, config) {
  var folder = getCustodyFolder_(requestId, ticket, config), name = 'xml_source-' + requestId + '.xml', existing = findCustodyFile_(folder, name);
  return existing ? existing.getUrl() : folder.createFile(Utilities.newBlob(xml, 'application/xml', name)).getUrl();
}
function copyDriveLinkToCustody_(url, key, requestId, ticket, config) {
  var match = String(url).match(/[-\w]{25,}/);
  if (!match) return url;
  try {
    var source = DriveApp.getFileById(match[0]), folder = getCustodyFolder_(requestId, ticket, config), name = key + '-' + source.getName(), existing = findCustodyFile_(folder, name);
    return existing ? existing.getUrl() : source.makeCopy(name, folder).getUrl();
  }
  catch (error) { return url; }
}
function findCustodyFile_(folder, name) { var files = folder.getFilesByName(name); return files.hasNext() ? files.next() : null; }
