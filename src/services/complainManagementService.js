// const { validateUser } = require("../helpers/commonFunctions");

// const userModel = require("../models/userModel");
// const complainModel = require("../models/complainModel");

// exports.searchComplainNo = async (body) => {

//     try {

//         let complainNo = {};

//         const { searchValue } = body;

//         // validate user
//         const validatedUser = await validateUser(body);

//         if (!validatedUser.status) {
//             return {
//                 status: "fail",
//                 message: validatedUser.message
//             };
//         }

//         // get user
//         const user = await userModel.getUserById(
//             validatedUser.userId
//         );

//         if (!user) {
//             return {
//                 status: "fail",
//                 message: "Invalid User"
//             };
//         }

//         // get complain list
//         const complainNoResponse =
//             await complainModel.searchComplainNo(searchValue);

//         complainNoResponse.forEach(element => {

//             if (element.complain_no) {

//                 complainNo[element.complain_no] =
//                     element.complain_no;
//             }
//         });

//         return {
//             status: "success",
//             message: "Data Fetched Successfully",
//             data: complainNo
//         };

//     } catch (error) {

//         throw error;
//     }
// };

const { validateUser } = require("../helpers/commonFunctions");

const userModel = require("../models/userModel");
const complainModel = require("../models/complainModel");

exports.searchComplainNo = async (body) => {

    try {

        let complainNo = {};

        const {
            searchValue,
            AccessToken
        } = body;

        // payload validation
        if (!AccessToken) {

            return {
                status: "fail",
                statusCode: 400,
                message: "AccessToken is required"
            };
        }

        if (!searchValue) {

            return {
                status: "fail",
                statusCode: 400,
                message: "searchValue is required"
            };
        }

        // validate user
        const validatedUser = await validateUser(body);
        // return(validatedUser);
        if (!validatedUser.status) {

            return {
                status: "fail",
                statusCode: 401,
                message: validatedUser.message
            };
        }

        // get user
        const user = await userModel.getUserById(
            validatedUser.userId
        );

        if (!user) {

            return {
                status: "fail",
                statusCode: 404,
                message: "Invalid User"
            };
        }

        // mongo query
        const complainNoResponse =
        await complainModel.searchComplainNo(
            searchValue
        );

        complainNoResponse.forEach(element => {

            if (element.complain_no) {

                complainNo[element.complain_no] =
                element.complain_no;
            }
        });

        return {
            status: "success",
            statusCode: 200,
            message: "Data Fetched Successfully",
            data: complainNo
        };

    } catch (error) {

        console.log(error);

        return {
            status: "fail",
            statusCode: 500,
            message: error.message
        };
    }
};