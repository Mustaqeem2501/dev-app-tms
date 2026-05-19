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
const FormData = require("form-data");


exports.agreementfilter = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
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

                const sql1=`SELECT id, name, code FROM vehicle_types;`;
                const [vehiclerows] = await db.promise().query(sql1);
                const vehicleBodyType = vehiclerows.map(row => ({ id: row.id, name: row.name ,code: row.code}));
                // console.log(vehicleBodyType);
                
               
                const sql2=`select id,name,code from cv_agreement_type;`;
                const [agreetyperows] = await db.promise().query(sql2);
                let agreetypeBodyType = agreetyperows.map(row => ({ id: row.id, name: row.name,code: row.code }));
                agreetypeBodyType = agreetypeBodyType.sort((a, b) => b.id - a.id); 
                // console.log(agreetypeBodyType);

                const sql3=`select id,capacity from vehicle_capacity where status=1;`;
                const [VehCaptyperows] = await db.promise().query(sql3);
                // console.log(VehCaptyperows);
                const VehicleCapacitytypeBodyType = VehCaptyperows.map(row => ({ id: row.id, capacity: row.capacity }));

                const sql4=`select name as activity_type,id from feeder_type_parent where group_id=? and status=1`;
                const [activityrow] = await db.promise().query(sql4,[customer_id]);
                // const activitytype = vehiclerows.map(row => ({ id: row.id, name: row.name ,code: row.code}));
                const sql5=`select id,type,feeder_type_group_id from feeder_type where group_id=? and status=1; `;
                const [routetype] = await db.promise().query(sql5,[customer_id]);
                const groupedData = routetype.reduce((acc, obj) => {
                    const key = obj.feeder_type_group_id;
                    if (!acc[key]) {
                      acc[key] = [];
                    }
                    acc[key].push(obj);
                    return acc;
                  }, {});
                // console.log(groupedData)

                const sql6=`select id, name as branchname , code as reporting_branch  from logistic_customer_master where group_id=? and status=1 `;
                const [branchcode] = await db.promise().query(sql6,[customer_id]);
                // console.log(branchcode)

                // const branchNames = branchcode.map(({ id, branchname }) => ({ id, branchname }));
                const branchNames = branchcode.map(({ id, branchname, reporting_branch }) => ({
                    id,
                    branchname: `${branchname}[${reporting_branch}]`
                }));
                const reportingBranches = branchcode.map(({ id, reporting_branch }) => ({ id, reporting_branch }));


                
                const sql7=`select id,zone_code,zone_name from logistic_zone where group_id=? and status=1 `;
                const [zone] = await db.promise().query(sql7,[customer_id]);

                const sql9=`select id,zone_code,zone_name from logistic_zone where group_id=? and status=1 `;
                const [region] = await db.promise().query(sql7,['0041']);

                const sql8=`SELECT zsa.zone_id, s.id AS state_id, s.name AS state_name, s.code AS state_code FROM logistic_zone_state_assignment zsa JOIN state s ON zsa.state_id = s.id WHERE zsa.group_id = ? `;
                const [state] = await db.promise().query(sql8,['0041']);
                // console.log(state);
                const stategroup = state.reduce((acc, row) => {
                    if (!acc[row.zone_id]) {
                      acc[row.zone_id] = [];
                    }
                    acc[row.zone_id].push({
                        state_id: row.state_id,
                        state_name: row.state_name,
                        state_code: row.state_code
                    });
                    return acc;
                  }, {});
                  
                //   console.log(stategroup);

                
                response={
                    status:'success',
                    activitytype:activityrow,
                    routetype:groupedData,
                    branchNames:branchNames,
                    reportingBranches:reportingBranches,
                    zone:zone,
                    state:stategroup,
                    region:region,
                    vehicleBodyType:vehicleBodyType,
                    agreetypeBodyType:agreetypeBodyType,
                    VehicleCapacitytypeBodyType:VehicleCapacitytypeBodyType,
                }

         
            res.status(200).json(response);
                
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};




