// const mongu = require("../helpers/mongu");
const mongu = require("../lib/mongo/mongo_api");

exports.searchComplainNo = async (searchValue) => {

    const table = "cms_complains";

    const conditions = {
        complain_no: {
            $regex: searchValue,
            $options: "i"
        }
    };

    const options = {
        projection: {
            complain_no: 1
        },
        sort: {
            complain_no: 1
        }
    };

    return await mongu.getMongoCMSQuery(
        conditions,
        options,
        table
    );
};