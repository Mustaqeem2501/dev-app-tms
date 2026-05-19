const axios = require("axios");
const moment = require("moment-timezone");
const crypto = require("crypto");



const testurl ="https://test.zoop.one/api/v1/" 
const APP_ID = "68b9928d9e0d1e0028a6ec21";
const API_KEY = "NXFZM42-T4PM25M-KTK25GW-3XE43CC";
const task_id = crypto.randomUUID();

const headers = {
    "app-id": APP_ID,
    "api-key": API_KEY,
    "Content-Type": "application/json",
};


async function getRCAdvanceData(vehicle_registration_number) {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");

    if (!vehicle_registration_number) {
        throw new Error("Missing required field: vehicle_registration_number");
    }

    const body = {
        mode: "sync",
        data: {
            vehicle_registration_number,
            consent: "Y",
            consent_text: "I hereby declare my consent agreement for fetching my information via ZOOP API."
        },
        task_id: task_id
    };
    // return body;
    try {
        const apiResponse = await axios.post(`${testurl}in/vehicle/rc/advance`, body, { headers });
        // console.log(apiResponse)
        // return apiResponse.data;
        return apiResponse;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}


async function getDLVerificationData(customer_dl_number, name_to_match, customer_dob) {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");

    // Validate required fields
    if (!customer_dl_number || !name_to_match || !customer_dob) {
        throw new Error("Missing required fields: customer_dl_number, name_to_match, customer_dob");
    }

    // Build request payload
    const body = {
        mode: "sync",
        data: {
            customer_dl_number,
            name_to_match,
            customer_dob,
            consent: "Y",
            consent_text: "I hereby declare my consent agreement for fetching my information via ZOOP API."
        },
        task_id: task_id
    };

    try {
        const apiResponse = await axios.post(`${testurl}in/identity/dl/advance`, body, { headers });
        return apiResponse;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}


async function getPANAdvanceData(customer_pan_number, pan_holder_name) {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");

    // Basic input validation
    if (!customer_pan_number || !pan_holder_name) {
        throw new Error("Missing required fields: customer_pan_number, pan_holder_name");
    }

    // Build request body
    const body = {
        mode: "sync",
        data: {
            customer_pan_number,
            pan_holder_name,
            consent: "Y",
            consent_text: "I hereby declare my consent agreement for fetching my information via ZOOP API."
        },
        task_id: task_id
    };

    try {
        const apiResponse = await axios.post(`${testurl}in/identity/pan/advance`, body, { headers });
        return apiResponse;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}

async function getPassportAdvanceData(customer_file_number, name_to_match, customer_dob) {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");

    if (!customer_file_number || !name_to_match || !customer_dob) {
        throw new Error("Missing required fields: customer_file_number, name_to_match, customer_dob");
    }

    const body = {
        mode: "sync",
        data: {
            customer_file_number,
            name_to_match,
            customer_dob,
            consent: "Y",
            consent_text: "I hereby declare my consent agreement for fetching my information via ZOOP API."
        },
        task_id: task_id
    };
    // return body

    try {
        const apiResponse = await axios.post(`${testurl}in/identity/passport/advance`, body, { headers });
        return apiResponse;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}

async function getVoterIdAdvanceData(customer_epic_number, name_to_match) {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");

    if (!customer_epic_number || !name_to_match) {
        throw new Error("Missing required fields: customer_epic_number, name_to_match");
    }

    const body = {
        mode: "sync",
        data: {
            customer_epic_number,
            name_to_match,
            consent: "Y",
            consent_text: "I hereby declare my consent agreement for fetching my information via ZOOP API."
        },
        task_id: task_id
    };

    try {
        const apiResponse = await axios.post(`${testurl}in/identity/voter/advance`, body, { headers });
        return apiResponse;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}





module.exports = { getRCAdvanceData,
    getDLVerificationData,
    getPANAdvanceData,
    getVoterIdAdvanceData,
    getPassportAdvanceData
 };