exports.agreementupload = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,agreement_data,agreement_mapping_data,userflag,transporter_name,transporter_id} = req.body;
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

                if (!userflag){
                    return res.status(400).json({
                                        status:'fail',
                                        message:"useflag key  not found"
                                    })
                }
                
                
                // return res.status(200).json("resData1")
                const user_id = user_info.AccountId;
                if (!req.files || req.files.length === 0) {
                    const resData = {}
                    resData.message = "File not found";
                    console.log("File Not Found");
                    return res.status(400).json(resData); 
                }
                let t_id = ''
                let creatby = ''
                let transporter_nm = ''

                if (userflag == 1){
                    if (transporter_id){
                    
                            t_id = Number(transporter_id);
                            creatby = "customer"
                    }
                    else{
                        return res.status(400).json({
                                        status:'fail',
                                        message:"transporter id not found"
                                    })
                    }
                }
                else if (userflag == 2){
                    const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                    t_id = qry_t_id[0].type_detail_id;
                    creatby = "transporter"
                }
                else{
                    return res.status(400).json({
                                        status:'fail',
                                        message:"useflag wrong input value"
                                    })

                }
                const filePath = req.files[0].path;
            
                // console.log("trptid",t_id)
                // process.exit()
                
                // console.log(t_id)
                // const creatby = "transporter"
                const agreement_mapping_data1 = JSON.parse(agreement_mapping_data);
                const agreement_data1 = JSON.parse(agreement_data);
                const create_date= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                const code = agreement_data1.agreeemnt_code;
                if (transporter_name){
                    transporter_nm = transporter_name;
                    // console.log(transporter_nm)
                }
                else{
                    return res.status(400).json({
                                        status:'fail',
                                        message:"transporter name not found"
                                    })
                }
                
                // const transporter_nm = transporter_name;
                const transportr_id = t_id;
                const conditionsP = {}
                const fieldsP = { projection: { _id: 0 } };
                conditionsP.agreeemnt_code = code;
                tableP="cv_agreement_transporter_group_mapping"
                // const agreementcheck = []   
                // console.log(conditionsP);  
                const agreementcheck = await  mongu.getCVMongoQuery(conditionsP, fieldsP, tableP)
                // console.log(transportr_id,transporter_nm)
                // process.exit(0)

                if (agreementcheck.length === 0){

                    // return res.status(200).json("resData1")
                    for (const item of agreement_mapping_data1){
                        const aggvehnos = item.vehicleinformation.flatMap((vehicleInfo) =>vehicleInfo.vehicle.vehicle_number)
                        
                        const tableP = "cv_agreement_vehicleinformation"
                        const conditionsP = {}
                        const fieldsP = { projection: { _id: 0,vehicle_no:1 } }
                        conditionsP.vehicle_no = {"$in":aggvehnos}
                        // conditionsP.from_date = {'$gte': item.from_Time, '$lte': item.to_Time};
                        // conditionsP.to_date = {'$gte': item.from_Time, '$lte': item.to_Time};
                        conditionsP.from_date = {'$lte': item.to_Time};
                        conditionsP.to_date = {'$gte': item.from_Time};
                        conditionsP.status = 1;
                        // console.log(conditionsP);
                        // process.exit(0);

                        const vehiclemappingid = await mongu.getCVMongoQuery(conditionsP,fieldsP,tableP)
                        // console.log(vehiclemappingid);
                        if (vehiclemappingid.length >0){

                            const resd ={
                                status:"fail",
                                vehicle:vehiclemappingid,
                                message:"these vehicle already contracted"

                            }
                            return res.status(200).json(resd)

                        }
                        // process.exit(0);
                           
                    }


                    const mAgreeId = await save_agreement_transporter_group_mapping(agreement_data1,create_date,req.files,creatby,transportr_id,filePath,transporter_nm)
                    // return res.status(200).json(mAgreeId)
                    console.log("mAgreeId - ",mAgreeId)
                    for (const mdata of agreement_mapping_data1) {
                        const mvehid = await saveAgreementMappingDetails(mdata, create_date, mAgreeId,agreement_data1);
                        // console.log(data);
                        // const mvehid = "vjdsnvkjds";
                        const agreementvehdata = mdata.vehicleinformation;
                        for (const vehdata of agreementvehdata){
                            // console.log("vehdata",vehdata)
                            const vehdatasubmit = await savevehicleinformation(vehdata,mAgreeId,mvehid,create_date,mdata,agreement_data1)
                            // console.log(vehdatasubmit)
                        }
                      }

                            response={
                                        status:'success',
                                        message:"uploaded successfully"
                                    }
                                    return res.status(200).json(response)
                
                }
                else{
                    const resData1 = {}
                    resData1.status = "fail"
                    resData1.message = "Agreement already exist";
                    // console.log("File Not Found");
                    return res.status(200).json(resData1)

                }
                
                
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};



