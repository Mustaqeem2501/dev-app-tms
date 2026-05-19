const db = require("../config/db");

exports.getUserById = async (userId) => {

    const [result] = await db.promise().query(
        `SELECT id, user_type, name, group_type, group_id
         FROM user
         WHERE id=? AND status=1`,
        [userId]
    );

    return result.length ? result[0] : null;
};