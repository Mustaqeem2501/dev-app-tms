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



exports.ordervehicledriverdata = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,vehicleid,driverid} = req.body;
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
                    
                    const sql3=`select id,name from document_types where category="vehicle" and status = 1`;
                    const [rawvehdocuments] = await db.promise().query(sql3);
                    const sql4=`select id,name from document_types where category="driver" and status = 1`;
                    const [rawdriverdoc] = await db.promise().query(sql4);
                    const vehdocuments = rawvehdocuments.filter(item => item.id !== 8 && item.id !== 9 && item.id !== 11 && item.id !== 17);
                    const driverdoc = rawdriverdoc.filter(item => item.id !== 4 && item.id !== 14);
                    // console.log(vehdocuments)
                    // console.log(driverdoc)
                    // const sql1 = `select d.id,DATE_FORMAT(d.expiry_date, '%Y-%m-%d %H:%i:%s') AS expiry_date,d.file_path,d.doc_no,
                    // d.doc_type_id,dt.name,DATE_FORMAT(d.issue_date, '%Y-%m-%d %H:%i:%s') AS issue_date
                    //     from documents d left join document_types dt on d.doc_type_id = dt.id where d.vehicle_id = ? and d.status = 1`
                    const sql1 = `select d.id,DATE_FORMAT(d.expiry_date, '%Y-%m-%d') AS expiry_date,d.file_path,d.doc_no,
                d.doc_type_id,dt.name,DATE_FORMAT(d.issue_date, '%Y-%m-%d') AS issue_date
                    from documents d left join document_types dt on d.doc_type_id = dt.id where d.vehicle_id = ? and d.status = 1`
                    const [vehicledocuments] = await db.promise().query(sql1,[vehicleid]);

                    // console.log(vehicledocuments)
                    // const sql7 = `select id,vehicle_number,vehicle_capacity_tons,vehicle_type,is_gps,is_portable_e_lock,
                    //         is_tarpaulin,is_fixed_door_e_lock,is_fire_extinguisher,is_dual_driver from vehicle where id = ?`
                    // const [vehicledetails] = await db.promise().query(sql7,[vehicleid]);

                    const sql8 =`SELECT v.id, v.vehicle_number, v.vehicle_capacity_tons, vc.capacity AS vehicle_capacity,
                     COALESCE(v.body_type_id, '') AS vehicle_type, COALESCE(vt.name, '') AS vehicle_type_name,
                      COALESCE(vt.code, '') AS vehicle_type_code, v.is_gps, v.is_portable_e_lock, v.is_tarpaulin, v.is_fixed_door_e_lock,
                       v.is_fire_extinguisher, v.is_dual_driver FROM vehicle v LEFT JOIN vehicle_types vt ON 
                       v.body_type_id = vt.id LEFT JOIN vehicle_capacity vc ON v.vehicle_capacity_tons = vc.id WHERE v.id = ?`

    //                 const sql8 = `SELECT v.id, v.vehicle_number, v.vehicle_capacity_tons, vc.capacity AS vehicle_capacity, 
    //                 v.vehicle_type, vt.name AS vehicle_type_name, vt.code AS vehicle_type_code, v.is_gps, v.is_portable_e_lock,
    //                  v.is_tarpaulin, v.is_fixed_door_e_lock, v.is_fire_extinguisher, 
    // v.is_dual_driver FROM vehicle v LEFT JOIN vehicle_types vt ON v.vehicle_type = vt.id LEFT JOIN vehicle_capacity vc ON v.vehicle_capacity_tons = vc.id WHERE v.id = ?;`
                    const [vehicledetails1] = await db.promise().query(sql8,[vehicleid]);

                    // console.log(vehicledetails1)
                    // process.exit(0)
                    
                    const transformvehicledetails = vehicledetails1.map((vehicle) => ({
                        id: vehicle.id,
                        vehicle_number: vehicle.vehicle_number,
                        vehicle_capacity_tons: vehicle.vehicle_capacity,
                        vehicle_type: vehicle.vehicle_type_name,
                        safety_features: [
                          { name: "Elock", id: 1, value: vehicle.is_fixed_door_e_lock === 1 },
                          { name: "GPS", id: 2, value: vehicle.is_gps === 1 },
                          { name: "Dual Driver", id: 3, value: vehicle.is_dual_driver === 1 },
                          { name: "Fire Fighting", id: 4, value: vehicle.is_fire_extinguisher === 1 },
                          { name: "Portable E-Lock", id: 5, value: vehicle.is_portable_e_lock === 1 },
                          { name: "Tarpaulin", id: 6, value: vehicle.is_tarpaulin === 1 },
                        ],
                      }));

                    //   console.log(vehicledocuments)
                    const docObject = vehicledocuments.reduce((acc, doc) => {
                        acc[doc.doc_type_id] = doc;
                        return acc;
                      }, {});

                    const currentDate = new Date();
                    const vehres = {};
                    const now = new Date();
                    const currentDate1 = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // zero time part


                    // console.log(docObject)

                    // vehdocuments.forEach(item => {
                    //     const key = item.id.toString();
                    //     if (docObject[key]) {
                    //         let expiryDate = new Date(docObject[key].expiry_date);
                    //         docObject[key].expiryremark = expiryDate < currentDate1 ? "expired" : "";
                    //         vehres[key] = { ...docObject[key], status: 1, message: "" };
                    //     } else {
                    //         vehres[key] = {
                    //         id: "",
                    //         expiry_date: "",
                    //         file_path: '',
                    //         doc_no: '',
                    //         doc_type_id: item.id,
                    //         name: item.name,
                    //         issue_date: "",
                    //         expiryremark: '',
                    //         status: 0,
                    //         message: "No data"
                    //         };
                    //     }
                    // });

                    vehdocuments.forEach(item => {
                        const key = item.id.toString();
                        if (docObject[key]) {
                            let expiryDate = new Date(docObject[key].expiry_date + "T00:00:00"); // ensure time set zero for correct parsing
                            docObject[key].expiryremark = expiryDate < currentDate1 ? "expired" : "";
                            vehres[key] = { ...docObject[key], status: 1, message: "" };
                        } else {
                            vehres[key] = {
                                id: "",
                                expiry_date: "",
                                file_path: '',
                                doc_no: '',
                                doc_type_id: item.id,
                                name: item.name,
                                issue_date: "",
                                expiryremark: '',
                                status: 0,
                                message: "No data"
                            };
                        }
                    });
                    


                    //////Driver details////////
                    const sql2 = `select d.id,DATE_FORMAT(d.expiry_date, '%Y-%m-%d %H:%i:%s') AS expiry_date,d.file_path,d.doc_no,d.doc_type_id,dt.name,
                    DATE_FORMAT(d.issue_date, '%Y-%m-%d %H:%i:%s') AS issue_date
                        from documents d left join document_types dt on d.doc_type_id = dt.id where d.driver_id = ? and d.status = 1`
                    const [driverdocuments] = await db.promise().query(sql2,[driverid]);
                    // console.log(driverdocuments)
                    const sql6 = `select id,name,mob_no from drivers where id = ?`
                    const [driverdetails] = await db.promise().query(sql6,[driverid]);

                    const docObjectdriver = driverdocuments.reduce((acc, doc) => {
                        acc[doc.doc_type_id] = doc;
                        return acc;
                      }, {});

                    const drvres = {};

                    driverdoc.forEach(item => {
                        const key = item.id.toString();
                        if (docObjectdriver[key]) {
                            let expiryDate = new Date(docObjectdriver[key].expiry_date);
                            docObjectdriver[key].expiryremark = expiryDate < currentDate ? "expired" : "";
                            drvres[key] = { ...docObjectdriver[key], status: 1, message: "" };
                        } else {
                            drvres[key] = {
                            id: "",
                            expiry_date: "",
                            file_path: '',
                            doc_no: '',
                            doc_type_id: item.id,
                            name: item.name,
                            issue_date: "",
                            expiryremark: '',
                            status: 0,
                            message: "No data"
                            };
                        }
                        });

                    final_response={
                        status:'success',
                        vehiclemaster:vehdocuments,
                        drivermaster:driverdoc,
                        vehicledata:transformvehicledetails[0],
                        vehicledocs:vehres,
                        driverdata:driverdetails[0],
                        driverdocs:drvres
                        }
                    return res.status(200).json(final_response)
               
            }
            }
        }
        else{
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};