async function save_agreement_transporter_group_mapping(agreement_data1,create_date,agreemnetfile,creatby,transporter_id,filePath,transporter_name) {

    const bucketName = 'itrackreport';
    const s3Directory = `CV/agreement/upload/files/${agreemnetfile[0].filename}`;
    
    
    try {
        
        // const uploadingResponse = await uploadS3(bucketName, filePath, s3Directory);
        // const s3Url = `https://s3.amazonaws.com/${bucketName}/${s3Directory}/${agreemnetfile[0].filename}`;

        const uploadingResponse = await uploadFileToS3(filePath,s3Directory)
        // console.log("URL - ",uploadingResponse)
        const s3Url = uploadingResponse.url;
        
        

        fs.unlink(filePath, (err) => {
            if (err) {
                console.error("Error deleting file:", err);
            } 
            // else {
            //     console.log("File successfully deleted from server:", filePath);
            // }
        });
        // console.log("Uploading Response:", uploadingResponse, "S3 URL:", s3Url);

        if (uploadingResponse.status === "success"){
            console.log("S3 URL - ",s3Url)
     
        // const customer_id = agreement_data1.assigned_group_id;
        const customer_name = agreement_data1.assigned_group_name; 
        // const create_id = ""; 

        const table = "cv_agreement_transporter_group_mapping";

        const mappingDict = {
            status: 1,
            transporter_id: transporter_id, 
            transporter_name: transporter_name,
            customer_name: customer_name,
            customer_id: agreement_data1.assigned_group_id,
            // assigned_group_name:agreement_data1.assigned_group_name,
            agreeemnt_code: agreement_data1.agreeemnt_code,
            agreement_date: agreement_data1.agreement_date,
            // region_id: agreement_data1.Region.id,
            // region_name: agreement_data1.Region.zone_name,
            // state_id: agreement_data1.State.state_id,
            // state_name: agreement_data1.State.state_name,
            region_id: agreement_data1.Region?.id || null,
            region_name: agreement_data1.Region?.zone_name || null,
            state_id: agreement_data1.State?.state_id || null,
            state_name: agreement_data1.State?.state_name || null,
            number_of_vehicles: parseInt(agreement_data1.total_number_of_vehicles, 10), 
            agreement_documents: s3Url,
            create_date: create_date, 
            create_id: creatby
            };

            // return mappingDict
            tableP="cv_agreement_transporter_group_mapping";
            
            const result = await  mongu.insertCVMongoQuery(mappingDict, tableP)
            const returnid = result._id.$oid
            return returnid
        }
        
        }
        
        catch (error) {
            console.error("Server error:", error);
            res.status(500).json({ error: error.message }); 
        }
    
}

async function uploadFileToS3(tmpFilePath, ad) {
    try {
        // Prepare form data
        
        const form = new FormData();
        form.append("file", fs.createReadStream(tmpFilePath)); // PHP new CURLFILE
        form.append("filepath", ad);
        // Make POST request
        const apires = await axios.post(
            "https://api-py.secutrak.in/api/uploadfiletos3/",
            form,
            {
                headers: {
                    ...form.getHeaders(),
                },
                maxRedirects: 10,
                timeout: 0, // no timeout like in PHP
            }
        );
        
        // Response (like json_decode in PHP)
        const s3_resp = apires.data;
        return s3_resp;
    } catch (error) {
        console.error("Error uploading file:", error.message);
        if (error.apires) {
            console.error("Response:", error.apires.data);
        }
        throw error;
    }
}

