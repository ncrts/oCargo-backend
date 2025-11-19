const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { roleRights } = require('../../config/roles');


const accessUser = (accessRoleRights) => (req, res, next) => {
    if (accessRoleRights) {
        // Determine user type: player, franchisorUser, or franchiseeUser
        let role;
        
        if (req.player) {
            role = req.player.role;
        } else if (req.franchisorUser) {
            role = req.franchisorUser.role;
        } else if (req.franchiseeUser) {
            role = req.franchiseeUser.role;
        }

        if (!role) {
            return next(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
        }
        const userRights = roleRights.get(role) || [];
        const hasRequiredRights = userRights.includes(accessRoleRights);
        if (!hasRequiredRights) {
            return next(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
        }
    }
    return next();
}

module.exports = accessUser;