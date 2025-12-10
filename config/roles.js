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
    'bulkInsertBadges',
    'getFranchisorInfoList',
    'createFranchiseeInfo',
    'updateFranchiseeInfo',
    'getFranchiseeInfoList',
    'updateFranchiseeUser',
    'getFranchiseeUser',
    'getFranchiseeUsersList',
    'deleteFranchiseeUser',
    'manageCms'
  ],
  admin: [
    'createFranchisorInfo',
    'createFranchiseeUser',
    'bulkInsertXpRules',
    'bulkInsertBadges',
    'createFranchisorUser',
    'updateFranchisorUser',
    'getFranchisorUser',
    'getFranchisorUsersList',
    'createFranchiseeInfo',
    'updateFranchiseeInfo',
    'getFranchiseeInfoList',
    'updateFranchiseeUser',
    'getFranchiseeUser',
    'getFranchiseeUsersList',
    'deleteFranchiseeUser',
    'deleteFranchisorUser',
    'bulkInsertBadgeMasters',
    'manageCms'
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
