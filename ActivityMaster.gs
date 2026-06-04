function getActivities(options) {
  options = options || {};
  const term = String(options.search || '').toLowerCase();
  return sheetRowsToObjects_(getSheet_(SHEET_NAMES.ACTIVITIES)).filter(function(row) {
    const activeMatch = options.includeInactive || toBoolean_(row.is_active);
    const termMatch = !term || [row.activity_name, row.group, row.scope, row.category, row.unit].join(' ').toLowerCase().indexOf(term) !== -1;
    return activeMatch && termMatch;
  }).sort(function(a, b) { return String(a.activity_name).localeCompare(String(b.activity_name)); });
}

function buildActivityPayload_(data, existing) {
  data = data || {};
  requireFields_(data, ['activity_name', 'group', 'scope', 'category', 'unit', 'default_factor_id']);
  const factor = getFactorById(data.default_factor_id);
  if (!toBoolean_(factor.is_active)) throw new Error('default_factor_id must reference an active emission factor.');
  const now = nowIso_();
  return {
    activity_id: data.activity_id || generateId_('A'),
    activity_name: String(data.activity_name).trim(),
    group: data.group || '',
    scope: data.scope || '',
    category: data.category || '',
    unit: data.unit || '',
    default_factor_id: factor.factor_id,
    is_active: data.is_active === undefined ? true : toBoolean_(data.is_active),
    created_at: existing ? existing.created_at : now,
    updated_at: now
  };
}

function saveActivity(data) {
  const payload = buildActivityPayload_(data);
  appendObjectRow_(getSheet_(SHEET_NAMES.ACTIVITIES), payload);
  return payload;
}

function updateActivity(data) {
  data = data || {};
  requireFields_(data, ['activity_id']);
  const found = findRowById_(SHEET_NAMES.ACTIVITIES, 'activity_id', data.activity_id);
  const payload = buildActivityPayload_(data, found.row);
  updateObjectRow_(found.sheet, found.rowNumber, payload);
  return payload;
}

function deactivateActivity(activityId) {
  const found = findRowById_(SHEET_NAMES.ACTIVITIES, 'activity_id', activityId);
  updateObjectRow_(found.sheet, found.rowNumber, { is_active: false, updated_at: nowIso_() });
  return { success: true };
}

function getActivityById_(activityId, includeInactive) {
  const activity = getActivities({ includeInactive: includeInactive !== false }).find(function(item) {
    return String(item.activity_id) === String(activityId);
  });
  if (!activity) throw new Error('Activity not found: ' + activityId);
  return activity;
}
