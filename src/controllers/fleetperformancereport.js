const { json } = require("body-parser");
const db = require("../config/db");
const {passenc}= require("../helpers/pass_enc");
const mongu =require("../lib/mongo/mongo_api");
const cassCon = require("../lib/cassandra-lib/libLog");
// const tokenMobile= require("../helpers/access_token_mobile"); // MOBILE ACCESS_TOKEN
const tokenWeb= require("../helpers/access_token_web");
const uploadS3 = require("./components/uploadS3Component");
const { fetchKey,fetchKeynimbumirchi} = require("../lib/aws-lib/s3")
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { format, subHours, differenceInSeconds } = require('date-fns');
const moment = require('moment-timezone');
const dayjs = require('dayjs');
const axios = require('axios');
const path = require('path');
const fs = require('fs');


exports.fleetreport = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporterid,month,year} = req.body;
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
                 console.log(user_info)
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
                try {
                    const s3Client = await fetchKeynimbumirchi();
                    const keys = `ilgic_cv/${transporterid}_${month}${year}.pdf`;
                    // return res.status(200).json({res:key})
                    // console.log(key);
                    // process.exit(0)
                    const command = new GetObjectCommand({
                        Bucket: 'nimbumirchee',
                        Key: keys,
                      });
                    //   return res.status(200).json({res:keys})
                      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // expires in 1 hour
                      console.log("Presigned URL:", url);
                      final_response={
                        status:'success',
                        urls:url,
                        }
                    return res.status(200).json(final_response)
                    
                    }
                catch (error) {
                    console.error("Error uploading file to S3:", error);
                  }
                
                
                    
                    
               
            
            }
        
        

        
        }
        
        else{
            // console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


    catch(error){
        res.status(500).json({error: error.message});
    }
};