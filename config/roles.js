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
    'createFranchiseeUser'
  ],
  admin: [
    'createFranchisorInfo',
    'createFranchiseeUser',
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
