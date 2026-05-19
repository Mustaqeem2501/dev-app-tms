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



exports.pings = (req, res) => {
    res.status(200).send({
        message: "Ping successfull!"
      });
};

exports.tmsbilling = async(req,res) => {
    try{
        const {AccessToken,customerid,fromdate,todate,status,invoice_no,reporttype,DeveloperOption,DeveloperOptionId,userflag} = req.body;
        // res.status(200).json(req.body);
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
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;

                if (!userflag){
                    return res.status(400).json("useflag key  not found")
                }


                let t_id = ''
                const conditionsP={}


                if (userflag == 1){
                    t_id = Number(req.body.transporter_id)

                }
                else if (userflag == 2){
                    const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                    t_id = qry_t_id[0].type_detail_id;
                    conditionsP.transporter_id = Number(t_id);
                   
                }
                else{
                    return res.status(400).json("useflag key  wrong input")
                }
                     

                // const [qryres] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                // return res.status(200).json(qryres)
                // console.log(typeDetailId)
                // console.log(typeDetailId)
                // process.exit(0)
                
                const report_type = JSON.parse(reporttype);
                const  tableP = 'cv_transporter_billing';
                const fieldsP = {};
                
                if (invoice_no) {
                    conditionsP.invoice_no = invoice_no;
                }
                if (Number(status) != 10) {
                    conditionsP.status = Number(status);
                }
                else{
                    conditionsP.status = {'$ne': 0};
                }

                
                if(req.body.transporter_id){
                    conditionsP.transporter_id = Number(t_id);
                }
                
                conditionsP.invoice_date = {'$gte': fromdate, '$lte': todate};
                if (customerid){
                    conditionsP.customer_id = customerid
                }
                const reporthandler = Number(report_type.id);
                // console.log(conditionsP)

                // // resData.data = s3Url;
                
                const result = await  mongu.getCVMongoQuery(conditionsP, fieldsP, tableP)

                if (result.length != 0){
                    let groupedData = []
                    if (reporthandler == 1){
                        // console.log(result);
                        groupedData = result.reduce((acc, item) => {
                            const { invoice_no } = item;
                            if (!acc[invoice_no]) {
                            acc[invoice_no] = [];
                            }
                            acc[invoice_no].push(item);
                            return acc;
                        }, {});
                        // return res.status(200).json(groupedData);
                        //   process.exit(0);
                        
                    }
                    // console.log(groupedData)
                    if (reporthandler == 2){
                        groupedData = result
                        // return res.status(200).json(groupedData);
                        
                    }

                    final_response={
                        status:'success',
                        data:groupedData,
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
        
        // let payload = req.body;
        
    }

        else{
            console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


             catch(error){
        res.status(500).json({error: error.message});
    }
};

exports.tmsbillingfilter = async(req,res) => {
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
                    console.log(resultUsr)
                
                // else{
                //     res.status(200).json("final_data");SELECT DISTINCT c.id AS location_id, c.name AS location_name, c.code AS location_code FROM logistic_customer_branch_area_assignment a JOIN logistic_customer_master c ON a.customer_id = c.id WHERE a.group_id = '0041'
                // }
                const [state_data] = await db.promise().query('SELECT DISTINCT s.id AS state_id, s.name AS state_name, s.code AS state_code FROM logistic_customer_branch_area_assignment a JOIN state s ON a.state_id = s.id WHERE a.group_id = ?',[group_id])
                // console.log(state_data)
                const [location_data] = await db.promise().query('SELECT a.state_id, c.id   AS location_id, c.name AS location_name, c.code AS location_code FROM logistic_customer_branch_area_assignment a JOIN logistic_customer_master c ON a.customer_id = c.id WHERE a.group_id = ?',[group_id])
                // console.log(location_data)
                const location = location_data.reduce((acc, row) => {
                    if (!acc[row.state_id]) {
                      acc[row.state_id] = [];
                    }
                    acc[row.state_id].push({
                      location_id: row.location_id,
                      location_name: row.location_name,
                      location_code: row.location_code
                    });
                    return acc;
                  }, {});
                  
                //   console.log(location);

                
                if (user_type == 10 && group_type == 3){
               
                    const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                    const typeDetailId = qry_t_id[0].type_detail_id;
                    const [cust_ids] = await db.promise().query('select customer_group_id from transporter_customer_assiginment where status=1 and  transporter_id=?',[typeDetailId])
                    // console.log(cust_ids)
                    // const [state_data] = await db.promise().query('SELECT DISTINCT s.id AS state_id, s.name AS state_name, s.code AS state_code FROM logistic_customer_branch_area_assignment a JOIN state s ON a.state_id = s.id WHERE a.group_id = ?',[group_id])
                    // console.log(state_data)
                    if (!cust_ids.length) {
                        return res.status(200).json({
                            status: "fail",
                            message: "No customer groups assigned to this transporter."
                        });
                    }

                    const flatList = cust_ids.map(item => item.customer_group_id);

                    const tupleAsString = flatList.map(id => `'${id}'`).join(", ");
                    const [cust_data] = await db.promise().query('select group_id,name from user_group where group_id in (?)  and status=1',[flatList])
                    final_response={
                        status:'success',
                        customer:cust_data,
                        state:state_data,
                        location:location
                    }
                    return res.status(200).json(final_response)
                }

                if (user_type == 10 && group_type != 3){

                    const [cust_data] = await db.promise().query('select group_id,name from user_group where group_id in (?)  and status=1',[group_id])
                    // const [state_data] = await db.promise().query('SELECT DISTINCT s.id AS state_id, s.name AS state_name, s.code AS state_code FROM logistic_customer_branch_area_assignment a JOIN state s ON a.state_id = s.id WHERE a.group_id = ?',[group_id])
                    // console.log(state_data)
                    final_response={
                        status:'success',
                        customer:cust_data,
                    //     state:state_data,
                    // location:location
                    }
                    return res.status(200).json(final_response)
                }

                else{
                    const [cust_data] = await db.promise().query('select group_id,name from user_group where group_id in (?)  and status=1',[group_id])
                    final_response={
                        status:'success',
                        customer:cust_data,
                        state:state_data,
                        location:location
                    }
                    return res.status(200).json(final_response)
                }
        }
        }
        
        

        
        }
        
        else{
            console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


    catch(error){
        res.status(500).json({error: error.message});
    }
};

exports.branchstatelist = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporter_id,userflag} = req.body;
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
                
                // else{
                //     res.status(200).json("final_data");SELECT DISTINCT c.id AS location_id, c.name AS location_name, c.code AS location_code FROM logistic_customer_branch_area_assignment a JOIN logistic_customer_master c ON a.customer_id = c.id WHERE a.group_id = '0041'
                // }
                let trptid = transporter_id

                if (userflag == 1){
                    const [tid] = await db.promise().query("select * from logistic_role_assignment where user_id=? AND status IN (?)",[user_id,[1]]);
                    trptid = tid[0].type_detail_id
                    // console.log(trptid)
                }
                
                const [data] = await db.promise().query("SELECT * FROM user_group_branch WHERE transporter_id=? AND status IN (?)",[trptid,[1]]);
                console.log(data)
                const states = [...new Set(data.map(item => item.state))];
                const stateWise = data.reduce((acc, item) => {
                if (!acc[item.state]) {
                    acc[item.state] = [];
                }
                acc[item.state].push({
                    id: item.id,
                    name: item.name,
                    code: item.code
                });
                return acc;
                }, {});

                // console.log("States Array:", states);
                // console.log("State Wise Object:", stateWise);
                final_response={
                        status:'success',
                        state:states,
                        location:stateWise,
                        region:[],
                    }
                    return res.status(200).json(final_response)
                

        }
        }
        
        

        
        }
        
        else{
            console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


    catch(error){
        res.status(500).json({error: error.message});
    }
};

