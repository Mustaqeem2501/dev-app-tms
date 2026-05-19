const db = require("../config/db");

async function executeQuery(query)
{
    const promiseDB = db.promise();

    try
    {
        const [results] = await promiseDB.query(query);

        return {results};
    }
    catch(error)
    {
        throw error;
    }
    finally
    {
        await promiseDB.end();
    }
}

module.exports = {executeQuery};