async function saveAgreementMappingDetails(infoData, createDate, mAgreeId,agreement_data1) {
    const infoDict = {
        create_date: createDate,
        status: 1,
        m_agreement_mapping_id: mAgreeId,
        vehicle_type_id: infoData.vehicle_type_data.vehicle_type_id ?? "",
        vehicle_type: infoData.vehicle_type_data.vehicle_type ?? "",
        vehicle_capacity_id: infoData.vehicle_capacity_data.vehicle_capacity_id ?? "",
        vehicle_capacity: infoData.vehicle_capacity_data.vehicle_capacity ?? "",
        no_of_Vehicle: parseInt(infoData.no_of_Vehicle, 10), // Convert to integer
        agreement_type_id: infoData.agreement_type_data.agreement_type_id ?? "",
        agreement_type: infoData.agreement_type_data.agreement_type_ ?? "",
        toll_tax: infoData.toll_tax || "", // Use empty string if undefined
        Night_Charges: infoData.Night_Charges || "",
        fuelsurcharge: infoData.FSC || "",
        Night_Time_from: infoData.Night_Time_from || "",
        Night_Time_to: infoData.Night_Time_to || "",
        from_date: infoData.from_Time,
        to_date: infoData.to_Time,
        trip_based: infoData.trip_based ,
        distance_based: infoData.distance_based ,
        hourly_based: infoData.hourly_based ,
        distance_hourly_based: infoData.distance_hourly_based,
        fixedrentperkm:infoData.fixedrentperkm,
        region_id: agreement_data1.Region?.id || null,
        region_name: agreement_data1.Region?.zone_name || null,
        state_id: agreement_data1.State?.state_id || null,
        state_name: agreement_data1.State?.state_name || null,
        fixedrentfreekm:infoData.fixedrentfreekm,

    };

    // return infoDict;
    tableP="cv_agreement_mapping_details";
    const result = await  mongu.insertCVMongoQuery(infoDict, tableP)
        const returnid = result._id.$oid
        return returnid
}

async function savevehicleinformation(vehdata,mAgreeId,mvehid,create_date,infoData,agreement_data1) {
    // const formData = {
    //     agreementmappingid:mAgreeId,
    //     agreementvehiclemappingid:mvehid,
    //     vehicle_id: vehdata.vehicle.id,
    //     vehicle_no: vehdata.vehicle.vehicle_number, 
    //     routetype: vehdata.routetype.type, 
    //     routetype_id: vehdata.routetype.id,
    //     activitytype: vehdata.activitytype.activity_type, 
    //     activitytype_id: vehdata.activitytype.id,
    //     reportingBranches: vehdata.reportingBranches.reporting_branch, 
    //     reportingBranches_id: vehdata.reportingBranches.id,
    //     branchNames: vehdata.branchNames.branchname, 
    //     branchNames_id: vehdata.branchNames.id, 
    //     zone: vehdata.zone.zone_name, 
    //     zone_id: vehdata.zone.id,
    //     reportingTime: vehdata.reportingTime, 
    //     exitTime: vehdata.exitTime, 
    //     workingHours: vehdata.workingHours,
    //     workingDaysMonth: vehdata.workingDays ,
    //     create_date:create_date,
    //     status:1,
    // }
    const formData = {
        agreementmappingid: mAgreeId ,
        agreementvehiclemappingid: mvehid ,
        from_date: infoData.from_Time ?? "",
        to_date: infoData.to_Time ?? "",
        vehicle_id: vehdata?.vehicle?.id ?? "",
        vehicle_no: vehdata?.vehicle?.vehicle_number ?? "", 
        routetype: vehdata?.routetype?.type ?? "", 
        routetype_id: vehdata?.routetype?.id ?? "",
        activitytype: vehdata?.activitytype?.activity_type ?? "", 
        activitytype_id: vehdata?.activitytype?.id ?? "",
        reportingBranches: vehdata?.reportingBranches?.reporting_branch ?? "", 
        reportingBranches_id: vehdata?.reportingBranches?.id ?? "",
        branchNames: vehdata?.branchNames?.branchname ?? "", 
        branchNames_id: vehdata?.branchNames?.id ?? "", 
        zone: vehdata?.zone?.zone_name ?? "", 
        zone_id: vehdata?.zone?.id ?? "",
        reportingTime: vehdata?.reportingTime ?? "", 
        exitTime: vehdata?.exitTime ?? "", 
        workingHours: vehdata?.workingHours ?? "",
        workingDaysMonth: vehdata?.workingDays ?? "",
        create_date: create_date ,
        region_id: agreement_data1.Region?.id || null,
        region_name: agreement_data1.Region?.zone_name || null,
        state_id: agreement_data1.State?.state_id || null,
        state_name: agreement_data1.State?.state_name || null,
        status: 1
    };
    // return formData
    tableP="cv_agreement_vehicleinformation";
    const result = await  mongu.insertCVMongoQuery(formData, tableP)
        const returnid = result._id.$oid
        return returnid
    
}