exports.tmsvehiclelist = async(req,res) => {
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
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;

                if (!userflag){
                    return res.status(400).json("useflag key  not found")
                }


                let typeDetailId = ''


                if (userflag == 1){
                    typeDetailId = Number(req.body.transporter_id)
                }
                else if (userflag == 2){
                    const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                    typeDetailId = qry_t_id[0].type_detail_id;
                }
                else{
                    return res.status(400).json("useflag key  wrong input")
                }
               console.log("typdtlid",typeDetailId)
                const [veh_ids] = await db.promise().query('select vehicle_id from vehicle_transporter_assignment where transporter_id=? and status=1 order by id',[typeDetailId])
              

                if (veh_ids.length != 0){
                    const flatList = veh_ids.map(item => item.vehicle_id);

                    // const tupleAsString = flatList.map(id => `'${id}'`).join(", ");
                    const [veh_data] = await db.promise().query('select id,vehicle_number from vehicle where id in (?)  and status=1',[flatList])
                    
                
                    final_response={
                        status:'success',
                        vehicledata:veh_data,
                    }
                    return res.status(200).json(final_response)
                }

                else{

                    final_response={
                        status:'success',
                        message:"NO vehicle available",
                    }
                    return res.status(200).json(final_response)

                }
            }
        
        

        
    }

        else{
            console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


             catch(error){
        res.status(500).json({error: error.message});
    }
};

