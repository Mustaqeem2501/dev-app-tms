const { json } = require("body-parser");
const db = require("../config/db");
const {passenc}= require("../helpers/pass_enc");
const mongu =require("../lib/mongo/mongo_api");
const cassCon = require("../lib/cassandra-lib/libLog");
// const tokenMobile= require("../helpers/access_token_mobile"); // MOBILE ACCESS_TOKEN
const tokenWeb= require("../helpers/access_token_web");
const uploadS3 = require("./components/uploadS3Component");
const s3 = require("../lib/aws-lib/s3")
const { format, subHours, differenceInSeconds } = require('date-fns');
const moment = require('moment-timezone');
const dayjs = require('dayjs');
const axios = require('axios');
const path = require('path');
const fs = require('fs');


exports.indentfilter = async(req,res) => {
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
                
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    // console.log(resultUsr)
                
               
                    const [routesequenceqry] = await db.promise().query('select id, route_name,route_code,COALESCE(route_sequence, route_name) AS route_sequence,location_ids from courier_route where group_id=? and status=1',[group_id])
    
                    
                    sql2 = "select id,name,code from vehicle_types";
                    const [VechileBodyType] = await db.promise().query(sql2);
                   
                    sql3 = "select name ,id from cv_booking_type";
                    const [bookingtypedata] = await db.promise().query(sql3);
    
                    sql4 = "select name,id from cv_load_type";
                    const [loadtypedata] = await db.promise().query(sql4);

                    sql5 = "select name ,id from cv_feature_master";
                    const [Safety_ceck_list] = await db.promise().query(sql5);

                    sql6 = "select id,capacity from vehicle_capacity where status=1";
                    const [vehicleqrydata] = await db.promise().query(sql6);

                    sql7 = "select id,size from cv_vehicle_size";
                    const [vehiclesizedata] = await db.promise().query(sql7);
    
                    
                    final_response={
                        status:'success',
                        Safety_ceck_list:Safety_ceck_list,
                            Load_type:loadtypedata,
                            Vehicle_Capacity:vehicleqrydata,
                            VechileBodyType:VechileBodyType,
                            BookingType:bookingtypedata,
                            routesequence:routesequenceqry,
                            vehiclesize:vehiclesizedata,
                        }
                    return res.status(200).json(final_response)
               
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



exports.indentsearchdata = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,indentfilterdata,BookingType} = req.body;
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
                
                //let final_data = {};
                //const user_id =5659;
                console.log(user_info)
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    // console.log(resultUsr)
                    // process.exit(0)

                    // const create_date= "2025-04-12 00:00:00";
                    const create_date = moment() .tz('Asia/Calcutta') .subtract(1, 'month') .startOf('day') .format("YYYY-MM-DD HH:mm:ss");
                    // const create_date = moment() .tz('Asia/Calcutta') .subtract(1, 'year') .startOf('day') .format("YYYY-MM-DD HH:mm:ss");
                    let tripcount = {};
                    const conditionsP1 = [{ $match: { run_date: { $gte: create_date },trip_status:{$ne: 2} } }, { $group: { _id: "$transporter_id", count: { $sum: 1 } } } ];
                    const fieldsP1 = {};
                    

                    if (group_id == '0041'){
                        
                        const tableP1 = "courier_trip_detail";
                        const dataqry1 = await mongu.aggregateMongoBDEQuery(conditionsP1,fieldsP1,tableP1)
                        dataqry1.forEach(item => {
                            tripcount[Number(item._id)] = item.count;
                            });
                    }

                    else if (group_id == '5691'){
                        const tableP1 = "dtdc_trip_detail";
                        const dataqry1 = await mongu.aggregateCVMongoQuery(conditionsP1,fieldsP1,tableP1)
                        dataqry1.forEach(item => {
                            tripcount[Number(item._id)] = item.count;
                            });
                    }

                    else{
                        const tableP1 = "cv_transporter_trip_detail";
                        const dataqry1 = await mongu.aggregateCVMongoQuery(conditionsP1,fieldsP1,tableP1)
                        dataqry1.forEach(item => {
                            tripcount[Number(item._id)] = item.count;
                        });
                    }
                    

               
                    const sql1=`select id,name,code from transporters where group_id = ?`;
                    const [transporterslist] = await db.promise().query(sql1,[group_id]);
                    // console.log(transporterslist)
                    const idArray = transporterslist.map(item => item.id);
                    // console.log(transporterslist)
                    // transporterslist.forEach(t => {
                    //     const count = tripcount[t.id] || 0;
                    //     console.log(`Transporter: ${t.name} (ID: ${t.id}) -> Count: ${count}`);
                    //   });
                    // process.exit(0)
                    
                    const parsedBookingType = JSON.parse(BookingType);
                    // res.status(200).json(req.body.indentfilterdata);
                    const parsedindentfilterdata = JSON.parse(indentfilterdata);
                    // res.status(200).json(parsedindentfilterdata);
                    const tableP = "cv_agreement_transporter_group_mapping";
                    const tablePagremnt = "cv_agreement_vehicleinformation";
                    const conditionsP = {};
                    const fieldsP = { projection: { _id: 0 } };
                    const fieldsPagg = { projection: { _id: 0,vehicle_no:1,transporter_id:1,customer_id:1 } };
                    conditionsP.transporter_id = { $in: idArray };
                    conditionsP.customer_id = { $in: [String(group_id)] };
                    conditionsP.status = 1;

                    const dataqry = await mongu.getCVMongoQuery(conditionsP,fieldsP,tableP)

                    const agrementvehiclelist = await mongu.getCVMongoQuery(conditionsP,fieldsPagg,tablePagremnt)

                    // console.log(agrementvehiclelist);
                    // console.log(agrementvehiclelist.length);

                    const tid_vehicle_chunk = {};
                    const vehicle_chunk_array = [];

                    agrementvehiclelist.forEach(item => {
                    const tid = item.transporter_id;
                    if (!tid_vehicle_chunk[tid]) {
                        tid_vehicle_chunk[tid] = [];
                    }
                    tid_vehicle_chunk[tid].push(item.vehicle_no);
                    vehicle_chunk_array.push(item.vehicle_no);
                    });
                    // console.log(tid_vehicle_chunk);
                    // console.log(vehicle_chunk_array);

                    const conditionsP2 = {};
                    conditionsP2.vehicle_no = { $in: vehicle_chunk_array };
                    conditionsP2.run_date = { $gte: create_date };
                    const fieldsP2 = { projection: { _id: 0 ,vehicle_no:1,trip_status:1 } };
                    let usedvehiclearray = [];
                    let livevehiclearray = [];

                    if (group_id == '0041'){
                        
                        const tableP2 = "courier_trip_detail";
                        const dataqry2 = await mongu.getMongoBDEQuery(conditionsP2,fieldsP2,tableP2)
                        console.log(dataqry2)
                        usedvehiclearray = [...new Set(dataqry2.map(item => item.vehicle_no))];
                        livevehiclearray = [...new Set(
                            dataqry2.filter(item => item.trip_status === 1).map(item => item.vehicle_no)
                        )];
                        
                    }

                    else if (group_id == '5691'){
                        const tableP2 = "dtdc_trip_detail";
                        const dataqry2 = await mongu.getCVMongoQuery(conditionsP2,fieldsP2,tableP2)
                        usedvehiclearray = [...new Set(dataqry2.map(item => item.vehicle_no))];
                        livevehiclearray = [...new Set(
                            dataqry2.filter(item => item.trip_status === 1).map(item => item.vehicle_no)
                        )];
                    }

                    else{
                        const tableP2 = "cv_transporter_trip_detail";
                        const dataqry2 = await mongu.getCVMongoQuery(conditionsP2,fieldsP2,tableP2)
                        usedvehiclearray = [...new Set(dataqry2.map(item => item.vehicle_no))];
                        livevehiclearray = [...new Set(
                            dataqry2.filter(item => item.trip_status === 1).map(item => item.vehicle_no)
                        )];
                    }

                    const usedvehiclecount = {};
                    const livevehiclecount = {};

                    for (const [transporterId, vehicles] of Object.entries(tid_vehicle_chunk)) {
                    const count = vehicles.filter(v => usedvehiclearray.includes(v)).length;
                    const count2 = vehicles.filter(v => livevehiclearray.includes(v)).length;
                    usedvehiclecount[transporterId] = count;
                    livevehiclecount[transporterId] = count2;
                    }
                    // console.log(usedvehiclecount);
                    // console.log(livevehiclecount);
                    

                    // console.log(dataqry)
                    // process.exit(0);

                    const presentIds = new Set();
                    const idVehicleCount = {};

                    if (dataqry.length !== 0) {
                        dataqry.forEach(doc => {
                            const docIdStr = parseInt(doc.transporter_id, 10);
                            const vehCount = parseInt(doc.number_of_vehicles, 10);

                            if (presentIds.has(docIdStr)) {
                                idVehicleCount[docIdStr] += vehCount;
                            } else {
                                idVehicleCount[docIdStr] = vehCount;
                                presentIds.add(docIdStr);
                                }
                            });
                        } 
                    else {
                        if (parsedBookingType.id === 1) {
                            return res.status(200).json({
                                Status: "fail",
                                Message: "No contracted Transporter"
                            });
                            }
                        }

                    // console.log(presentIds,idVehicleCount)
                    
                    if (parsedBookingType.id === 1) {
                        const filteredData = transporterslist.filter(item => presentIds.has(item.id));

                        const response_data = await getData(filteredData, idVehicleCount,tripcount,usedvehiclecount,livevehiclecount);

                        return res.status(200).json({
                            Status: "success",
                            data: response_data,
                            indentdata:parsedindentfilterdata
                        });
                        }

                    if (parsedBookingType.id === 2) {
                        const filteredData = transporterslist.filter(item => !presentIds.has(item.id));

                        const response_data = await getDatamk(filteredData,tripcount);
                        
                        return res.status(200).json({
                            Status: "success",
                            data: response_data,
                            indentdata:parsedindentfilterdata
                        });
                        
                        }
                    if (parsedBookingType.id === 3) {
                        const filteredData = transporterslist.filter(item => presentIds.has(item.id));
                        const response_data = await getData(filteredData, idVehicleCount,tripcount,usedvehiclecount,livevehiclecount);

                        const filteredData1 = transporterslist.filter(item => !presentIds.has(item.id));
                        const response_data1 = await getDatamk(filteredData1,tripcount);
                        
                        const response_dataall = [...response_data, ...response_data1];
                        // console.log(response_data)
                        // process.exit(0)

                        return res.status(200).json({
                            Status: "success",
                            data: response_dataall,
                            indentdata:parsedindentfilterdata
                        });
                        }
                    
                    
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