exports.agreementdetails = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,userflag} = req.body;
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
                
                if (!userflag){
                    return res.status(400).json("useflag key  not found")
                }
                if (!req.body.customer_id){
                    return res.status(400).json("customer_id  not found")

                }
                if (!req.body.transporter_id){
                    return res.status(400).json("transporter_id  not found")

                }


                const user_id = user_info.AccountId;
                let t_id = ''


                if (userflag == 1){
                    t_id = Number(req.body.transporter_id)
                }
                else if (userflag == 2){
                    const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                    t_id = qry_t_id[0].type_detail_id;
                }
                else{
                    return res.status(400).json("useflag key  wrong input")
                }
                

                
                const Option = {}
                // if(req.body.customer_id){
                //     conditionsP.customer_id = req.body.customer_id;
                // }
                if(req.body.agreeemnt_code){
                    Option.agreeemnt_code = req.body.agreeemnt_code;
                }
                Option.transporter_id = t_id;
                Option.customer_id = req.body.customer_id;
                Option.status = 1;
                const fieldsP = {};
                // console.log(Option)
                tableP="cv_agreement_transporter_group_mapping"
                // const agreementcheck = []  
                conditionsP = [ { "$match": Option}, { "$lookup": { "from": "cv_agreement_mapping_details",
                     "let": { "transporterMappingId": { "$toString": "$_id" } }, 
                     "pipeline": [ { "$match": { "$expr": { "$and": [ { "$eq": ["$m_agreement_mapping_id", "$$transporterMappingId"] }, ] } } }],
                      "as": "agreementDetails" } }] 
                // console.log(conditionsP);  
                let agreementcheck = await aggregateCVMongoQuery(conditionsP, fieldsP, tableP)
                // console.log(agreementcheck)
                // process.exit(0)
                // console.log(agreementcheck.length)
                let output = []

                if (agreementcheck.length != 0){
                   
                    // console.log(typeof agreementcheck.agreementDetails)
                    // console.log(JSON.stringify(agreementcheck, null, 2));
                    for(const agreedata of agreementcheck ){
                        // console.log(agreedata.agreementDetails)
                    
                        const newout = agreedata.agreementDetails.map(item => ({
                            ...agreedata,  
                            ...item    
                        }));
                        newout.forEach(obj => delete obj.agreementDetails);
                        output.push(...newout);
                    
                    }
                    // console.log(output)
                    const finaloutput = await flattenAgreementData(output)
                    // console.log(finaloutput)
                    
                    
                    
                    response = {
                        stauts:"success",
                        data:finaloutput
                    }
                    return res.status(200).json(response)
                    
                }
                else{
                    const resData1 = {}
                    resData1.stauts = "fail"
                    resData1.message = "No record found";
                    // console.log("File Not Found");
                    return res.status(200).json(resData1)

                }
                // process.exit(0);

            

            //     response={
            //         status:'success',
            //         message:"uploaded successfully"
            //     }

         
            // res.status(200).json(response);
                
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};

const aggregateCVMongoQuery= async(condition, fields, table) =>{
    return new Promise((resolve, reject) => { 
    (  async () => {
        
      try {
            // const url_cv_mongo_db="dbcv.secutrak.in";
            // const url = 'https://'+url_cv_mongo_db+'/cv_secutrak_local_mongo/access/v0.1/selectQueryAggregate';
            const url_cv_mongo_db="dbcv.secutrakpvt.in";
            const url = 'http://'+url_cv_mongo_db+'/cv_secutrak_local_mongo/access/v0.1/selectQueryAggregate';
            const postData = new URLSearchParams();
            postData.append('conditions', JSON.stringify(condition));
            postData.append('fields', JSON.stringify(fields));
            postData.append('table', table);

            const response = await axios.post(url,postData,
            {   
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                maxRedirects: 10,
                timeout: 0 
            });        
            const res = response.data;
            // console.log(res); // Use this to print the response if needed        
            resolve( res );
      } catch (error) {
        reject(error);
        console.error('Error making request:', error);
      }
    }   )();
    });
    }

async function flattenAgreementData(arr) {
    let flattenedarray = []
    
    let flattenedData = {};
    

    // Iterate over each key in the object
    for (const data of arr){
        for (let key in data) {
            
            if (typeof data[key] === "object" && data[key] !== null) {
                // Flatten nested object properties with key as prefix
                for (let nestedKey in data[key]) {
                    flattenedData[`${key}_${nestedKey}`] = data[key][nestedKey];
                }
            } else {
                // Copy non-object properties directly
                flattenedData[key] = data[key];
            }
        }
        // console.log(flattenedData)
        // flattenedarray.push(flattenedData)
        flattenedarray.push({ ...flattenedData });
    }

    return flattenedarray;
}




