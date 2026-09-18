function buildMaintenanceRow_(requestId, type, data, evidence, maintenanceId) {
  var source = resolveProcess_(data.source_entity), targetEntity = resolveProcess_(data.target_entity), sourceParts = splitProcessVariant_(source);
  var targetParts = splitProcessVariant_(targetEntity);
  if (type.flow_key === 'maint_move_variant' && sourceParts.variant && targetEntity && targetEntity.level === 'N4') targetParts = { process: targetEntity, variant: sourceParts.variant };
  if (type.flow_key === 'maint_new_variant') targetParts = { process: sourceParts.process, variant: { taxonomy: data.new_variant_taxonomy || '', name: data.target_name || '', description: data.same_as_n4_description ? (sourceParts.process && sourceParts.process.description || '') : (data.target_description || ''), process_owner_name: ownerLabel_(data.new_owner) } };
  if (!targetParts.process && sourceParts.process && (type.flow_key === 'maint_n4' || type.flow_key === 'maint_variant' || type.flow_key === 'maint_owner')) targetParts = { process: sourceParts.process, variant: sourceParts.variant };
  maintenanceId = maintenanceId || ('MNT-' + Utilities.getUuid());
  var requested = { ownerScope: data.owner_scope || '', newOwnerId: data.new_owner || '', newOwnerName: ownerLabel_(data.new_owner), targetName: data.target_name || '', targetDescription: data.target_description || '', newVariantTaxonomy: data.new_variant_taxonomy || '', reason: data.reason || '', comment: data.comment || '', mergeEntities: data.merge_entities || [] };
  var mergedSnapshots = (data.merge_entities || []).map(function(id) { return resolveProcess_(id); }).filter(function(item) { return !!item; });
  var sourceSnapshot = mergedSnapshots.length ? mergedSnapshots : (source || {}), sp = sourceParts.process || {}, sv = sourceParts.variant || {}, tp = targetParts.process || {}, tv = targetParts.variant || {};
  var targetProcessName = tp.name || '', targetProcessDescription = tp.description || '';
  var targetVariantName = tv.name || '', targetVariantDescription = tv.description || '';
  if (type.flow_key === 'maint_n4') {
    if (data.change_name) targetProcessName = data.target_name;
    if (data.change_description) targetProcessDescription = data.target_description;
  }
  if (type.flow_key === 'maint_variant') {
    if (data.change_name) targetVariantName = data.target_name;
    if (data.change_description) targetVariantDescription = data.target_description;
  }
  var row = [maintenanceId, requestId, new Date(), type.label,
    sp.process_id || '', sp.taxonomy || '', sp.name || '', sp.description || '',
    sv.process_id || '', sv.taxonomy || '', sv.name || '', sv.description || '', (sv.process_owner_name || sp.process_owner_name || ''),
    tp.process_id || '', tp.taxonomy || '', targetProcessName, targetProcessDescription,
    tv.process_id || '', tv.taxonomy || '', targetVariantName, targetVariantDescription, ownerLabel_(data.new_owner) || tv.process_owner_name || tp.process_owner_name || '',
    JSON.stringify(sourceSnapshot), JSON.stringify(requested), data.is_process_owner === 'yes' ? 'La persona solicitante declaró o verificó ser Process Owner.' : '', (evidence.links || []).join('\n'), data.reason || ''
  ];
  return { maintenanceId: maintenanceId, row: row };
}

function ownerLabel_(ownerId) {
  if (!ownerId) return '';
  if (ownerId === 'unassigned') return 'Por asignar';
  var owner = resolveUser_(ownerId);
  return owner ? owner.full_name : ownerId;
}

function splitProcessVariant_(entity) {
  if (!entity) return { process: null, variant: null };
  if (entity.level === 'N5') return { process: resolveProcess_(entity.parent_process_id), variant: entity };
  return { process: entity, variant: null };
}