async function getData(transporterNames, vehicleCount,tripcount,usedvehiclecount,livevehiclecount) {
    const data = [];
    const scores = [25, 95, 50, 70, 78, 47];

    transporterNames.forEach((transporter, index) => {
        const vehicleContracted = vehicleCount[transporter.id] || 0;
        const count = tripcount[transporter.id] || 0;
        const vehusedcount = usedvehiclecount[transporter.id] || 0;
        const vehlivecount = livevehiclecount[transporter.id] || 0;

        data.push({
            Transporter_Name: transporter,
            Transporter_Score: scores[index % scores.length], 
            No_of_Trips: count,
            Vehicle_Contracted: vehicleContracted,
            Vehicle_Used: vehusedcount,
            Vehicle_Remaining: 2,
            Vehicle_Use_In_Current_Month: vehusedcount,
            Vehicle_Currently_In_Use: vehlivecount,
            Recommendation_IN_Priority: "",
            Action: 1
        });
    });

    return data;
}

async function getDatamk(transporterNames,tripcount) {
    const data = [];
    const scores = [25, 95, 50, 70, 78, 47];

    transporterNames.forEach((transporter, index) => {
        const count = tripcount[transporter.id] || 0;

        data.push({
            Transporter_Name: transporter,
            Transporter_Score: scores[index % scores.length], 
            No_of_Trips: count,
            Vehicle_Contracted: "",
            Vehicle_Used: "",
            Vehicle_Remaining: "",
            Vehicle_Use_In_Current_Month: "",
            Vehicle_Currently_In_Use: "",
            Recommendation_IN_Priority: "",
            Action: 2
        });
    });

    return data;
}



