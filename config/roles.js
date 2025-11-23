const allRoles = {
  client: [
    'demo'
  ],
  manager: [
    'demo'
  ],
  staff: [
    'demo'
  ],
  HqStaff: [
    'createFranchisorInfo',
    'createFranchiseeUser',
    'bulkInsertXpRules',
    'bulkInsertBadges'
  ],
  admin: [
    'createFranchisorInfo',
    'createFranchiseeUser',
    'bulkInsertXpRules',
    'bulkInsertBadges'
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