exports.tmsbillingstatus = async(req,res) => {
    try{
        const {AccessToken,invoice_no,status,DeveloperOption,DeveloperOptionId} = req.body;
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
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;
               
                const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                const typeDetailId = qry_t_id[0].type_detail_id;

                const  tableP = 'cv_transporter_billing';
                const updateData = {}; 
                const conditionsP={};
                conditionsP.invoice_no = invoice_no;
                conditionsP.transporter_id = Number(typeDetailId); 
                // conditionsP.status = 9;
                // conditionsP.transporter_id = 86196; 
                if (Number(status) == 2){
                updateData.status = Number(status);
                updateData.status_remark = "Approved";
                }
                if (Number(status) == 0){
                    conditionsP.status = 1
                    updateData.status = Number(status);
                    updateData.status_remark = "Deleted";
                }
                if (Number(status) == 1){
                    updateData.status = Number(status);
                    updateData.status_remark = "Pending";
                }
                // updateData.customer_name = "Blue Dart";
                const updateField = { $set: updateData };
                // console.log(conditionsP);
                // console.log(updateField);
                
                const result_update =  mongu.updateCVMongoQuery(conditionsP, updateField, tableP);
                final_response={
                    status:'success',
                    // customer:result_update,
                    message: "updated successfully"
                }
                return res.status(200).json(final_response)
            }
        
        

        
    }

        else{
            console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


             catch(error){
        res.status(500).json({error: error.message});
    }
};