exports.submitindent = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,indentdata,searchdata,status} = req.body;
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
                
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 

                    const [groupname] = await db.promise().query("SELECT `name` FROM user_group WHERE `group_id`=? AND `status`=?",[group_id,1]);
                    const  newname = `${groupname[0].name} [${name}]`;

                    const parsedindentdata = JSON.parse(indentdata);
                    const parseddata = JSON.parse(searchdata);

                    if (status == 1) {
                        
                        for (const data of parseddata) {
                            const uniqueId = 'test-'+Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                            const outres = await submitalldata(parsedindentdata,data,newname,group_id,status,uniqueId)
                        }
                        return res.status(200).json({
                            status: "success",
                            message:"indent generated successfully"
                        });
                        }

                    if (status == 5) {
                        const uniqueId = 'test-'+Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                        for (const data of parseddata) {
                            const outres = await submitalldata(parsedindentdata,data,newname,group_id,status,uniqueId)
                        }
                        return res.status(200).json({
                            status: "success",
                            message:"indent generated successfully"
                        });
                        }
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


async function submitalldata(indentsearch,transporterdata,customername,customerid,status,request_id) {
    const create_date= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
    
    const tempdict = {
        customer_name: customername || "",
        customer_id: customerid || "",
        transporter_id: transporterdata?.Transporter_Name?.id || "",
        tranporter_name: transporterdata?.Transporter_Name?.name || "",
        transporter_score: transporterdata?.Transporter_Score || "",
        create_date: create_date || "",
        Vehicle_contracted: transporterdata?.Vehicle_Contracted || "",
        Vehicle_used: transporterdata?.Vehicle_Used || "",
        request_id: request_id || "",
        status: Number(status) || "",
        status_remark: status == 1 ? "Pending" : status == 5 ? "Request Quote" : "",
    
        Bookingtype: indentsearch?.BookingType?.value || "",
        Bookingtype_id: indentsearch?.BookingType?.id || "",
        dispatchdate: indentsearch?.Date || "",
        dispatchtime: indentsearch?.time || "",
        basecost: indentsearch?.baseCost || "",
        bidexpiry: indentsearch?.bidExpiryDate || "",
        tathours: indentsearch?.tatHours || "",
        remark: indentsearch?.remarks || "",
        mandatorySafetyCheck: indentsearch?.mandatorySafetyCheck || "",
        Routesequence: indentsearch?.Routesequence || "",
        Destination_id: indentsearch?.Destination?.id || "",
        Destination: indentsearch?.Destination?.value || "",
        Load_type_id: indentsearch?.Load_type?.id || "",
        Load_type: indentsearch?.Load_type?.name || "",
        Safety_check_list: indentsearch?.Safety_check_list || "",
        Source_id: indentsearch?.Source?.id || "",
        Source: indentsearch?.Source?.value || "",
        VechileBodyType_id: indentsearch?.VechileBodyType?.id || "",
        VechileBodyType: indentsearch?.VechileBodyType?.name || "",
        Vehicle_Capacity_id: indentsearch?.Vehicle_Capacity?.id || "",
        Vehicle_Capacity: parseInt(indentsearch?.Vehicle_Capacity?.capacity, 10) || "",
        age_of_vehicle: parseInt(indentsearch?.age_of_vehicle, 10) || "",
        no_of_vehicle: parseInt(indentsearch?.no_of_vehicle, 10) || ""
    };

    // console.log(tempdict)
    tableP = "cv_indent_transporter_request"

    const indentqry = await  mongu.insertCVMongoQuery(tempdict, tableP)

}


