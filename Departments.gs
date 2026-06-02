function getDepartments(options) {
  options = options || {};
  const rows = sheetRowsToObjects_(getSheet_(SHEET_NAMES.DEPARTMENTS));
  return rows.filter(function(row) { return options.includeInactive || toBoolean_(row.is_active); })
    .sort(function(a, b) { return String(a.department_name).localeCompare(String(b.department_name)); });
}

function saveDepartment(data) {
  data = data || {};
  requireFields_(data, ['department_name']);
  const now = nowIso_();
  const payload = {
    department_id: data.department_id || generateId_('D'),
    department_name: String(data.department_name).trim(),
    description: data.description || '',
    is_active: data.is_active === undefined ? true : toBoolean_(data.is_active),
    created_at: now,
    updated_at: now
  };
  appendObjectRow_(getSheet_(SHEET_NAMES.DEPARTMENTS), payload);
  return payload;
}

function updateDepartment(data) {
  data = data || {};
  requireFields_(data, ['department_id', 'department_name']);
  const found = findRowById_(SHEET_NAMES.DEPARTMENTS, 'department_id', data.department_id);
  const payload = {
    department_id: data.department_id,
    department_name: String(data.department_name).trim(),
    description: data.description || '',
    is_active: data.is_active === undefined ? found.row.is_active : toBoolean_(data.is_active),
    updated_at: nowIso_()
  };
  updateObjectRow_(found.sheet, found.rowNumber, payload);
  return Object.assign({}, found.row, payload);
}

function deactivateDepartment(departmentId) {
  const found = findRowById_(SHEET_NAMES.DEPARTMENTS, 'department_id', departmentId);
  updateObjectRow_(found.sheet, found.rowNumber, { is_active: false, updated_at: nowIso_() });
  return { success: true };
}
