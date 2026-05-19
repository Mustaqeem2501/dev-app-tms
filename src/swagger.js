// const swaggerJsdoc = require("swagger-jsdoc");
// const swaggerUi = require("swagger-ui-express");

// const options = {

//     definition: {

//         openapi: "3.0.0",

//         info: {
//             title: "TMS API's",
//             version: "1.0.0",
//             description:
//             "TMS Backend APIs Documentation",
//         },

//         servers: [
//             {
//                 url: "https://apinode2.secutrak.in/dev-app-tms"
//             }
//         ],
//     },

//     apis: ["./src/routes/*.js"],
// };

// const swaggerSpec =
// swaggerJsdoc(options);

// module.exports = {
//     swaggerUi,
//     swaggerSpec,
// };

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const path = require("path");

const options = {

    definition: {

        openapi: "3.0.0",

        info: {
            title: "TMS API's",
            version: "1.0.0",
            description:
            "TMS Backend APIs Documentation",
        },

        servers: [
            {
                url: "https://apinode2.secutrak.in/dev-app-tms/complainManagment",
            },
        ],
    },

    apis: [
        path.join(
            __dirname,
            "./routes/*.js"
        )
    ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
    swaggerUi,
    swaggerSpec,
};