exports.getorderdata = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporterid,customerid,status,requestid,startdate,enddate,userflag} = req.body;
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
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    // console.log(resultUsr)

                    // const parsedindentdata = JSON.parse(indentdata);
                    const conditionsP = {};
                    if (userflag == 1){
                        if(req.body.transporterid){
                            conditionsP.transporter_id = Number(transporterid);
                            }
                        conditionsP.customer_id = customerid
                        
                        }
                    else if (userflag == 2){
                        const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                        // console.log("typeid",qry_t_id)
                        t_id = qry_t_id[0].type_detail_id;
                        // console.log("typeid",t_id)

                        conditionsP.transporter_id = Number(t_id);
                        if (customerid){
                            conditionsP.customer_id = customerid
                            }
                        }
                    else{
                        return res.status(400).json("useflag key  wrong input")
                        }

                    const  tableP = 'cv_indent_transporter_request';
                    const fieldsP = {projection: {_id:0}};
                    if (requestid) {
                        conditionsP.request_id = requestid;
                        }
                    if (status == 5) {
                        conditionsP.status = Number(status);
                        }
                    if (status == 1){
                        conditionsP.status = {'$ne': 5};
                        }
                    conditionsP.dispatchdate = {'$gte': startdate, '$lte': enddate};

                    const results = await  mongu.getCVMongoQuery(conditionsP, fieldsP, tableP)

                    // console.log(conditionsP)
                    // console.log(results)
                    // process.exit(0);
                    
                    if (results.length != 0){
                        final_response={
                            status:'success',
                            data:results,
                        }
                        return res.status(200).json(final_response);
                        }
                    else{
                        final_response={
                            status:'success',
                            message:"NO record found",
                        }
                        return res.status(200).json(final_response);
                        }
                    
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


