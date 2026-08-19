// Normalizes page/limit query params into safe integers.
const getPaginationParams = (query) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = 10;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// Builds a WHERE clause fragment for the is_active filter.
// columnName lets department_master pass "IsActive" while others pass is_active.
const buildIsActiveClause = (is_active, columnName = 'is_active') => {
  if (is_active === 'true') return ` WHERE ${columnName} = TRUE`;
  if (is_active === 'false') return ` WHERE ${columnName} = FALSE`;
  return '';
};

module.exports = { getPaginationParams, buildIsActiveClause };