exports.getdriverlist = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,customerid} = req.body;
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
                    console.log(user_id)
                    
                    
                    // console.log(driverdocuments)
                    const sql6 = `SELECT d.id, d.name FROM drivers d 
                            INNER JOIN driver_group_user_mapping dgum ON d.id = dgum.driver_id WHERE dgum.user_id = ?`
                    const [driverdetails] = await db.promise().query(sql6,[user_id]);

                    // console.log(driverdetails)


                    final_response={
                        status:'success',
                        drivermaster:driverdetails,
                        }
                    return res.status(200).json(final_response)
               
            }
            }
        }
        else{
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.statusupdate = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporter_id,status,status_remark,order_id,rejectby} = req.body;
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

                    if(!transporter_id){final_response={
                        status:'fail',
                        message:"No Transporterid",
                        }
                    return res.status(200).json(final_response)}
                    if(!order_id){final_response={
                        status:'fail',
                        message:"No Transporterid",
                        }
                    return res.status(200).json(final_response)}
                    
                    const create_date= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                    const  tableP1 = 'cv_indent_transporter_request';
                    const updateData = {}; 
                    const conditionsP={};
                    conditionsP.request_id = order_id;
                    conditionsP.transporter_id = Number(transporter_id); 
                    updateData.edit_date = create_date;
                    updateData.status_remark = status_remark;
                    updateData.status = Number(status);
                    if(status == 2){
                        updateData.rejectedby = rejectby;
                    }
                    
                    
                    const updateField = { $set: updateData };

                    // console.log(conditionsP,updateField);
                    // process.exit(0);
                    
                    const result_update =  mongu.updateCVMongoQuery(conditionsP, updateField, tableP1);

                    // console.log(driverdetails)


                    final_response={
                        status:'success',
                        message:"Updated Successfully",
                        }
                    return res.status(200).json(final_response)
               
            }
            }
        }
        else{
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.acceptquote = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporter_id,order_id} = req.body;
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

                    if(!transporter_id){final_response={
                        status:'fail',
                        message:"No Transporterid",
                        }
                    return res.status(200).json(final_response)}
                    if(!order_id){final_response={
                        status:'fail',
                        message:"No OrderId",
                        }
                    return res.status(200).json(final_response)}
                    
                    const create_date= moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                    const  tableP1 = 'cv_indent_transporter_request';
                    const updateData = {}; 
                    const conditionsP={};
                    conditionsP.request_id = order_id;
                    conditionsP.status = 5;
                    updateData.edit_date = create_date;
                    updateData.status_remark = "Accepted";
                    updateData.status = 0;
                    conditionsP.transporter_id = Number(transporter_id); 
                    const updateField1 = { $set: updateData };

                    console.log(conditionsP,updateField1)
                    const result_update1 =  mongu.updateCVMongoQuery(conditionsP, updateField1, tableP1);

                    const conditionsP1={};
                    conditionsP1.request_id = order_id;
                    conditionsP1.status = {$ne:0};
                    updateData.status_remark = "Rejected";
                    updateData.status = 2;
                    
                    const updateField = { $set: updateData };
                    console.log(conditionsP1,updateField)
                    
                    const result_update =  mongu.updateCVMongoQuery(conditionsP1, updateField, tableP1);


                    final_response={
                        status:'success',
                        message:"Updated Successfully",
                        }
                    return res.status(200).json(final_response)
               
            }
            }
        }
        else{
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.useridtotranporterid = async(req,res) => {
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId,userid} = req.body;
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
                    
                    const [qry_t_id] = await db.promise().query('select * from logistic_role_assignment where user_id=?',[userid])
                    t_id = qry_t_id[0].type_detail_id;

                    final_response={
                        status:'success',
                        transporterid:t_id,
                        }
                    return res.status(200).json(final_response)
               
            }
            }
        }
        else{
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
        
    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};