exports.indentassignment = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,vehicledata,userdata,quote,request_id} = req.body;
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
                
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    // console.log(resultUsr)

                    const parsedvehicledata = JSON.parse(vehicledata);
                    const parseduserdata = JSON.parse(userdata);
                    const create_date= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");

                    for (const item of parsedvehicledata) {
                        const data = {
                            
                            customer_id: parseduserdata?.customer_id || "",
                            transporter_id: parseInt(parseduserdata?.transporter_id) || "", // Convert to int, default to 0 if invalid
                            transporter_name: parseduserdata?.transporter_name || "",
                            customer_name: parseduserdata?.customer_name || "",

                            Capacity_tonns: item?.Capacity || "",
                            Driver_id: item?.Driver?.id || "",
                            Driver_name: item?.Driver?.name || "",
                            DriverDocument: item?.DriverDocument || "",
                            Phone: item?.Phone || "",
                            Driver_id_2: item?.Driver2?.id || "",
                            Driver_name_2: item?.Driver2?.name || "",
                            DriverDocument_2: item?.DriverDocument2 || "",
                            Phone_2: item?.Phone2 || "",
                            Type: item?.Type || "",
                            quote: quote || "",
                            Quote_single: item?.Quote_single || "",
                            Vehicle_id: item?.Vehicle?.vehicle_id || "",
                            Vehicle_number: item?.Vehicle?.vehicle_no || "",
                            VehicleDocument: item?.VehicleDocument || "",
                            // checkbox: item?.checkbox || "", // Uncomment if needed
                            remark: item?.remark || "",
                            request_id: request_id || "",
                            safetyFeatures: item?.safetyFeatures || "",
                            create_date: create_date || "",
                            status: 1
                        };
                        const tableP = "cv_transporter_indent_assigned_data"

                        // return res.status(200).json({
                        //     status: "success",
                        //     message:"Assigned successfully",
                        //     data:data
                        // });

                        const assignedqry = await  mongu.insertCVMongoQuery(data, tableP)

                        // console.log(data)
                    }

                    /// update status of request table
                    const  tableP1 = 'cv_indent_transporter_request';
                    const updateData = {}; 
                    const conditionsP={};
                    conditionsP.request_id = request_id;
                    conditionsP.transporter_id = Number(parseduserdata?.transporter_id) || 0; 
                    updateData.edit_date = create_date;
                    updateData.status_remark = "Vehicle Assigned";
                    
                    const updateField = { $set: updateData };

                    // console.log(conditionsP,updateField)
                    
                    const result_update =  mongu.updateCVMongoQuery(conditionsP, updateField, tableP1);


                    return res.status(200).json({
                        status: "success",
                        message:"Assigned successfully"
                    });



                    
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


