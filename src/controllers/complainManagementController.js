const complainManagementService = require("../services/complainManagementService");

/*  ----------------------------------------------
    | Case                         | HTTP Status |
    | ---------------------------- | ----------- |
    | Success                      | 200         |
    | Created                      | 201         |
    | Payload Missing              | 400         |
    | Invalid Token / Unauthorized | 401         |
    | Forbidden Access             | 403         |
    | Data Not Found               | 404         |
    | Validation Error             | 422         |
    | Internal Error               | 500         |
    ----------------------------------------------
*/

const searchComplainNo = async (req, res) => {

    try {

        const response = await complainManagementService.searchComplainNo(req.body);
        // console.log(response);process.exit(0);
        // return res.status(200).json(response);
        // return res.status( response.statusCode || 200 ).json(response);

        return res.status( response.statusCode || 500 ).json(response);

    } catch (error) {

        return res.status(500).json({ status: "fail", message: error.message });
    }
};



module.exports = {
    searchComplainNo
};