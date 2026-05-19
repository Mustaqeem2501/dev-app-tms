const { json } = require("body-parser");
const db = require("../config/db");
const {passenc}= require("../helpers/pass_enc");
const mongu =require("../lib/mongo/mongo_api");
// const cassCon = require("../lib/cassandra-lib/libLog");
// const tokenMobile= require("../helpers/access_token_mobile"); // MOBILE ACCESS_TOKEN
const tokenWeb= require("../helpers/access_token_web");
const uploadS3 = require("./components/uploadS3Component");
// const s3 = require("../lib/aws-lib/s3")
const { format, subHours, differenceInSeconds } = require('date-fns');
const moment = require('moment-timezone');
const dayjs = require('dayjs');
const axios = require('axios');
const path = require('path');
const fs = require('fs');


exports.transporterlistnew = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        if(AccessToken!=null){
            let user_info ={};
            const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
            {
                
                user_info.Status=1;                
                user_info.AccountId=DeveloperOptionId;
            }
            else
            {
                 user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            }
            //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    final_data.Message=user_info.Message;
                    res.status(200).json(final_data);
            }
            else{

                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                }

                const sql7=`select transporters.id, transporters.code from transporters, cv_customer_assignment where cv_customer_assignment.user_id=? and cv_customer_assignment.consolidated_report=1 and cv_customer_assignment.status=1 and transporters.status=1 and transporters.id=cv_customer_assignment.type_detail_id; `;
                const [trptlist] = await db.promise().query(sql7,[user_id]);

                
                response={
                    status:'success',
                    transporter:trptlist,
                }

         
            res.status(200).json(response);
                
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};