exports.getassigneddata = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporter_id,status,requestid} = req.body;
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
                //  console.log(user_info)
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
                    // console.log(resultUsr)

                    // const parsedindentdata = JSON.parse(indentdata);
                    const conditionsP = {};
                    const  tableP = 'cv_transporter_indent_assigned_data';
                    const fieldsP = {projection: {_id:0}};
                    conditionsP.request_id = requestid;
                    conditionsP.transporter_id = Number(transporter_id)
                    const dataqry = await  mongu.getCVMongoQuery(conditionsP, fieldsP, tableP)
                    const create_date= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");

                    // console.log(conditionsP)
                    // console.log(results)
                    // process.exit(0);
                    
                    if (dataqry.length != 0){
                        const tempdict = dataqry.map(row => {
                            const getDocInfo = (doc, field) => row?.VehicleDocument?.[doc]?.[field] || "";
                            const getDriverDoc = (doc, field) => row?.DriverDocument?.[doc]?.[field] || "";
                            const expirydatecheck = (expiry_date, create_date) => {
                                if (!expiry_date || !create_date) return "Invalid Date"; // Handle missing dates
                                const expiry = new Date(expiry_date);
                                const create = new Date(create_date);
                                return expiry < create ? "Expired" : "Not Expired";
                            };
                    
                            return {
                                request_id:row.request_id,
                                DrivingLicense_No: getDriverDoc("3", "doc_no"),
                                DrivingLicense_exp: getDriverDoc("3", "expiry_date"),
                                DrivingLicense_status: expirydatecheck(getDriverDoc("3", "expiry_date"), create_date),
                    
                                AadhaarCard_No: getDriverDoc("1", "doc_no"),
                                PanCard_No: getDriverDoc("2", "doc_no"),
                                Photograph: getDriverDoc("12", "file_path"),
                                First_Driver_name: row?.Driver_name || "",
                                Secornd_Driver_name: row?.Driver_name_2 || "",
                                Phone: row?.Phone || "",
                                quote: row?.quote || "",
                                VehicleNumber: row?.Vehicle_number || "",
                                Vehicle_Type: row?.Type || "",
                                Vehicle_Capacity: row?.Capacity_tonns || "",
                                RegistrationCertificate_no: getDocInfo("5", "doc_no"),
                                RegistrationCertificate_exp: getDocInfo("5", "expiry_date"),
                                RegistrationCertificate_status: expirydatecheck(getDocInfo("5", "expiry_date"), create_date),
                    
                                PollutionCertificate_no: getDocInfo("6", "doc_no"),
                                PollutionCertificate_exp: getDocInfo("6", "expiry_date"),
                                PollutionCertificate_status: expirydatecheck(getDocInfo("6", "expiry_date"), create_date),
                    
                                VehicleInsurance_no: getDocInfo("7", "doc_no"),
                                VehicleInsurance_exp: getDocInfo("7", "expiry_date"),
                                VehicleInsurance_status: expirydatecheck(getDocInfo("7", "expiry_date"), create_date),
                    
                                NationalGoodsPermit: getDocInfo("10", "doc_no"),
                                NationalGoodsPermit_exp: getDocInfo("10", "expiry_date"),
                                NationalGoodsPermit_status: expirydatecheck(getDocInfo("10", "expiry_date"), create_date),
                    
                                remark: "",
                                safetyFeatures: row?.safetyFeatures || ""
                            };
                            
                        });
                        
                        final_response={
                            status:'success',
                            data:tempdict,
                        }
                        return res.status(200).json(final_response);
                        }
                    else{
                        final_response={
                            status:'success',
                            message:"NO record found",
                        }
                        return res.status(200).json(final_response);
                        }
                    
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