exports.transporterslist = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
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

                const sql1=`select id,name,code from transporters where group_id = ?`;
                const [transporterslist] = await db.promise().query(sql1,[customer_id]);
                const trptlist = transporterslist.map(({ id, name, code }) => ({
                    id,
                    name: `${name} [${code}]`
                }));
                // const vehicleBodyType = vehiclerows.map(row => ({ id: row.id, name: row.name ,code: row.code}));
                // console.log(vehicleBodyType);
                
               
                
                

                

                
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


exports.agreementvehicleinformation = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,id} = req.body;
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
                const tableP = "cv_agreement_vehicleinformation"
                const conditionsP = {}
                const fieldsP = { projection: { _id: 0 } }
                conditionsP.agreementvehiclemappingid = id

                const vehicledetails = await mongu.getCVMongoQuery(conditionsP,fieldsP,tableP)
                 
                
                response={
                    status:'success',
                    vehicledata:vehicledetails,
                }

         
            res.status(200).json(response);
                
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.billingverificationdetails = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,vehiclenumber,startdate,enddate,vehicleid} = req.body;
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
                // const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                // if (result.length > 0) {
                //     const resultUsr=result[0];
                //     const user_type= resultUsr['user_type'];
                //     const self_group_id= resultUsr['group_id'];
                //     const group_id =resultUsr['group_id'];
                //     const group_type= resultUsr['group_type'];
                //     const name= resultUsr['name']; 
                // }
                const tableP = "cv_agreement_vehicleinformation"
                const conditionsP = {}
                const fieldsP = { projection: { _id: 0 } }
                conditionsP.vehicle_no = vehiclenumber
                // conditionsP.from_date = {'$gte': startdate, '$lte': enddate};
                // conditionsP.to_date = {'$gte': startdate};   ///, '$lte': enddate
                conditionsP.from_date = {'$lte': enddate};
                conditionsP.to_date = {'$gte': startdate}; 
                conditionsP.status = 1; 
                // console.log(conditionsP)

                const vehiclemappingid = await mongu.getCVMongoQuery(conditionsP,fieldsP,tableP)
                // console.log(vehiclemappingid)
                let agrementinfo = []

                if (vehiclemappingid.length > 0){
                const condition2 = {}
                const fields1 = {}
                const tbale2 = "cv_agreement_mapping_details"
                condition2.obj = {'_id':{"$in":[vehiclemappingid[0].agreementvehiclemappingid]}};
                agrementinfo = await mongu.getCVMongoQuery(condition2,fields1,tbale2)

                }
                // else{

                //     res.status(200).json("no agreement available");

                // }
                
                
                // const idCapacityMap = vehcap.reduce((acc, { id, capacity }) => {
                //     acc[Number(id)] = capacity;
                //     return acc;
                //   }, {});

                //   console.log(idCapacityMap)

                const sql1=`select id,vehicle_capacity_tons,tank_capacity,fuel_type,mileage from vehicle where vehicle_number = ?`;
                const [vehdata] = await db.promise().query(sql1,[vehiclenumber]);

                const sql2 =`SELECT vda.vehicle_id, d.id AS device_id, dm.name AS manufacturer_name FROM vehicle_device_assignment vda JOIN devices d ON vda.device_id = d.id JOIN device_manufacturer dm ON d.device_manufacturer_id = dm.id WHERE vda.vehicle_id = ?`
                const [gpsvendordata] = await db.promise().query(sql2,[vehicleid]);
                // console.log(gpsvendordata)
                const cpcty = String(vehdata[0].vehicle_capacity_tons)
                console.log(vehdata)
                const sql3=`select id,capacity from vehicle_capacity where id = ?`;
                const [vehcap] = await db.promise().query(sql3,[cpcty]);
                console.log(vehcap)

                const vehicleinfo = {
                    vehicle_capacity:vehcap?.[0]?.capacity ?? "",
                    fuel_type:vehdata?.[0]?.fuel_type ?? "",
                    mileage:vehdata?.[0]?.mileage ?? "",
                    zone:"",
                    branch:"",
                    product:"",
                    activity:"",
                    gpsvendor:gpsvendordata?.[0]?.manufacturer_name ?? "",
                }
                // console.log(vehicleinfo)
                
                
                response={
                    status:'success',
                    vehicledata:vehiclemappingid[0] ?? {},
                    agrimentdata:agrementinfo[0] ?? {},
                    vehicleinformation:vehicleinfo
                }

         
            res.status(200).json(response);
                
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};



