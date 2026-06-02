function getDepartmentActivities(options) {
  options = options || {};
  const rows = sheetRowsToObjects_(getSheet_(SHEET_NAMES.DEPARTMENT_ACTIVITIES));
  return rows.filter(function(row) {
    return options.includeInactive || toBoolean_(row.is_active);
  }).sort(function(a, b) {
    return String(a.department_name).localeCompare(String(b.department_name)) || String(a.activity_name).localeCompare(String(b.activity_name));
  });
}

function getAssignedActivitiesForDepartment(departmentId) {
  if (!departmentId) return [];
  return getDepartmentActivities({ includeInactive: false }).filter(function(mapping) {
    return String(mapping.department_id) === String(departmentId);
  });
}

function getActivitiesByDepartment(departmentId) {
  if (!departmentId) return [];
  Logger.log('getActivitiesByDepartment called for department_id=' + departmentId);
  const activeMappings = getAssignedActivitiesForDepartment(departmentId);
  const activeActivitiesById = getActivities({ includeInactive: false }).reduce(function(map, activity) {
    map[String(activity.activity_id)] = activity;
    return map;
  }, {});
  const activeFactorsById = getEmissionFactors({ includeInactive: false }).reduce(function(map, factor) {
    map[String(factor.factor_id)] = factor;
    return map;
  }, {});
  const seen = {};
  const activities = activeMappings.map(function(mapping) {
    return activeActivitiesById[String(mapping.activity_id)];
  }).filter(function(activity) {
    if (!activity || seen[String(activity.activity_id)]) return false;
    seen[String(activity.activity_id)] = true;
    return true;
  }).map(function(activity) {
    const factor = activeFactorsById[String(activity.default_factor_id)];
    if (!factor) return null;
    return buildActivityWithFactor_(activity, factor);
  }).filter(Boolean);
  Logger.log('getActivitiesByDepartment returning ' + activities.length + ' active activities for department_id=' + departmentId);
  return activities;
}

function buildActivityWithFactor_(activity, factor) {
  return {
    activity_id: activity.activity_id,
    activity_name: activity.activity_name,
    group: activity.group,
    scope: activity.scope,
    category: activity.category,
    unit: activity.unit,
    factor_id: factor.factor_id,
    factor_name: factor.factor_name,
    default_factor_id: activity.default_factor_id,
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
}

function saveDepartmentActivity(mapping) {
  mapping = mapping || {};
  requireFields_(mapping, ['department_id', 'activity_id']);
  const department = getDepartments({ includeInactive: true }).find(function(item) {
    return String(item.department_id) === String(mapping.department_id);
  });
  if (!department) throw new Error('Department not found.');
  const activity = getActivityById_(mapping.activity_id, true);

  const existing = getDepartmentActivities({ includeInactive: true }).find(function(item) {
    return String(item.department_id) === String(department.department_id) && String(item.activity_id) === String(activity.activity_id);
  });
  if (existing) {
    return updateDepartmentActivity({
      department_activity_id: existing.department_activity_id,
      department_id: department.department_id,
      activity_id: activity.activity_id,
      is_active: true
    });
  }

  const now = nowIso_();
  const payload = {
    department_activity_id: mapping.department_activity_id || generateId_('DA'),
    department_id: department.department_id,
    department_name: department.department_name,
    activity_id: activity.activity_id,
    activity_name: activity.activity_name,
    is_active: mapping.is_active === undefined ? true : toBoolean_(mapping.is_active),
    created_at: now,
    updated_at: now
  };
  appendObjectRow_(getSheet_(SHEET_NAMES.DEPARTMENT_ACTIVITIES), payload);
  return payload;
}

function updateDepartmentActivity(mapping) {
  mapping = mapping || {};
  requireFields_(mapping, ['department_activity_id', 'department_id', 'activity_id']);
  const found = findRowById_(SHEET_NAMES.DEPARTMENT_ACTIVITIES, 'department_activity_id', mapping.department_activity_id);
  const department = getDepartments({ includeInactive: true }).find(function(item) {
    return String(item.department_id) === String(mapping.department_id);
  });
  if (!department) throw new Error('Department not found.');
  const activity = getActivityById_(mapping.activity_id, true);
  const payload = {
    department_activity_id: mapping.department_activity_id,
    department_id: department.department_id,
    department_name: department.department_name,
    activity_id: activity.activity_id,
    activity_name: activity.activity_name,
    is_active: mapping.is_active === undefined ? found.row.is_active : toBoolean_(mapping.is_active),
    updated_at: nowIso_()
  };
  updateObjectRow_(found.sheet, found.rowNumber, payload);
  return Object.assign({}, found.row, payload);
}

function saveDepartmentActivityAssignments(departmentId, activityIds) {
  if (!departmentId) throw new Error('department_id is required.');
  activityIds = activityIds || [];
  const department = getDepartments({ includeInactive: true }).find(function(item) {
    return String(item.department_id) === String(departmentId);
  });
  if (!department) throw new Error('Department not found.');
  const selected = activityIds.reduce(function(map, activityId) {
    map[String(activityId)] = true;
    return map;
  }, {});
  const current = getDepartmentActivities({ includeInactive: true }).filter(function(mapping) {
    return String(mapping.department_id) === String(departmentId);
  });
  current.forEach(function(mapping) {
    if (!mapping.activity_id) {
      deactivateDepartmentActivity(mapping.department_activity_id);
      return;
    }
    const shouldBeActive = !!selected[String(mapping.activity_id)];
    updateDepartmentActivity({
      department_activity_id: mapping.department_activity_id,
      department_id: departmentId,
      activity_id: mapping.activity_id,
      is_active: shouldBeActive
    });
    delete selected[String(mapping.activity_id)];
  });
  Object.keys(selected).forEach(function(activityId) {
    saveDepartmentActivity({ department_id: departmentId, activity_id: activityId, is_active: true });
  });
  return getAssignedActivitiesForDepartment(departmentId);
}

function deactivateDepartmentActivity(departmentActivityId) {
  const found = findRowById_(SHEET_NAMES.DEPARTMENT_ACTIVITIES, 'department_activity_id', departmentActivityId);
  updateObjectRow_(found.sheet, found.rowNumber, { is_active: false, updated_at: nowIso_() });
  return { success: true };
}
