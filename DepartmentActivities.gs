function getDepartmentActivities(options) {
  options = options || {};
  const rows = sheetRowsToObjects_(getSheet_(SHEET_NAMES.DEPARTMENT_ACTIVITIES));
  return rows.filter(function(row) {
    return options.includeInactive || toBoolean_(row.is_active);
  }).sort(function(a, b) {
    return String(a.department_name).localeCompare(String(b.department_name)) || String(a.activity_name).localeCompare(String(b.activity_name));
  });
}

function getActivitiesByDepartment(departmentId) {
  if (!departmentId) return [];
  Logger.log('getActivitiesByDepartment called for department_id=' + departmentId);
  const activeMappings = getDepartmentActivities({ includeInactive: false }).filter(function(mapping) {
    return String(mapping.department_id) === String(departmentId);
  });
  const activeFactorsById = getEmissionFactors({ includeInactive: false }).reduce(function(map, factor) {
    map[String(factor.factor_id)] = factor;
    return map;
  }, {});
  const seen = {};
  const factors = activeMappings.map(function(mapping) {
    return activeFactorsById[String(mapping.factor_id)];
  }).filter(function(factor) {
    if (!factor || seen[String(factor.factor_id)]) return false;
    seen[String(factor.factor_id)] = true;
    return true;
  }).map(function(factor) {
    return {
      factor_id: factor.factor_id,
      activity_name: factor.activity_name,
      activity_group: factor.activity_group,
      scope: factor.scope,
      category: factor.category,
      unit: factor.unit,
      co2_factor: factor.co2_factor,
      fossil_ch4_factor: factor.fossil_ch4_factor,
      ch4_factor: factor.ch4_factor,
      n2o_factor: factor.n2o_factor,
      total_co2e_factor: factor.total_co2e_factor,
      total_co2e_unit: factor.total_co2e_unit,
      factor_source: factor.factor_source,
      factor_year: factor.factor_year,
      gwp_version: factor.gwp_version
    };
  });
  Logger.log('getActivitiesByDepartment returning ' + factors.length + ' active activities for department_id=' + departmentId);
  return factors;
}

function saveDepartmentActivity(mapping) {
  mapping = mapping || {};
  requireFields_(mapping, ['department_id', 'factor_id']);
  const department = getDepartments({ includeInactive: true }).find(function(item) {
    return String(item.department_id) === String(mapping.department_id);
  });
  if (!department) throw new Error('Department not found.');
  const factor = getEmissionFactors({ includeInactive: true }).find(function(item) {
    return String(item.factor_id) === String(mapping.factor_id);
  });
  if (!factor) throw new Error('Emission factor not found.');

  const existing = getDepartmentActivities({ includeInactive: true }).find(function(item) {
    return String(item.department_id) === String(department.department_id) && String(item.factor_id) === String(factor.factor_id);
  });
  if (existing) {
    return updateDepartmentActivity({
      department_activity_id: existing.department_activity_id,
      department_id: department.department_id,
      factor_id: factor.factor_id,
      is_active: true
    });
  }

  const now = nowIso_();
  const payload = {
    department_activity_id: mapping.department_activity_id || generateId_('DA'),
    department_id: department.department_id,
    department_name: department.department_name,
    factor_id: factor.factor_id,
    activity_name: factor.activity_name,
    is_active: mapping.is_active === undefined ? true : toBoolean_(mapping.is_active),
    created_at: now,
    updated_at: now
  };
  appendObjectRow_(getSheet_(SHEET_NAMES.DEPARTMENT_ACTIVITIES), payload);
  return payload;
}

function updateDepartmentActivity(mapping) {
  mapping = mapping || {};
  requireFields_(mapping, ['department_activity_id', 'department_id', 'factor_id']);
  const found = findRowById_(SHEET_NAMES.DEPARTMENT_ACTIVITIES, 'department_activity_id', mapping.department_activity_id);
  const department = getDepartments({ includeInactive: true }).find(function(item) {
    return String(item.department_id) === String(mapping.department_id);
  });
  if (!department) throw new Error('Department not found.');
  const factor = getEmissionFactors({ includeInactive: true }).find(function(item) {
    return String(item.factor_id) === String(mapping.factor_id);
  });
  if (!factor) throw new Error('Emission factor not found.');
  const payload = {
    department_activity_id: mapping.department_activity_id,
    department_id: department.department_id,
    department_name: department.department_name,
    factor_id: factor.factor_id,
    activity_name: factor.activity_name,
    is_active: mapping.is_active === undefined ? found.row.is_active : toBoolean_(mapping.is_active),
    updated_at: nowIso_()
  };
  updateObjectRow_(found.sheet, found.rowNumber, payload);
  return Object.assign({}, found.row, payload);
}

function deactivateDepartmentActivity(departmentActivityId) {
  const found = findRowById_(SHEET_NAMES.DEPARTMENT_ACTIVITIES, 'department_activity_id', departmentActivityId);
  updateObjectRow_(found.sheet, found.rowNumber, { is_active: false, updated_at: nowIso_() });
  return { success: true };
}