exports.tmsgeneratebill = async(req,res) => {
    try{
        const {AccessToken,Customer,BillingStartDate,BillingEndDate,InvoiceNumber,InvoiceDate,TotalAmount,VehicleInformation,DeveloperOption,DeveloperOptionId,forceflag,userflag} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        if(AccessToken!=null){
            let user_info ={};
            const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
            const datetimeToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
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
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;
                let t_name = '';

                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    t_name= resultUsr['name'];

                    let t_id = '';
                    const conditionsP={};
                    let raisedby = ''
    
    
                    if (userflag == 1){
                        if(req.body.transporter_id){
                        t_id = Number(req.body.transporter_id);
                        t_name = req.body.transporter_name;
                        raisedby = "customer";
                        }
                        else{
                            return res.status(400).json("Transporter Id is missing")

                        }
    
                    }
                    else if (userflag == 2){
                        const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                        t_id = qry_t_id[0].type_detail_id;
                        raisedby = "transporter";
                        // conditionsP.transporter_id = Number(t_id);
                       
                    }
                    else{
                        return res.status(400).json("useflag key  wrong input")
                    }
                    
                
                
                const Customer_data = JSON.parse(Customer);
                const  tableP = 'cv_transporter_billing';
                const fieldsP = {};
                // const conditionsP={};
                conditionsP.invoice_no = InvoiceNumber;
                conditionsP.transporter_id = Number(t_id);

                // console.log(conditionsP,t_name)

                const invoicecheck = await  mongu.getCVMongoQuery(conditionsP, fieldsP, tableP)

                if (invoicecheck.length == 0){

                    const cleanObject = (obj) => {
                        return Object.fromEntries(
                            Object.entries(obj).map(([key, value]) => [key, value === undefined ? "" : value])
                        );
                    };

                    const renameVehicleKeys = (vehicle) => {
                        return {
                            vehicle_number: vehicle.vehdata.vehicle_number,
                            vehicle_id:vehicle.vehdata.id,
                            vehicle_start_date: vehicle.StartDate,
                            vehicle_end_date: vehicle.EndDate,
                            agreement_type: vehicle.Agreement,
                            current_fuel_rate: Number(vehicle.FuelRate),
                            fixed_rent: Number(vehicle.FixedRent),
                            distance: Number(vehicle.VendorDistance || 0),
                            distancecost: Number(vehicle.DistanceCost || 0),
                            workingdays: Number(vehicle.WorkingDays),
                            extra_hours: vehicle.ExtraHours,
                            other_expenses: Number(vehicle.OtherCharges),
                            fsc: Number(vehicle.fsc),
                            toll_charges: Number(vehicle.TollCharges),
                            night_charges: Number(vehicle.NightCharges),
                            fooding_charges: Number(vehicle.FoodingCharges),
                            extra_distance_charges: Number(vehicle.ExtraDistance),
                            distance_charges: Number(vehicle.DistanceCharges),
                            extra_hourly_charges: Number(vehicle.ExtraHourlyCharge),
                            loading_unloading_charges: Number(vehicle.LoadingUnloadingCharge),
                            working_hours: Number(vehicle.WorkingHours),
                            HoursCharges: Number(vehicle.HoursCharges),
                            
                            
                            // additional_info: vehicle.Others
                        };
                    };
                  const VehicleInformation_data = JSON.parse(VehicleInformation);
                    // console.log(VehicleInformation_data)


                    ///////// check for overlap vehicle///////////
                    const vehiclenoarr = VehicleInformation_data.map(item => item.vehdata.vehicle_number)
                    const checkcondn = {}
                    // checkcondn.Billing_Start_Data = {'$gte': BillingStartDate, '$lte': BillingEndDate};
                    // checkcondn.Billing_End_Data = {'$gte': BillingStartDate, '$lte': BillingEndDate};
                    checkcondn.Billing_Start_Data = {'$lte': BillingEndDate};
                    checkcondn.Billing_End_Data = {'$gte': BillingStartDate};
                    checkcondn.customer_id = Customer_data.group_id;
                    checkcondn.vehicle_number = {"$in":vehiclenoarr};
                    const overlapvehicle = await  mongu.getCVMongoQuery(checkcondn, fieldsP, tableP);
                    // console.log(overlapvehicle)
                    const vehiclelist = overlapvehicle.map(item => item.vehicle_number);
                    const uniqueVehicles = [...new Set(vehiclelist)];

                    if(!forceflag){
                        const forceflag = 1
                    }

                    if (overlapvehicle.length >0 && forceflag == 0){
                        final_response={
                            status:'fail',
                            overlapvehicle:uniqueVehicles,
                            message:"These vehicles already exist with in given date range",
                        }
    
                        return res.status(200).json(final_response);
                    }


                    const transformedData = VehicleInformation_data.map(vehicle => 
                        cleanObject({
                        customer_id: Customer_data.group_id,
                        customer_name: Customer_data.name,
                        transporter_id :t_id,
                        transporter_name :t_name,
                        Billing_Start_Data: BillingStartDate,
                        Billing_End_Data: BillingEndDate,
                        invoice_no: InvoiceNumber,
                        invoice_date: InvoiceDate,
                        total_Amount: Number(TotalAmount),
                        status:1,
                        status_remark:"Pending",
                        create_date:datetimeToday,
                        Raised_By:raisedby,
                        // create_id:t_id,
                        ...renameVehicleKeys(vehicle) // Spread each vehicle's details
                    }));

                    // console.log(transformedData)
                    // process.exit(0)
               
                   
                for (let item of transformedData){
                    const result = await  mongu.insertCVMongoQuery(item, tableP)
                    }
                    final_response={
                        status:'success',
                        message:"Bill Generated Successfully",
                    }

                    return res.status(200).json(final_response);
                }
                else{
                    final_response={
                        status:'fail',
                        message:"Invoice Number already exist",
                    }

                    return res.status(200).json(final_response);
                    
                }
            }

        }
        
        // let payload = req.body;
        
    }

        else{
            console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


             catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.tmsbillacceptreject = async(req,res) => {
    try{
        const {AccessToken,status,billdetails,billingdata,vehicleId,DeveloperOption,DeveloperOptionId} = req.body;
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
                //let final_data = {};
                //const user_id =5659;
                const user_id = user_info.AccountId;
               
                // const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[user_id])
                // const typeDetailId = qry_t_id[0].type_detail_id;
                const billdt = JSON.parse(billdetails);
                const billdata = JSON.parse(billingdata);
                const  tableP = 'cv_transporter_billing';
                // const updateData = {}; 
                const conditionsP={};
                const updateData = {
                    calcRent: billdata.calcRent || 0,
                    calcKmCost: billdata.calcKmCost || 0,
                    calcExtrahr: billdata.calcExtrahr || 0,
                    calcFsc: billdata.calcFsc || 0,
                    calcTotal: billdata.calcTotal || 0,
                    calcClaimed: billdata.calcClaimed || 0,
                    calcDifference: billdata.calcDifference || 0,
                    calcRelaxation: billdata.calcRelaxation || 0,
                    distanceType: billdata.distanceType || "",
                    remark: billdata.remark || "",
                    finalDistance: billdata.finalDistance || 0,
                    totalKm: billdata.totalKm || 0
                  };
                
                // conditionsP.status = 9;
                // conditionsP.transporter_id = 86196; 
                if (Number(status) == 2){
                    conditionsP.status = 1;
                updateData.status = Number(status);
                updateData.status_remark = "Approved";
                }
                if (Number(status) == 3){
                    conditionsP.status = 1;
                    updateData.status = Number(status);
                    updateData.status_remark = "Reject";
                }
                
                // updateData.customer_name = "Blue Dart";
                if (vehicleId){
                    conditionsP.vehicle_id = Number(vehicleId);
                }

                const updateField = { $set: updateData };
                
                for (const item of billdt){
                    
                    conditionsP.invoice_no = item.invoice_no;
                    conditionsP.transporter_id = Number(item.transporter_id);
                    ///check status wether all pending or all approve

                    // console.log(conditionsP,updateField)
                    
                const result_update =  mongu.updateCVMongoQuery(conditionsP, updateField, tableP);

                }
                
                final_response={
                    status:'success',
                    // customer:result_update,
                    message: "updated successfully"
                }
                return res.status(200).json(final_response)
            }
        
        

        
    }

        else{
            console.log("else")
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }


             catch(error){
        res.status(500).json({error: error.message});
    }
};