exports.getquotedatacustomer = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporterid,customerid,status,requestid,startdate,enddate} = req.body;
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
                //  console.log(user_info)
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
                    // console.log(resultUsr)

                    const conditionsP = {};
                    const  tableP = 'cv_indent_transporter_request';
                    const fieldsP = {projection: {_id:0}};
                    if (requestid) {
                        conditionsP.request_id = requestid;
                        }
                    if (transporterid) {
                        conditionsP.transporter_id = Number(transporterid);
                        }
                    conditionsP.customer_id = customerid;    
                    conditionsP.status = 5;
                   
                    conditionsP.dispatchdate = {'$gte': startdate, '$lte': enddate};
                    // console.log(conditionsP)

                    const dataqry = await  mongu.getCVMongoQuery(conditionsP, fieldsP, tableP)
                    // const create_date= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                    
                    
                    if (dataqry.length != 0){
                        const groupedData = {};
                        const uniqueOrderNumbers = new Set();

                        dataqry.forEach((item) => {
                            const orderKey = item.request_id;

                            if (!groupedData[orderKey]) {
                                groupedData[orderKey] = [];
                            }
                            groupedData[orderKey].push(item);
                            uniqueOrderNumbers.add(orderKey);
                        });
                        const orderNumbersArray = [...uniqueOrderNumbers];
                        // console.log(orderNumbersArray)
                        // const groupedData = dataqry.reduce((acc, item) => {
                        //     const orderKey = item.request_id;
                        //     if (!acc[orderKey]) {
                        //         acc[orderKey] = [];
                        //     }
                        //     acc[orderKey].push(item);
                        //     return acc;
                        // }, {});

                        const conditionsP1 = {};
                        const  tableP1 = 'cv_transporter_indent_assigned_data';
                        const fieldsP1 = {projection: {_id:0}};
                        conditionsP1.request_id = {"$in":orderNumbersArray};
                        // console.log(conditionsP1)
                        const dataqry1 = await  mongu.getCVMongoQuery(conditionsP1, fieldsP1, tableP1)
                        // console.log(dataqry1)
                        const groupedData1 = dataqry1.reduce((acc, item) => {
                            const { request_id, transporter_id } = item;
                            if (!acc[request_id]) {
                              acc[request_id] = {};
                            }
                            if (!acc[request_id][transporter_id]) {
                              acc[request_id][transporter_id] = [];
                            }
                            acc[request_id][transporter_id].push(item);
                            return acc;
                          }, {});

                        // console.log(dataqry1)

                        const ratiores = {};

                        for (const key in groupedData) {
                            const len_dict1 = groupedData[key].length;
                            const len_dict2 = Object.keys(groupedData1[key] || []).length; // Default to empty array if key not present
                            ratiores[key] = `${len_dict2} / ${len_dict1}`;
                          }

                        const minMaxQuotes = Object.fromEntries(
                        Object.entries(groupedData1).map(([reqId, transporters]) => {
                            // console.log("tranporterdata",transporters)
                            let quotes = Object.entries(transporters)
                            .flatMap(([tpid, list]) => ({ tpid, transporter_name: list[0].transporter_name, quote: list[0].quote }));
                            console.log("quotes",quotes)
                            let min = quotes.reduce((a, b) => (a.quote < b.quote ? a : b));
                            let max = quotes.reduce((a, b) => (a.quote > b.quote ? a : b));
                            return [reqId, [[min.tpid, min.transporter_name, min.quote], [max.tpid, max.transporter_name, max.quote]]];
                        })
                        );
                        

                        /////////add assinedflag/////////////////////////////
                        for (const key in groupedData) {
                            const items = groupedData[key];
                            const hasAssigned = items.some(item => item.status_remark === "Vehicle Assigned");
                          
                            groupedData[key] = items.map(item => ({
                              ...item,
                              assignedflag: hasAssigned ? 1 : 0
                            }));
                          }
                        ///////////////////
                        final_response={
                            status:'success',
                            data:groupedData,
                            data1:groupedData1,
                            ratio:ratiores,
                            min_max_data:minMaxQuotes,
                        }
                        return res.status(200).json(final_response);
                        }
                    else{
                        final_response={
                            status:'success',
                            message:"NO record found",
                        }
                        return res.status(200).json(final_response);
                        }
                    
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