exports.statuscount = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,userflag} = req.body;
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
                
                if (!userflag){
                    return res.status(400).json("useflag key  not found")
                }
                if (!req.body.customer_id){
                    return res.status(400).json("customer_id  not found")

                }
                if (!req.body.transporter_id){
                    return res.status(400).json("transporter_id  not found")

                }


                const user_id = user_info.AccountId;
                let t_id = ''
                let Option = {}


                if (userflag == 1){
                    t_id = Number(req.body.transporter_id)
                    Option.customer_id = req.body.customer_id;
                }
                else if (userflag == 2){
                    const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                    t_id = qry_t_id[0].type_detail_id;
                    Option.transporter_id = t_id;
                }
                else{
                    return res.status(400).json("useflag key wrong input")
                }
                

                
                
                const fieldsP = {};
                tableP="cv_indent_transporter_request"  
                conditionsP =  [{"$match": Option},{"$group": {"_id": "$status","count": { "$sum": 1 }}}]
                // conditionsP = [ { "$match": Option }, { "$group": { "_id": { "status": "$status", "status_remark": "$status_remark" }, "count": { "$sum": 1 } } } ]
                // console.log(conditionsP);  
                let agreementcheck = await aggregateCVMongoQuery(conditionsP, fieldsP, tableP)
                // console.log(agreementcheck)
                let output = []

                if (agreementcheck.length != 0){
                   
                    response = {
                        stauts:"success",
                        data:agreementcheck
                    }
                    return res.status(200).json(response)
                    
                }
                else{
                    const resData1 = {}
                    resData1.stauts = "fail"
                    resData1.message = "No record found";
                    return res.status(200).json(resData1)

                }
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


//Created By Mustaqeem on 2026-01-21.
exports.billingGUIFields = async (req, res) => {

    // const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,userflag} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";

        if(AccessToken!=null){
            let user_info ={};
            const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");

            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1;                
                user_info.AccountId=DeveloperOptionId;
            }else{
                 user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            }

            //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    final_data.Message=user_info.Message;
                    res.status(200).json(final_data);
            }else{
                
                guiFields = {
                    "Fixed Rent & Free Km": { "fields": ["vehicle", "start_date", "end_date", "agreement", "working_days", "fixed_charges", "vendor_distance", "final_distance", "distance_charges", "extra_hours", "extra_hour_charges", "loading_unloading", "current_fuel_rate", "fuel_surcharge", "fooding", "toll", "night_charge", "other_expenses"] },
                    "Fixed Rent & Per Km": { "fields": ["vehicle", "start_date", "end_date", "agreement", "working_days", "fixed_charges", "vendor_distance", "final_distance", "distance_charges", "extra_hours", "extra_hour_charges", "loading_unloading", "current_fuel_rate", "fuel_surcharge", "fooding", "toll", "night_charge", "other_expenses"] },
                    "Distance & Hourly Based": { "fields": ["vehicle", "start_date", "end_date", "agreement", "vendor_distance", "distance_charges", "extra_hours", "extra_hour_charges", "current_fuel_rate", "fuel_surcharge", "fooding", "toll", "night_charge", "other_expenses", "loading_unloading"] },
                    "Distance Based": { "fields": ["vehicle", "start_date", "end_date", "agreement", "vendor_distance", "distance_charges", "current_fuel_rate", "fuel_surcharge", "fooding", "toll", "night_charge", "other_expenses"] },
                    "Hourly Based": { "fields": ["vehicle", "start_date", "end_date", "agreement", "working_hours", "hours_charges", "loading_unloading", "fooding", "toll", "night_charge", "other_expenses"] },
                    "Trip Based": { "fields": ["vehicle", "start_date", "end_date", "agreement", "no_of_trips", "trip_charges", "extra_distance", "distance_charges", "loading_unloading", "fooding", "toll", "night_charge", "other_expenses"] }
                };

                response = {
                    stauts:"success",
                    data:guiFields
                }
                return res.status(200).json(response)
            }
        }
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};