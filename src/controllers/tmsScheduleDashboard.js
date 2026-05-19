const { json } = require("body-parser");
const db = require("../config/db");
const {passenc}= require("../helpers/pass_enc");
const mongu =require("../lib/mongo/mongo_api");
const tokenWeb= require("../helpers/access_token_web");
//const commonComponent = require("./components/commonComponent");
const { format, subHours, differenceInSeconds } = require('date-fns');
const moment = require('moment-timezone');
const dayjs = require('dayjs');

//-------------Already Functions---------------//
//calculateDistance
//date_formating (MM/DD/YYYY HH:mm)
//secondsToTimeLocal (h:m:s)
//getTimeDecimalHr
//decimalHours
//strtotime
//---------------------------------------------//


//dtdctripreport
exports.tmsScheduleDashboardFilter = async(req,res) => {
    try{
        let resData={};
        let final_data={};
        resData.Status="fail";
        const {AccessToken,DeveloperOption,DeveloperOptionId} = req.body;
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
            let response ={};
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    //res.status(200).json(response);
                    resData.Message=user_info.Message;
                    res.status(200).json(resData);
            }
            else{
                

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
                    
                    //console.log(resultUsr);
                    //getting customer from master db
                    const customer_bin={};
                    const [LCustomer] = await db.promise().query("SELECT `code` FROM logistic_customer_master WHERE  `status` =? AND `group_id` = ?",[1,group_id]);
                    if(LCustomer.length >0)
                    {
                        LCustomer.forEach(row => {
                            customer_bin[row.code] = row.code;
                        });
                    }

                    //getting route master
                    const route_bin ={};
                    const [CourierRoute] = await db.promise().query("SELECT `route_code` FROM courier_route WHERE  `status` =? AND `group_id` = ?",[1,group_id]);
                    if(CourierRoute.length >0)
                    {
                        CourierRoute.forEach(row => {
                            route_bin[row.route_code] = row.route_code;
                        });
                    }

                    //feeder_type_parent
                    const feeder_parent_bin ={};
                    const [FeederTypeParent] = await db.promise().query("SELECT `id`,`name` FROM feeder_type_parent WHERE  `status` =? AND `group_id` = ? AND `id` not in (33,34) ",[1,group_id]);
                    if(FeederTypeParent.length >0)
                        {
                            FeederTypeParent.forEach(row => {
                                feeder_parent_bin[row.id] = row.name;
                            });
                        }
                    //feeder type
                    const feeder_type_bin ={};
                    const [FeederType] = await db.promise().query("SELECT `feeder_type_group_id`,`type` FROM feeder_type WHERE  `status` =? AND `group_id` = ? and feeder_type_group_id not in(33,34) order by sequence_no  asc",[1,group_id]);
                    //console.log(FeederType);
                    if(FeederType.length >0)
                        {
                            FeederType.forEach(row => {
                                let feeder_type_bin_tmp={};
                                const feedertypegroupid = row.feeder_type_group_id;
                                const type = row.type;
                                // Initialize the nested object if it doesn't exist
                                if (!feeder_type_bin[feedertypegroupid]) {
                                    feeder_type_bin[feedertypegroupid] = {};
                                }
                                feeder_type_bin[feedertypegroupid][type] = type;
                            });
                        }
                    
                    //zone
                    const zone_bin={};
                    const [Zone] = await db.promise().query("SELECT `id`,`zone_name`,`zone_code` FROM logistic_zone WHERE  `status` =? AND `group_id` = ?",[1,group_id]);
                    //console.log(Zone);
                    if(Zone.length >0)
                        {
                            Zone.forEach(row => {                               
                                //zone_bin[row.id] =  row.zone_code+"("+row.zone_name +")";
                                zone_bin[row.zone_code] =  row.zone_code+"("+row.zone_name +")";
                            });
                        }
             

                    const eta_filter ={};
                    eta_filter["0"] ="All";
                    eta_filter["1.9"] ="< 2 Hrs.";
                    eta_filter["2"] ="2 Hrs.";
                    eta_filter["4"] ="4 Hrs.";
                    eta_filter["8"] ="8 Hrs.";
                    eta_filter["12"] ="12 Hrs.";

                    const supervisor_exception ={};
                    supervisor_exception["0"] ="All";
                    supervisor_exception["1"] ="Vehicle outside Master";
                    supervisor_exception["2"] ="Route outside Master";
                    supervisor_exception["3"] ="Fleet outside Master";
                    supervisor_exception["4"] ="Delayed Departure";
                    supervisor_exception["5"] ="Delayed Arrival";
                    supervisor_exception["6"] ="TT Delayed";
                    supervisor_exception["7"] ="Trip Manual Close";
                    supervisor_exception["8"] ="Trip Cancelled";

                    const trip_status ={};
                    trip_status[""] ="All";
                    trip_status["1"] ="Schedule";
                    trip_status["0"] ="Completed";
                    trip_status["2"] ="Cancelled";

                    const vendor_filter ={};
                    vendor_filter["1"] ="All";
                    vendor_filter["2"] ="ILGIC";
                    vendor_filter["3"] ="Third Party";
                    
                    const [TransportersRole] = await db.promise().query("SELECT type_detail_id FROM logistic_role_assignment WHERE status =? AND user_id = ?", [1, user_id]);

                    let forCustomerGroupid = [];

                    if (TransportersRole.length > 0) {
                        let type_detail_id = TransportersRole[0].type_detail_id;
                        
                        const [Transporters] = await db.promise().query("SELECT customer_group_id FROM transporter_customer_assiginment WHERE status =? AND transporter_id = ?", [1, type_detail_id]);

                        if (Transporters.length > 0) {
                            forCustomerGroupid = Transporters.map((row) => row.customer_group_id);
                        }
                    }

                    let customerName = {};
                    if (forCustomerGroupid.length > 0) {
                        const [customerNameResults] = await db.promise().query("SELECT group_id, name FROM user_group WHERE status =? AND group_id IN (?)", [1, forCustomerGroupid]);

                        customerName = customerNameResults.reduce((acc, { group_id, name }) => {
                            acc[group_id] = name;
                            return acc;
                        }, {});
                    }

                   
                    final_data["Master"] = {
                       // Region:zone_bin,
                        //Customer: customer_bin,
                        Route:route_bin,
                        //RouteCategory: feeder_parent_bin,
                        //RouteType:feeder_type_bin,                                            
                        ETADelay: eta_filter,
                        //SupervisorException: supervisor_exception,
                        TripStatus: trip_status,
                        //Vendor:vendor_filter
                        ForCustomer:customerName
                    }


                    resData.Status="success";
                    resData.Filter=final_data;
                    // to do code
                    //////END//////////
                }
                //res.status(200).json("success");
                res.status(200).json(resData);
            }
        }
        else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
};

exports.tmsScheduleDashboard = async(req,res) => {
    try{
        const {AccessToken,RouteType,RouteCategory,Origin,Destination,Route,Region,Delay,TripDetails,ForCustomer,DeveloperOption,DeveloperOptionId,Vendor,Transporter} = req.body;
        console.log("ForCustomer",ForCustomer)
        
        let response ={};
        let final_data = {};
        let countoftrip = 0;
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
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    let group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 

                    if(user_type==25 || user_type==52 || user_type==57 || user_type==23 || user_type==9)
                    {
                        final_data.Message="Access Not Allowed";
                        res.status(501).json(final_data);
                        return;
                    }

                    let dbFlag=0;
                    let tableP = 'cv_transporter_trip_detail';
                    let tableC= 'cv_transporter_trip_detail_customer';
                    let conditions = {};
                    let conditionsP = {};
                    let conditionsP2={};
                    if( ForCustomer ==""){
                        
                        conditions.group_id=group_id;
                    }
                    else if(ForCustomer && ForCustomer !="" && ForCustomer == "0041")
                    {
                        tableP = 'courier_trip_detail';
                        tableC= 'courier_trip_detail_customer';
                        conditions.group_id=ForCustomer;
                        dbFlag = "0041";
                        group_id = "0041"
                    }
                    else if(ForCustomer && ForCustomer !="" && ForCustomer == "5691")
                    {
                        tableP = 'dtdc_trip_detail';
                        tableC= 'dtdc_trip_detail_customer';
                        conditions.group_id=ForCustomer;
                        dbFlag = "5691";
                        group_id = "5691"
                    }
                    console.log("user_id",user_id);
                    let transporter_name="";
                    const [TransportersRole] = await db.promise().query("SELECT type_detail_id FROM logistic_role_assignment WHERE  status =? AND user_id = ? ",[1,user_id]);
                    console.log("TransportersRole",TransportersRole);
                    
                    let transporter_id=0;
                    let typeDetailId = [];
                    if(TransportersRole)
                    {
                        let type_detail_id=TransportersRole[0].type_detail_id;
                        TransportersRole.forEach(row => {
                            typeDetailId.push(row.type_detail_id.toString());
                        })

                        // console.log("transporter_id",typeDetailId);process.exit(0);
                        let transporterId = [];
                        const [Transporters] = await db.promise().query("SELECT id,name,code FROM transporters WHERE  status =? AND id IN (?)",[1,typeDetailId]);
                        if(Transporters.length >0)
                        {
                            // transporter_id= Transporters[0].id;
                            // transporterId =  Transporters.map((row) => row.id).join(",").toString();
                            Transporters.map((row) => {
                                transporterId.push(row.id.toString());
                            })

                        }
                        // console.log(transporterId);process.exit(0);
                        
                        conditions.transporter_id= {'$in':transporterId};
                        conditionsP.transporter_id= {'$in':transporterId};
                        conditionsP2.transporter_id= {'$in':transporterId};
                    }

                    // console.log("dbFlag",dbFlag ,  "tableP",tableP,"tableC",tableC ,"conditions",conditions);
                    
                    // process.exit(0);
                    // to do code
                    // const  tableP = 'courier_trip_detail';
                    const fieldsP = {};
                    // const conditionsP={};
                    // const conditionsP2={};

                    
                    conditionsP.group_id=group_id;
                    conditionsP2.group_id=group_id;            

                    conditionsP.trip_status=1;
                    conditionsP2.trip_status=0;

                    //====CURRENT DATE=======//
                    const dateTodayTrip_t= moment().tz('Asia/Calcutta').format("YYYY-MM-DD"); 
     
                    //====NEXT DATE=========//
                    const dateTodayTrip = dayjs(dateTodayTrip_t).add(1, 'day').format('YYYY-MM-DD');
                    //====PREVIOUS DATE=====//
                    const previous_date = dayjs(dateTodayTrip_t).subtract(1, 'day').format('YYYY-MM-DD');
                    //PREVIOUS DATE 5 Day====//
                    const previous_date_back = dayjs(dateTodayTrip_t).subtract(5, 'day').format('YYYY-MM-DD');
                   
                    let previous_dateTrip = previous_date + " 00:00:00";
                    let current_dateTrip = dateTodayTrip + " 23:59:59";
                    let current_dateTrip1 = dateTodayTrip_t + " 00:00:00";
                    let current_dateTrip2 = dateTodayTrip_t + " 23:59:59";
                    let previous_dateTrip1 = previous_date + " 23:59:59";
                    let previous_dateTrip_back = previous_date_back + " 23:59:59";
                   
                    const feeder_parent_bin ={};
                    const [FeederTypeParent] = await db.promise().query("SELECT `id`,`name` FROM feeder_type_parent WHERE  `status` =? AND `group_id` = ? AND `id` not in (33,34)",[1,group_id]);
                    if(FeederTypeParent.length >0)
                    {
                        FeederTypeParent.forEach(row => {
                            feeder_parent_bin[row.id] = row.name;
                        });
                    }

                    let post_route_category =RouteCategory;
                    let post_route_type =RouteType;
                    
                   if(RouteCategory )
                    {
                        // to do code
                        if(post_route_category && post_route_category.length >0)
                        {
                            let post_route_category_array = post_route_category.split(",");
                            let post_route_category_arr = post_route_category_array.map(val_route => parseInt(val_route, 10));
                            conditionsP.trip_type={'$in':post_route_category_arr};
                            conditionsP2.trip_type={'$in':post_route_category_arr}; 

                        }
                        else
                        {
                            //to do code
                        }
                        
                    }
                    
                    if(Origin)
                    {
                        conditionsP.source_code=Origin;
                        conditionsP2.source_code=Origin;                        
                    }
                    if(Destination)
                    {
                        conditionsP.destination_code=Destination;
                        conditionsP2.destination_code=Destination;                        
                    }
                    if(Region)
                    {
                        let post_region_arr = Region.split(",");
                        conditionsP.region_code={'$in':post_region_arr};//Region;
                        conditionsP2.region_code={'$in':post_region_arr};//Region; 
                       
                    }
                    if(Route)
                    {
                        conditionsP.route_code=Route;
                        conditionsP2.route_code=Route;                        
                    }

                    if(RouteType && post_route_type.length >0)
                    {
                       
                        let post_route_type_arr = post_route_type.split(",");
                        conditionsP.shipment_method={'$in':post_route_type_arr};
                        conditionsP2.shipment_method={'$in':post_route_type_arr};                        
                        let default_filter_route_type_arr_chunk = [];
                        for (let i = 0; i < post_route_type_arr.length; i += 1) {
                            default_filter_route_type_arr_chunk.push(post_route_type_arr.slice(i, i + 1));
                        }

                        let conditions_dtdc_trip=[];
                        const routeArray = RouteType.split(',');
                        conditions_dtdc_trip.shipment_method = { $in: Object.values(routeArray)}
                    }

                    let flag_get_no_data=0;
                    let factid =[];
                    let courier_route_ids=[];

                    const zone_bin={};
                    const [Zone] = await db.promise().query("SELECT `id`,`zone_name` FROM logistic_zone WHERE  `status` =? AND `group_id` = ?",[1,group_id]);
                    //console.log(Zone);
                    if(Zone.length >0)
                    {
                        Zone.forEach(row => {                               
                            zone_bin[row.id] = row.zone_name;
                        });
                    }
        
                    const customer_zone={};
                    const [ZoneCustomer] = await db.promise().query("SELECT `customer_id`,`zone_id` FROM logistic_customer_zone_mapping WHERE  `status` =? AND `group_id` = ?",[1,group_id]);
                    if(ZoneCustomer.length >0)
                    {
                        ZoneCustomer.forEach(row => {                               
                            customer_zone[row.customer_id] = row.zone_id;
                        });
                    }
                    const current_time = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                    
                    let offsetP = 0;
                    let results = [];
               
                   if(flag_get_no_data==0)
                   {
                        const fieldsP1 = {}
                        // const result_valP_TEMP = await  mongu.getMongoQuery(conditionsP, fieldsP1, tableP);
                        let result_valP_TEMP =[];
                        if(dbFlag=="0041"){
                            console.log(conditionsP, fieldsP1, tableP);
                            
                            result_valP_TEMP = await  mongu.getMongoQuery(conditionsP, fieldsP1, tableP);
                            console.log("result_valP_TEMP",result_valP_TEMP.length);
                            
                        }else{
                            result_valP_TEMP = await  mongu.getCVMongoQuery(conditionsP, fieldsP1, tableP);
                        }
                        
                      
                        results = results.concat(result_valP_TEMP);

                        conditionsP2.close_date ={
                            $gte: current_dateTrip1, 
                            $lte: current_dateTrip2 
                        }

                        let offsetP2 = 0;                  
                        const fieldsP2 = {}
                        // const result_valP_TEMP2 = await  mongu.getMongoQuery(conditionsP2, fieldsP2, tableP);
                        let result_valP_TEMP2 =[];
                        if(dbFlag=="0041"){
                            result_valP_TEMP2 = await  mongu.getMongoQuery(conditionsP2, fieldsP2, tableP);
                        }else{
                            result_valP_TEMP2 = await  mongu.getCVMongoQuery(conditionsP2, fieldsP2, tableP);
                        }
                        results = results.concat(result_valP_TEMP2);
                    }
                   
                    let cass_data_current = [];
                    let cass_data_location_current = [];
                    let cass_data = [];
                    let cass_data_location = [];
                    let cass_data2 = [];
                    let cass_data_location2 = [];
                    let cass_data3 = [];
                    let cass_data_location3 = [];
                    
                    let eta_data = {};
                    let edt_data = {};
                    let dfgstatus_data = {};

                    let dfglocation_data = [];
                    let coverdistance_data = [];
                    let all_imei_arr=[];
                    let shipment_bin = [];
                    let shipment_open_bin =[];
                    let ids_open=[];
                    let ids=[];
                    if(results.length >0)
                    {
                        results.forEach((value) => { 
                            if (courier_route_ids.length > 0 && user_type == 19) {
                                if (!courier_route_ids.includes(value.route_id)) {
                                    return; // Skips iteration if route_id is not in routeids
                                }
                            }

                            if (factid && factid.length > 0) {
                                let flag_zone_continue = 0;
                            
                                // Check if source_id is in factid array
                                if (factid.includes(value.source_id)) {
                                    flag_zone_continue = 1;
                                }
                            
                                // Check if destination_id is in factid array
                                if (factid.includes(value.destination_id)) {
                                    flag_zone_continue = 1;
                                }
                            
                                // If flag_zone_continue is still 0, skip this iteration
                                if (flag_zone_continue == 0) {
                                    return;
                                }
                            }

                            if(value.imei_no)
                            {
                                all_imei_arr.push(value.imei_no);
                            }
                            if(value.imei_no2)
                            {
                                all_imei_arr.push(value.imei_no2);
                            }
                            if(value.imei_no3)
                            {
                                all_imei_arr.push(value.imei_no3);
                            }

                            //filter for gps vendor
                            let gpsv1=value.gps_vendor_name;
                            let gpsv2=value.gps_vendor2;
                            let gpsv3=value.gps_vendor3;
                            let flag_not_ilgic=0;
                            if(gpsv1=="Secutrak")
                            {
                                gpsv1="ILGIC";
                                flag_not_ilgic=1;
                            }
                            if(gpsv2=="Secutrak")
                            {
                                gpsv2="ILGIC";
                                flag_not_ilgic=1;
                            }
                            if(gpsv3=="Secutrak")
                            {
                                gpsv3="ILGIC";
                                flag_not_ilgic=1;
                            }
                            
                            if(Vendor && (Vendor=="2" || Vendor==2)) //fo ilgic
                            {
                                if(flag_not_ilgic==0)
                                {            
                                    return;
                                }
                            }
                            if(Vendor && Vendor=="3" || Vendor==3) //fo third party
                            {
                                if(flag_not_ilgic==1)
                                {            
                                    return;
                                }
                            }
                            //Transporter Filter
                            if(Transporter && Transporter!="")
                            {
                                if(Transporter!=value.transporter_name)
                                {
                                    return;
                                }
                            }

                            shipment_bin.push(value.shipment_no);
                            const m_trip_id = String(value._id.$oid);
                            ids.push(m_trip_id);
                            if(value.trip_status ==1)
                            {
                                shipment_open_bin.push(value.shipment_no);
                                ids_open.push(m_trip_id);
                            }
                        });
                    }
                    //console.log(all_imei_arr.length);
                    
                    const imei_chunk = [];
                    for (let i = 0; i < all_imei_arr.length; i += 400) {
                        imei_chunk.push(all_imei_arr.slice(i, i + 400));
                    }

                    const shipment_noschk = [];
                    //const entries = Object.entries(shipment_bin);
                    for (let i = 0; i < shipment_bin.length; i += 400) {
                        shipment_noschk.push(shipment_bin.slice(i, i + 400));
                    }

                    const shipment_open_noschk = [];
                    //const entries = Object.entries(shipment_open_bin);
                    for (let i = 0; i < shipment_open_bin.length; i += 100) {
                        shipment_open_noschk.push(shipment_open_bin.slice(i, i + 100));
                    }

                    const open_id_pre_chunk  = [];
                    for (let i = 0; i < ids_open.length; i += 100) {
                        open_id_pre_chunk .push(ids_open.slice(i, i + 100));
                    }
                    
                    let resultsDashboardData = [];
                    const fields_dashboard = {};
                    const table_dashboard_bd = 'trip_dashboard_live_status';
                    const table_dashboardbd_dtdc = 'dtdc_trip_dashboard_live_status';
                    const table_dashboardbd_cv = 'cv_trip_dashboard_live_status';
                    for (let shp_chunk of shipment_noschk) {
                        let conditionsD = {
                            group_id: String(group_id),
                            shipment_no: { $in: shp_chunk }
                            
                        };
                       
                        // const dashboard_detail_TMP = await mongu.getMongoQuery(conditionsD, fields_dashboard, table_dashboard);
                        let dashboard_detail_TMP =[];
                        if(dbFlag=="0041"){
                            dashboard_detail_TMP = await  mongu.getMongoQuery(conditionsD, fields_dashboard, table_dashboard_bd);
                        }else if(dbFlag=="5691"){
                            dashboard_detail_TMP = await  mongu.getCVMongoQuery(conditionsD, fields_dashboard, table_dashboardbd_dtdc);
                        }else{
                            dashboard_detail_TMP = await  mongu.getCVMongoQuery(conditionsD, fields_dashboard, table_dashboardbd_cv);
                        }
                        resultsDashboardData = resultsDashboardData.concat(dashboard_detail_TMP);
                    }
                   
                    let binDashboardData = {};
                    let last_create_date="";
                    for (let row1 of resultsDashboardData) {
                    
                        binDashboardData[row1.shipment_no] = row1;
                        last_create_date= row1.create_date;
                    }

                    let trigger_detail = [];
                    const fields_trigger = {};
                    const table_trigger = 'logistic_trigger_log';
                   
                    const chk_alert = ['DFG','SCHEDULED_HALT','UNSCHEDULED_HALT','SENSITIVE_HALT','CRITICAL','UNAUTHORIZED_LOCK','TAMPER_LOCK','SCHEDULED_FUEL_STATION','SCHEDULED_DHABA'];

                    for (let shp_chunk of shipment_open_noschk) {
                        ////////////////for alert///////////////////////////////
                        let conditionsT = {
                            status:1,
                            group_id: String(group_id),
                            
                            shipment_no: { $in: shp_chunk }
                            //alert_type:{ $in: chk_alert }
                            
                        };
                        const trigger_detail_TMP = await mongu.getMongoQuery(conditionsT, fields_trigger, table_trigger);                       
                        trigger_detail = trigger_detail.concat(trigger_detail_TMP);
                        
                        
                    }
                    //console.log(trigger_detail);process.exit(0);
                    let courier_route_delay=[];
                    const fieldsDelayReason = {
                        projection: {
                            m_trip_id: 1,
                            incident_date: 1,
                            entry_date: 1,
                            incident_time: 1,
                            location_name: 1,
                            delay_reason: 1
                        }
                    };

                    ////////////////for delay///////////////////////////////
                    const table_delay = 'courier_route_delay';
                    for (let open_ids_chunk of open_id_pre_chunk) {
                        
                        let conditionDR = {
                            group_id: String(group_id),
                            status:1,
                           //m_trip_id: { $in: open_ids_chunk }
                        };
                        conditionDR.obj ={ m_trip_id: { $in: Object.values(open_ids_chunk) } };  
                        const courier_route_delay_TMP = await mongu.getMongoQuery(conditionDR, fieldsDelayReason, table_delay);                       
                        courier_route_delay = courier_route_delay.concat(courier_route_delay_TMP);
                    }

                    //console.log(courier_route_delay.length);
                    //process.exit(0);                    
                    let trigger_info ={};
                    let trigger_info_count ={};
                    trigger_detail.forEach((trigger_row)=>{
                        const m_trip_id1 = String(trigger_row.m_trip_id.$oid);
                        
                        if (!trigger_info[m_trip_id1]) {
                            trigger_info[m_trip_id1] = {};
                        }
                        
                        if (!trigger_info[m_trip_id1][trigger_row.alert_type]) {
                            trigger_info[m_trip_id1][trigger_row.alert_type] = [];
                        }
                        trigger_info[m_trip_id1][trigger_row.alert_type].push({
                            m_trip_id: m_trip_id1,
                            id: String(trigger_row._id.$oid),
                            imei_no: trigger_row.imei,
                            vehicle_no: trigger_row.vehicle_name,
                            group_id: trigger_row.group_id,
                            alert_type: trigger_row.alert_type,
                            sts: trigger_row.sts,
                            location: trigger_row.location,
                            geocoord: trigger_row.geocoord
                        });

                    });

                    let series_delay_bin ={};
                    let fieldsD={};
                    let conditionsD={
                        group_id: String(group_id),
                        status:1,
                    };
                    const courier_delay_master = await mongu.getMongoQuery(conditionsD, fieldsD, "courier_route_delay_master"); 
                    courier_delay_master.forEach(row_delay => {
                        const regex = /^3\d+$/;
                        
                        if (regex.test(row_delay.c_reason_code)) {
                            series_delay_bin[row_delay.c_reason_code] = row_delay.creason_desc;
                        }
                    });
                    const delay_info = {};
                    courier_route_delay.forEach(row_reason => {
                        //console.log(row_reason);process.exit(0);
                        const m_trip_id2 = String(row_reason.m_trip_id.$oid);
                        
                        if (!delay_info[m_trip_id2]) {
                            delay_info[m_trip_id2] = {};
                        }
                        
                        delay_info[m_trip_id2][row_reason.delay_reason] = {
                            delay_location: row_reason.location_name,
                            delay_reason: row_reason.delay_reason,
                            entry_date: row_reason.entry_date,
                            reason: series_delay_bin[row_reason.delay_reason]
                        };
                    });
                    //console.log(delay_info);
                    //process.exit(0);
                    const index_pre_chunk  = [];
                    for (let i = 0; i < ids.length; i += 50) {
                        index_pre_chunk .push(ids.slice(i, i + 50));
                    }
                    let fieldsC = {};
                    let sort_order = 1;
                   
                    let tripSecondaryData=[];
                    let customerData=[];
                    fieldsC = { sort: { sequence_no: sort_order } };
                    // const tableC= 'courier_trip_detail_customer';
                    for(let ids_chunk of index_pre_chunk )
                    {
                        let resultsCustomer=[];
                        let conditionsC = {
                            group_id: String(group_id),
                            
                        };
                        conditionsC.obj ={ m_trip_id: { $in: Object.values(ids_chunk) } };                        
                        // const resultsCustomerTmp = await mongu.getMongoQuery(conditionsC, fieldsC, tableC);
                        let resultsCustomerTmp =[];
                        if(dbFlag=="0041"){
                            resultsCustomerTmp = await  mongu.getMongoQuery(conditionsC, fieldsC, tableC);
                        }else if(dbFlag=="5691"){
                            resultsCustomerTmp = await  mongu.getCVMongoQuery(conditionsC, fieldsC, tableC);
                        }else{
                            resultsCustomerTmp = await  mongu.getCVMongoQuery(conditionsC, fieldsC, tableC);
                        }



                        resultsCustomer = resultsCustomer.concat(resultsCustomerTmp);
                        if (resultsCustomer.length > 0) {
                            resultsCustomer.forEach(value => {
                                
                                let mtid = String(value.m_trip_id.$oid);
                                let ctid = String(value._id.$oid);
                                let f_sequence_no="";
                                if(value.sequence_no)
                                {
                                    f_sequence_no=value.sequence_no;
                                }
                                let f_location_sequence="";
                                if(value.location_sequence)
                                {
                                    f_location_sequence=value.location_sequence;
                                }
                                let f_location_code="";
                                if(value.location_code)
                                {
                                    f_location_code=value.location_code;
                                }
                                let f_location_id="";
                                if(value.location_id)
                                {
                                    f_location_id=value.location_id;
                                }
                                let f_location_geocoord="";
                                if(value.location_geocoord)
                                {
                                    f_location_geocoord=value.location_geocoord;
                                }
                                let f_arrival_time="";
                                if(value.arrival_time)
                                {
                                    f_arrival_time=value.arrival_time;
                                }
                                let f_departure_time="";
                                if(value.departure_time)
                                {
                                    f_departure_time=value.departure_time;
                                }
                                let f_geo_arrival_time="";
                                if(value.geo_arrival_time)
                                {
                                    f_geo_arrival_time=value.geo_arrival_time;
                                }
                                let f_geo_departure_time="";
                                if(value.geo_departure_time)
                                {
                                    f_geo_departure_time=value.geo_departure_time;
                                }
                                let f_gps_departure_time="";
                                if(value.gps_departure_time)
                                {
                                    f_gps_departure_time=value.gps_departure_time;
                                }
                                let f_gps_arrival_time="";
                                if(value.gps_arrival_time)
                                {
                                    f_gps_arrival_time=value.gps_arrival_time;
                                }
                                let f_schedule_time_arrival="";
                                if(value.schedule_time_arrival)
                                {
                                    f_schedule_time_arrival=value.schedule_time_arrival;
                                }
                                let f_schedule_time_departure="";
                                if(value.schedule_time_departure)
                                {
                                    f_schedule_time_departure=value.schedule_time_departure;
                                }
                                let f_api_departure_time="";
                                if(value.api_departure_time)
                                {
                                    f_api_departure_time=value.api_departure_time;
                                }
                                let f_api_arrival_time="";
                                if(value.api_arrival_time)
                                {
                                    f_api_arrival_time=value.api_arrival_time;
                                }
                                let f_travel_time="";
                                if(value.travel_time)
                                {
                                    f_travel_time=value.travel_time;
                                }
                                let f_halt_duration="";
                                if(value.halt_duration)
                                {
                                    f_halt_duration=value.halt_duration;
                                }
                                let f_gps_edit_time_arrival="";
                                if(value.gps_edit_time_arrival)
                                {
                                    f_gps_edit_time_arrival=value.gps_edit_time_arrival;
                                }
                                let f_gps_edit_time_departure="";
                                if(value.gps_edit_time_departure)
                                {
                                    f_gps_edit_time_departure=value.gps_edit_time_departure;
                                }
                                let f_gps_recieved_time_arrival="";
                                if(value.gps_recieved_time_arrival)
                                {
                                    f_gps_recieved_time_arrival=value.gps_recieved_time_arrival;
                                }
                                let f_gps_recieved_time_departure="";
                                if(value.gps_recieved_time_departure)
                                {
                                    f_gps_recieved_time_departure=value.gps_recieved_time_departure;
                                }
                                let f_app_recieved_time_arrival="";
                                if(value.app_recieved_time_arrival)
                                {
                                    f_app_recieved_time_arrival=value.app_recieved_time_arrival;
                                }
                                let f_app_recieved_time_departure="";
                                if(value.app_recieved_time_departure)
                                {
                                    f_app_recieved_time_departure=value.app_recieved_time_departure;
                                }
                                let f_distance_km="";
                                if(value.distance_km)
                                {
                                    f_distance_km=value.distance_km;
                                }
                                let f_in_flag="";
                                if(value.in_flag)
                                {
                                    f_in_flag=value.in_flag;
                                }
                               
                                
                                if (!customerData[String(mtid)]) {
                                    customerData[String(mtid)] = [];
                                }
                                let label="M1";
                                if(f_location_sequence!="" && f_sequence_no!="")
                                {
                                    if(f_location_sequence==0)
                                    {
                                        //label="M0";
                                        label="M"+(parseInt(f_sequence_no));
                                    }                                    
                                    else
                                    {
                                        //label="M"+(parseInt(f_sequence_no)-1);
                                        label="M"+(parseInt(f_sequence_no));
                                    }
                                }
                                customerData[mtid].push({
                                    id: ctid,
                                    location_id: f_location_id,
                                    location_name: f_location_code,
                                    in_flag :f_in_flag,                                    
                                    location_sequence:f_location_sequence ,
                                    sequence_number:f_sequence_no,
                                    location_geocoord: f_location_geocoord,
                                    location_label: label

                                });

                                // Store the data in tripSecondaryData array
                                 //2dArray
                                 if (!tripSecondaryData[String(mtid)]) {
                                    tripSecondaryData[String(mtid)] = [];
                                }
                                //tripSecondaryData[mtid] = tripSecondaryData[mtid] || [];
                                tripSecondaryData[mtid].push({
                                    ScheduleTimeArrival: f_schedule_time_arrival,
                                    ScheduleTimeDeparture: f_schedule_time_departure,
                                    SequenceNo: f_sequence_no,
                                    LocationSequenceNo: f_location_sequence,
                                    TravelTime: f_travel_time,
                                    HaltDuration: f_halt_duration,
                                    Arrival: f_arrival_time,
                                    Departure: f_departure_time,
                                    ArrivalGeo: f_geo_arrival_time,
                                    DepartureGeo: f_geo_departure_time,
                                    DepartureTime: f_departure_time,
                                    DepartureGps: f_gps_departure_time,
                                    ArrivalGps: f_gps_arrival_time,
                                    DepartureApi: f_api_departure_time,
                                    ArrivalApi: f_api_arrival_time,

                                    ServerProcessedAppIn: f_app_recieved_time_arrival,
                                    ServerProcessedAppOut: f_app_recieved_time_departure,
                                    ServerProcessedIn: f_gps_edit_time_arrival,
                                    ServerProcessedOut: f_gps_edit_time_departure,
                                    ServerGPSReceivedIn: f_gps_recieved_time_arrival,
                                    ServerGPSReceivedOut: f_gps_recieved_time_departure,
                                    DistanceKm: f_distance_km,
                                    LocationCode: f_location_code,
                                    LocationGeocoord: f_location_geocoord
                                });
                            });
                        }
                       
                    }
                    //console.log(Object.keys(tripSecondaryData).length);                    
                    //process.exit(0);
                    const deviceTypeBin = {
                        1: "FixedGPS",
                        2: "PortableGPS",
                        11: "Lock",
                        12: "FixedElock",
                        13: "PortableElock"
                    };
                    
                    let trip_common_info={};
                    let trip_common_data={};
                    let bin_sch_vehicles=[];
                    let bin_capture_free_vehicles=[];
                    let trip_dfg={};
                    let trip_lock ={};
                    let trip_halt ={};
                    let trip_critical_delay ={};
                    let trip_ontime={};
                    let trip_delay ={};
                    let trip_eta_station_less2h ={};
                    let trip_eta_station_greater2h ={};
                    let trip_stopped_2h={};
                    let trip_stopped_2h_less={};
                    let trip_running={};
                    let trip_nonintegrated={};
                    let trip_inactive={};
                    let trip_fixedlock={};
                    let trip_fixedlockInactive={};
                    let trip_fixedlockNA={};
                    let trip_portablelock ={};
                    let trip_portablelockNA ={};
                    let trip_portablelockInactive={};
                    let trip_fixedlock_open =0;
                    let trip_fixedlock_close =0;
                    let trip_fixedlock_NA =0;
                    let trip_fixedlock_Inactive =0;
                    let trip_portablelock_open=0;
                    let trip_portablelock_close=0;
                    let trip_portablelock_NA=0;
                    let trip_portablelock_Inactive=0;

                    let trip_schedule=0;
                    let trip_completed=0;
                    let at_source_cnt=0;
                    let at_destination_cnt=0;
                    let delayed_arrived_cnt=0;
                    let free_vehicles_cnt=0;

                    let last_location="";
                    if(results.length >0)
                    {
                        results.forEach(rowtrip => {                             
                             
                            if (courier_route_ids.length > 0 && user_type == 19) {
                                if (!courier_route_ids.includes(rowtrip.route_id)) {
                                    return; // Skips iteration if route_id is not in routeids
                                }
                            }
                            //filter for gps vendor
                            let gpsv1=rowtrip.gps_vendor_name;
                            let gpsv2=rowtrip.gps_vendor2;
                            let gpsv3=rowtrip.gps_vendor3;
                            let flag_not_ilgic=0;
                            if(gpsv1=="Secutrak")
                            {
                                rowtrip.gps_vendor_name="ILGIC";
                                flag_not_ilgic=1;
                            }
                            if(gpsv2=="Secutrak")
                            {
                                rowtrip.gps_vendor2="ILGIC";
                                flag_not_ilgic=1;
                            }
                            if(gpsv3=="Secutrak")
                            {
                                rowtrip.gps_vendor3="ILGIC";
                                flag_not_ilgic=1;
                            }
                            
                            if(Vendor && (Vendor=="2" || Vendor==2)) //fo ilgic
                            {
                                if(flag_not_ilgic==0)
                                {            
                                    return;
                                }
                            }
                            if(Vendor && (Vendor=="3" || Vendor==3)) //fo third party
                            {
                                if(flag_not_ilgic==1)
                                {            
                                    return;
                                }
                            }
                            //Transporter Filter
                            if(Transporter && Transporter!="")
                            {
                                if(Transporter!=rowtrip.transporter_name)
                                {
                                    return;
                                }
                            }
                            ////for filtration end///// 

                            const mtripid = String(rowtrip._id.$oid);

                            let ata="";
                            let atd="";
                            let sta="";
                            let std="";
                            let halt_duration=[];

                            sta =rowtrip?.schedule_arrival || "";
                            std =rowtrip?.schedule_departure || "";
                            let driver_name =rowtrip?.driver_name || "";
                            let driver_mobile = rowtrip?.driver_mobile ||"";
                            let shipment_method = rowtrip?.shipment_method ||"";
                            let run_date= rowtrip?.run_date || "";
                            let ship =rowtrip?.shipment_no || "";
                            let destination_geocoord="";
                            let destination_code="";
                            let trip_arial_distance=0;
                            let vehicle_status_modified="NA";
                            let vehicle_status_modified2="NA";
                            let at_source="NA";                            
                            let at_destination="NA";                            
                            let free_vehicles="NA";                            
                            let delayed_arrived="NA";                            
                            
                            last_location="";
                            let geo_departure_time="";
                            let gps_departure_time="";
                            let gps_arrival_time="";
                            let geo_arrival_time="";
                            let prev_slat = ""; let prev_slon = "";  

                            let newDateA=binDashboardData[ship]?.delaying_sta;
                            const currentDateA = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                            const etaFilterBin = {
                                "<2": 7199,
                                "2": 7199,
                                "4": 14399,
                                "6": 21599,
                                "8": 28799,
                                "10": 35999,
                                "12": 43199,
                                ">12": 43200
                            };
                            let matched_delay=0;
                            if (Delay && Delay !== "0" && rowtrip.trip_status==1) {
                                //if (newDateA >= currentDateA) 
                                {
                                    const diffEtaBin = strtotime(newDateA)-strtotime(currentDateA);
                            
                                    for (const key in etaFilterBin) {
                                        if (Delay === key) {
                                            const binDelVal = etaFilterBin[Delay];
                                            
                                            if (Delay !== "<2" && Delay !== ">12") {
                                                const delIndex = (parseInt(Delay) - 2).toString();
                                                if (diffEtaBin <= binDelVal && diffEtaBin > etaFilterBin[delIndex]) {
                                                    //console.log(`inside=${key}`);
                                                    matched_delay=1;
                                                }
                                            } else {
                                                if (Delay === "<2" && diffEtaBin <= binDelVal) {
                                                    //console.log(`inside=${key}`);
                                                    matched_delay=1;
                                                }
                                                if (Delay === ">12" && diffEtaBin >= binDelVal) {
                                                    //console.log(`inside=${key}`);
                                                    matched_delay=1;
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            
                            if(Delay && Delay !== "0" && matched_delay==0)
                            {
                                return;
                            }
                            
                            let val_DepartureGeo="";
                            let val_ArrivalGeo="";
                            let val_DepartureGps="";
                            let val_ArrivalGps="";
                            let val_DepartureApi="";
                            let val_ArrivalApi="";

                            if(tripSecondaryData[mtripid]) 
                            {
                                
                               
                                tripSecondaryData[mtripid].sort((a, b) => {
                                    return a.SequenceNo - b.SequenceNo; // Sort in ascending order based on SequenceNo
                                });
                                for(const child_row of Object.values(tripSecondaryData[mtripid]))
                                {
                                    if(child_row.LocationSequenceNo==0) //source to find ATD
                                    {

                                        val_DepartureGeo=child_row.DepartureGeo;
                                        val_DepartureGps=child_row.DepartureGps;
                                        val_DepartureApi=child_row.DepartureApi;
                                        
                                        if(child_row.DepartureGps) {
                                            gps_departure_time=child_row.DepartureGps;
                                        }
                                        
                                        
                                        if(child_row.DepartureGeo) {
                                            geo_departure_time=child_row.DepartureGeo;
                                        }
                                    }
                                    if(child_row.LocationSequenceNo==2) { //source to find ATA   
                                       
                                        val_ArrivalGeo=child_row.ArrivalGeo;
                                        val_ArrivalGps=child_row.ArrivalGps;
                                        val_ArrivalApi=child_row.ArrivalApi;

                                        if(child_row.ArrivalGps) {
                                            gps_arrival_time=child_row.ArrivalGps;
                                        }
                                        
                                        if(child_row.ArrivalGeo) {
                                            geo_arrival_time=child_row.ArrivalGeo;
                                        }
        
                                        destination_geocoord=child_row.LocationGeocoord;
                                        destination_code=child_row.LocationCode;
                                    }
                                    
                                    let station_distances = 0;

                                    if (child_row.LocationSequenceNo == 0) {
                                         prev_slat = "", prev_slon = "";
                                        const station_geocoord = child_row.LocationGeocoord;

                                        if (station_geocoord !== "") {
                                            const station_geocoord_a = station_geocoord.split(",");
                                            prev_slat = station_geocoord_a[0];
                                            prev_slon = station_geocoord_a[1];
                                        }
                                    } else {
                                        const station_geocoord = child_row.LocationGeocoord;
                                        let station_geocoord_a = [];

                                        if (station_geocoord !== "") {
                                            station_geocoord_a = station_geocoord.split(",");
                                        }

                                        if (prev_slat !== "" && prev_slon !== "") {
                                            const lat_from = prev_slat;
                                            const lon_from = prev_slon;
                                            const lat_to = station_geocoord_a[0];
                                            const lon_to = station_geocoord_a[1];

                                            // Assuming calculateDistance is a custom function you define to calculate the distance
                                            station_distances = calculateDistance(lat_from, lat_to, lon_from, lon_to);
                                            trip_arial_distance += station_distances;

                                            prev_slat = station_geocoord_a[0];
                                            prev_slon = station_geocoord_a[1];
                                        } else {
                                            if (station_geocoord_a.length > 0) {
                                                prev_slat = station_geocoord_a[0];
                                                prev_slon = station_geocoord_a[1];
                                            }
                                        }
                                    }



                                }
                            }

                            let ata_tmp="";
                            if(gps_arrival_time!="")
                            {
                                ata_tmp=gps_arrival_time;
                            }
                            else if(geo_arrival_time!="")
                            {
                                ata_tmp=geo_arrival_time;
                            }
                            else if(val_ArrivalApi!="")
                            {
                                ata_tmp=val_ArrivalApi;
                            }
                            //////
                            /*if(geo_arrival_time!="" && gps_arrival_time!="") {
                                if(strtotime(geo_arrival_time) < strtotime(gps_arrival_time) ) {
                                    ata_tmp=geo_arrival_time;
                                } else {
                                    ata_tmp=gps_arrival_time;
                                }
                            } else if(geo_arrival_time!="" && gps_arrival_time=="") {
                                ata_tmp=geo_arrival_time;
                            } else if(geo_arrival_time=="" && gps_arrival_time!="") {
                                ata_tmp=gps_arrival_time;
                            }*/

                            let atd_tmp="";
                            if(gps_departure_time!="")
                            {
                                atd_tmp=gps_departure_time;
                            }
                            else if(geo_departure_time!="")
                            {
                                atd_tmp=geo_departure_time;
                            }
                            else if(val_DepartureApi!="")
                            {
                                atd_tmp=val_DepartureApi;
                            }

                            /*if(geo_departure_time!="" && gps_departure_time!="") {
                                if(strtotime(geo_departure_time) < strtotime(gps_departure_time) ) {
                                    atd_tmp=geo_departure_time;
                                } else {
                                    atd_tmp=geo_departure_time;
                                }
                            } else if(geo_departure_time!="" && gps_departure_time=="") {
                                atd_tmp=geo_departure_time;
                            } else if(geo_departure_time=="" && gps_departure_time!="") {
                                atd_tmp=gps_departure_time;
                            }*/
                            //console.log(rowtrip);process.exit(0)
                            let device_imei_type=rowtrip?.imei_no_type || "";
                            let device_imei_type2=rowtrip?.imei_no_type2 || "";;
                            let device_imei_type3=rowtrip?.imei_no_type3 || "";
                            let imei_type1="";
                            let imei_type2= "";
                            let imei_type3="";
                            if(device_imei_type!="")
                            {
                                imei_type1= deviceTypeBin[device_imei_type];
                            }
                            if(device_imei_type2!="")
                            {
                                imei_type2= deviceTypeBin[device_imei_type2];
                            }
                            if(device_imei_type3!="")
                            {
                                imei_type3= deviceTypeBin[device_imei_type3];
                            }
                            //console.log(imei_type1,imei_type2,imei_type3);process.exit(0);
                            
                            

                            let device_imei=rowtrip?.imei_no || "";
                            let device_imei2=rowtrip?.imei_no2 || "";;
                            let device_imei3=rowtrip?.imei_no3 || "";
                            let scTTmapped="";
                            if(std!="" && sta!="" && strtotime(sta) >= strtotime(std)) {
                                let schtime = strtotime(sta)-strtotime(std); //ttmapped
                                const hms1=secondsToTimeLocal(schtime);
                                scTTmapped = `${hms1.h}:${hms1.m}:${hms1.s}`;
                               
                            }
                            ///---------main code start from here-------//
                            if(rowtrip.trip_status==1)
                            {
                                trip_schedule++;
                            }
                            else if(rowtrip.trip_status==0){
                                trip_completed++;
                            }
                          
                            if (device_imei == "" && device_imei2 == "" && device_imei3 == "") {
                                vehicle_status_modified = "NonGPS";
                                if(rowtrip.trip_status==1)
                                {
                                    trip_nonintegrated[mtripid] = {
                                        "ShipmentNo": rowtrip.shipment_no
                                    
                                    };
                                }

                                trip_common_data[mtripid] = {
                                    TripStatus: (rowtrip.trip_status===1) ? "Schedule" : "Completed"
                                };
                                trip_common_data[mtripid]["MTripId"] = mtripid;
                                trip_common_data[mtripid]["ShipmentNo"] = rowtrip.shipment_no;
                                trip_common_data[mtripid]["VehicleNo"] = rowtrip.vehicle_no;
                                trip_common_data[mtripid]["Region"] = rowtrip.region_code;
                                if(rowtrip.trip_status==1)
                                {
                                    bin_sch_vehicles.push(rowtrip.vehicle_no);
                                    trip_common_data[mtripid]["VehicleStatus"] = vehicle_status_modified;
                                     trip_common_data[mtripid]["GPSFilter"] = "NonGPS";
                                     trip_common_data[mtripid]["FixedLockFilter"] ="NonElock";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="NonElock";
                                     
                                }
                                else
                                {
                                    trip_common_data[mtripid]["VehicleStatus"] = "Completed";
                                     trip_common_data[mtripid]["GPSFilter"] = "";
                                     trip_common_data[mtripid]["FixedLockFilter"] ="";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="";
                                }
                                
                                
                                trip_common_data[mtripid]["VehicleLastTime"] = "NA";
                               
                                trip_common_data[mtripid]["StoppageFilter"] = "";
                                trip_common_data[mtripid]["Stop>2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["Stop<2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["DelayFilter"] = "";
                                trip_common_data[mtripid]["DelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["CriticalDelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["DelayTime"] = "NA"; //time value
                                trip_common_data[mtripid]["OnTime"] = "NA"; //Yes/No
                                trip_common_data[mtripid]["ETAFilter"] = "";
                                trip_common_data[mtripid]["ETA"] = ""
                                trip_common_data[mtripid]["ETA>2Hrs"] = ""; //blank /values
                                trip_common_data[mtripid]["ETA<2Hrs"] = ""//blank/values   
                                trip_common_data[mtripid]["LockFilter"] =  "";                             
                                trip_common_data[mtripid]["FixedLock"] = "NA" //1/0
                                trip_common_data[mtripid]["FixedLockOpen"] =""; //blank/Open/Close
                                trip_common_data[mtripid]["PortableLock"] ="NA"; //1/0/NA
                                trip_common_data[mtripid]["PortableLockOpen"] ="";  //blank/Open/Close
                                trip_common_data[mtripid]["AlertFilter"] = "";
                                trip_common_data[mtripid]["Alert"] ="NA";//Alert
                                trip_common_data[mtripid]["AlertTime"] ="NA";//AlertTime
                                trip_common_data[mtripid]["RouteDeviation"] ="NA";  //NA blank values
                                trip_common_data[mtripid]["LockAlert"] ="NA";//LockAlert
                                trip_common_data[mtripid]["UnAuthLockAlert"] ="NA";//UnAuthLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["Halt"] ="NA";  //NA blank values
                                trip_common_data[mtripid]["AtSource"] =at_source; //NA/Blank/1/0
                                trip_common_data[mtripid]["AtDestination"] =at_destination; //NA/Blank/1/0                                
                                trip_common_data[mtripid]["FreeVehicles"] =free_vehicles;  //NA/Blank/1/0
                                trip_common_data[mtripid]["DelayedArrived"] =delayed_arrived; //values or blank or NA


                                trip_common_data[mtripid]["ImeiNo1"]= rowtrip?.imei_no || "";
                                trip_common_data[mtripid]["ImeiNo2"]= rowtrip?.imei_no2 || "";
                                trip_common_data[mtripid]["ImeiNo3"]= rowtrip?.imei_no3 || "";
                                trip_common_data[mtripid]["ImeiNo1Type"]= imei_type1;
                                trip_common_data[mtripid]["ImeiNo2Type"]= imei_type2;
                                trip_common_data[mtripid]["ImeiNo3Type"]= imei_type3;
                                trip_common_data[mtripid]["GPSVendor1"]=  rowtrip?.gps_vendor_name || "";
                                trip_common_data[mtripid]["GPSVendor2"]= rowtrip?.gps_vendor2 || "";
                                trip_common_data[mtripid]["GPSVendor3"]= rowtrip?.gps_vendor3 || "";
                                trip_common_data[mtripid]["Distance1"]= rowtrip?.distance_km || "";
                                trip_common_data[mtripid]["Distance2"]= rowtrip?.distance_km_2 || "";
                                trip_common_data[mtripid]["Distance3"]= rowtrip?.distance_km_3 || "";
                                trip_common_data[mtripid]["RunDate"]= rowtrip.run_date;
                                trip_common_data[mtripid]["RunCode"]= rowtrip?.run_code || "";
                                trip_common_data[mtripid]["FleetNo"]= rowtrip?.fleet_no|| "";
                                trip_common_data[mtripid]["Route"]= rowtrip?.route_code|| "";
                                trip_common_data[mtripid]["RouteCategory"]=feeder_parent_bin[rowtrip.trip_type];                                
                                trip_common_data[mtripid]["Origin"]= rowtrip.source_code;
                                trip_common_data[mtripid]["Destination"]=  rowtrip.destination_code;
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["ShipmentMethod"]= shipment_method;
                                trip_common_data[mtripid]["DriverName"]= driver_name;
                                trip_common_data[mtripid]["DriverNumber"]= driver_mobile;
                                trip_common_data[mtripid]["TTMapped"]= scTTmapped;                                                              
                                trip_common_data[mtripid]["DistanceCover"]= "";
                                trip_common_data[mtripid]["RemainingDistance"]= "";
                               
                                trip_common_data[mtripid]["CloseBy"]= rowtrip?.close_by || rowtrip?.close_remarks;                                                              
                                trip_common_data[mtripid]["CloseDate"]= rowtrip?.close_date || "";

                                trip_common_data[mtripid]["MobileATD"]= val_DepartureGeo;
                                trip_common_data[mtripid]["MobileATA"]= val_ArrivalGeo;
                                trip_common_data[mtripid]["GPSATD"]= val_DepartureGps;
                                trip_common_data[mtripid]["GPSATA"]= val_ArrivalGps;
                                trip_common_data[mtripid]["ApiATD"]= val_DepartureApi;
                                trip_common_data[mtripid]["ApiATA"]= val_ArrivalApi;
                                trip_common_data[mtripid]["AHT"]=  rowtrip?.aht || "";

                                trip_common_data[mtripid]["ATA"]= ata_tmp;
                                trip_common_data[mtripid]["ATD"]= atd_tmp;
                                trip_common_data[mtripid]["STA"]= rowtrip?.schedule_arrival || "";
                                trip_common_data[mtripid]["STD"]= rowtrip?.schedule_departure || "";
                                trip_common_data[mtripid]["VehicleGeocoord"]= "";
                                trip_common_data[mtripid]["LastLocation"]= last_location;
                                trip_common_data[mtripid]["DelayReason"] ="";
                               
                                trip_common_data[mtripid]["Customer"]=customerData[mtripid] || "";

                                trip_common_data[mtripid]["FixedLockInactive"] = "" ;//1/0
                                trip_common_data[mtripid]["FixedLockNA"] = "" ;//1/0
                                trip_common_data[mtripid]["PortableLockInactive"] = ""; //1/0
                                trip_common_data[mtripid]["PortableLockNA"] = "";//1/0
                               
                             

                                  if(rowtrip.trip_status==1)
                                    {
                                        trip_fixedlockNA[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                        trip_common_data[mtripid]["LockFilter"] =  "FixedLockNA";
                                        trip_common_data[mtripid]["FixedLockNA"] = 1 //1/0
                                
                                        trip_fixedlock_NA++;
                                    }
                                     if(rowtrip.trip_status==1 )
                                    {
                                        trip_portablelockNA[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                        trip_common_data[mtripid]["LockFilter"] =  "PortableLockNA";
                                        trip_common_data[mtripid]["PortableLockNA"] = 1 //1/0
                                        trip_portablelock_NA++;
                                    }
                            
                                return; // Equivalent to 'continue' in loops in PHP, assuming you are in a loop
                            }
                            //console.log(delay_info.mtripid);
                            
                            let delay300series="";
                            if(delay_info[mtripid])
                            {
                                for(const rowd of Object.values(delay_info[mtripid]))
                                {
                                    //console.log(rowd);
                                    delay300series += rowd.reason + " ";
                                    
                                }
                            
                            }
                            
                            let last_data_current ={};
                            last_data_current = binDashboardData[ship]?.last_data_current || {};
                            //let last_time = last_data_current.lastTimeLR && last_data_current?.lastTimeLR[0] || "";
                            let last_time = last_data_current.deviceDatetimeLR && last_data_current?.deviceDatetimeLR[0] || "";

                            if(last_time =="" || strtotime(last_time) < strtotime(run_date))
                            {

                               

                                vehicle_status_modified = "Inactive";
                                if(rowtrip.trip_status==1)
                                {
                                    trip_inactive[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                       
                                    };
                                }
                                
                                trip_common_data[mtripid] = {
                                    TripStatus: (rowtrip.trip_status===1) ? "Schedule" : "Completed"
                                };
                                trip_common_data[mtripid]["MTripId"] = mtripid;
                                trip_common_data[mtripid]["ShipmentNo"] = rowtrip.shipment_no;
                                trip_common_data[mtripid]["VehicleNo"] = rowtrip.vehicle_no;
                                trip_common_data[mtripid]["Region"] = rowtrip.region_code;
                                if(rowtrip.trip_status==1)
                                {
                                    bin_sch_vehicles.push(rowtrip.vehicle_no);
                                    trip_common_data[mtripid]["VehicleStatus"] = vehicle_status_modified;
                                    trip_common_data[mtripid]["GPSFilter"] = "Inactive";
                                    trip_common_data[mtripid]["FixedLockFilter"] ="Inactive";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="Inactive";
                                }
                                else{
                                    trip_common_data[mtripid]["VehicleStatus"] = "Completed";
                                    trip_common_data[mtripid]["GPSFilter"] = "";
                                    trip_common_data[mtripid]["FixedLockFilter"] ="";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="";
                                }

                                
                                
                                trip_common_data[mtripid]["VehicleLastTime"] = last_time;
                                
                                trip_common_data[mtripid]["StoppageFilter"] = "";
                                trip_common_data[mtripid]["Stop>2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["Stop<2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["DelayFilter"] = "";
                                trip_common_data[mtripid]["DelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["CriticalDelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["DelayTime"] = "NA"; //time value
                                trip_common_data[mtripid]["OnTime"] = "NA"; //Yes/No
                                trip_common_data[mtripid]["ETAFilter"] = "";
                                trip_common_data[mtripid]["ETA"] = ""
                                trip_common_data[mtripid]["ETA>2Hrs"] = ""; //blank /values
                                trip_common_data[mtripid]["ETA<2Hrs"] = ""//blank/values
                                trip_common_data[mtripid]["LockFilter"] =  "";                                
                                trip_common_data[mtripid]["FixedLock"] = "NA" //1/0
                                trip_common_data[mtripid]["FixedLockOpen"] =""; //blank/Open/Close
                                trip_common_data[mtripid]["PortableLock"] ="NA"; //1/0/NA
                                trip_common_data[mtripid]["PortableLockOpen"] ="";  //blank/Open/Close
                                trip_common_data[mtripid]["AlertFilter"] = "";
                                trip_common_data[mtripid]["Alert"] ="NA";//Alert
                                trip_common_data[mtripid]["AlertTime"] ="NA";//AlertTime
                                trip_common_data[mtripid]["RouteDeviation"] ="NA";  //NA blank values
                                trip_common_data[mtripid]["LockAlert"] ="NA";//LockAlert
                                trip_common_data[mtripid]["UnAuthLockAlert"] ="NA";//UnAuthLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["Halt"] ="NA";  //NA blank values
                                trip_common_data[mtripid]["AtSource"] =at_source; //NA/Blank/1/0
                                trip_common_data[mtripid]["AtDestination"] =at_destination; //NA/Blank/1/0                                
                                trip_common_data[mtripid]["FreeVehicles"] =free_vehicles;  //NA/Blank/1/0
                                trip_common_data[mtripid]["DelayedArrived"] =delayed_arrived; //values or blank or NA


                                trip_common_data[mtripid]["ImeiNo1"]= rowtrip?.imei_no || "";
                                trip_common_data[mtripid]["ImeiNo2"]= rowtrip?.imei_no2 || "";
                                trip_common_data[mtripid]["ImeiNo3"]= rowtrip?.imei_no3 || "";
                                trip_common_data[mtripid]["ImeiNo1Type"]= imei_type1;
                                trip_common_data[mtripid]["ImeiNo2Type"]= imei_type2;
                                trip_common_data[mtripid]["ImeiNo3Type"]= imei_type3;
                                trip_common_data[mtripid]["GPSVendor1"]=  rowtrip?.gps_vendor_name || "";
                                trip_common_data[mtripid]["GPSVendor2"]= rowtrip?.gps_vendor2 || "";
                                trip_common_data[mtripid]["GPSVendor3"]= rowtrip?.gps_vendor3 || "";
                                trip_common_data[mtripid]["Distance1"]= rowtrip?.distance_km || "";
                                trip_common_data[mtripid]["Distance2"]= rowtrip?.distance_km_2 || "";
                                trip_common_data[mtripid]["Distance3"]= rowtrip?.distance_km_3 || "";
                                trip_common_data[mtripid]["RunDate"]= rowtrip.run_date;
                                trip_common_data[mtripid]["RunCode"]= rowtrip?.run_code || "";
                                trip_common_data[mtripid]["FleetNo"]= rowtrip?.fleet_no|| "";
                                trip_common_data[mtripid]["Route"]= rowtrip?.route_code|| "";
                                trip_common_data[mtripid]["RouteCategory"]=feeder_parent_bin[rowtrip.trip_type];
                                trip_common_data[mtripid]["Origin"]= rowtrip.source_code;
                                trip_common_data[mtripid]["Destination"]=  rowtrip.destination_code;
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["ShipmentMethod"]= shipment_method;
                                trip_common_data[mtripid]["DriverName"]= driver_name;
                                trip_common_data[mtripid]["DriverNumber"]= driver_mobile;
                                trip_common_data[mtripid]["TTMapped"]= scTTmapped;                                                              
                                trip_common_data[mtripid]["DistanceCover"]= "";
                                trip_common_data[mtripid]["RemainingDistance"]= "";
                                trip_common_data[mtripid]["CloseBy"]= rowtrip?.close_by ||  rowtrip?.close_remarks;                                                                
                                trip_common_data[mtripid]["CloseDate"]= rowtrip?.close_date || "";

                                trip_common_data[mtripid]["MobileATD"]= val_DepartureGeo;
                                trip_common_data[mtripid]["MobileATA"]= val_ArrivalGeo;
                                trip_common_data[mtripid]["GPSATD"]= val_DepartureGps;
                                trip_common_data[mtripid]["GPSATA"]= val_ArrivalGps;
                                trip_common_data[mtripid]["ApiATD"]= val_DepartureApi;
                                trip_common_data[mtripid]["ApiATA"]= val_ArrivalApi;
                                trip_common_data[mtripid]["AHT"]=  rowtrip?.aht || "";

                                trip_common_data[mtripid]["ATA"]= ata_tmp;
                                trip_common_data[mtripid]["ATD"]= atd_tmp;
                                trip_common_data[mtripid]["STA"]= rowtrip?.schedule_arrival || "";
                                trip_common_data[mtripid]["STD"]= rowtrip?.schedule_departure || "";
                                trip_common_data[mtripid]["VehicleGeocoord"]= "";
                                trip_common_data[mtripid]["LastLocation"]= last_location;
                                trip_common_data[mtripid]["DelayReason"] ="";
                                trip_common_data[mtripid]["Customer"]=customerData[mtripid] || "";

                                trip_common_data[mtripid]["FixedLockInactive"] = "" ;//1/0
                                trip_common_data[mtripid]["FixedLockNA"] = "" ;//1/0
                                trip_common_data[mtripid]["PortableLockInactive"] = ""; //1/0
                                trip_common_data[mtripid]["PortableLockNA"] = "";//1/0
                               
                                 //for fixed lock and portable lock
                                 if(rowtrip.trip_status==1 )
                                    {
                                        trip_fixedlockInactive[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                        //trip_common_data[mtripid]["LockFilter"] =  "FixedLockInactive";
                                        //trip_common_data[mtripid]["FixedLockInactive"] = 1 //1/0
                                
                                        //trip_fixedlock_Inactive++;
                                        trip_common_data[mtripid]["FixedLockFilter"] ="NonElock";
                                        
                                        trip_common_data[mtripid]["LockFilter"] =  "FixedLockNA";
                                        trip_common_data[mtripid]["FixedLockNA"] = 1 //1/0
                                        trip_fixedlock_NA++;
                                    }
                                     if(rowtrip.trip_status==1 )
                                    {
                                        trip_portablelockInactive[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                        //trip_common_data[mtripid]["LockFilter"] =  "PortableLockInactive";
                                        //trip_common_data[mtripid]["PortableLockInactive"] = 1 //1/0
                                        //trip_portablelock_Inactive++;
                                        trip_common_data[mtripid]["PortableLockFilter"] ="NonElock";
                                        trip_common_data[mtripid]["LockFilter"] =  "PortableLockNA";
                                        trip_common_data[mtripid]["PortableLockNA"] = 1 //1/0
                                        trip_portablelock_NA++;
                                    }
                                ///////////end
                                
                                return;
                            }
                            
                            let currentDateTime = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                            let vehicle_status = binDashboardData[ship]?.vehicle_status_current || "";
                            
                            let res_lat = last_data_current.latitudeLR && last_data_current?.latitudeLR[0] || '';
                            let res_lng = last_data_current.longitudeLR && last_data_current?.longitudeLR[0] || '';

                            let vehicle_geocoord =res_lat+","+res_lng;
                            let curr_dest_distance= binDashboardData[ship]?.etd || "";

                            let last_location_full =  binDashboardData[ship]?.last_address_current || "";
                           
                            last_location=last_location_full;
                           
                           let src_geocoord= rowtrip?.source_geocoord  || "";
                           let dest_geocoord =rowtrip?.destination_geocoord  || "";

                            let flag_at_source=0;
                            let flag_at_destination=0;
                            if(src_geocoord && res_lat && res_lng && rowtrip.trip_status==1)
                            {
                                let src_geocoord_arr= src_geocoord.split(",");
                                let latto = src_geocoord_arr[0];
                                let lonto = src_geocoord_arr[1];
                                let src_distances = calculateDistance(res_lat, latto, res_lng, lonto);
                                //console.log(res_lat, latto, res_lng, lonto,src_distances);
                                //process.exit(0);
                                if(src_distances*1000 < 200 )
                                {
                                    at_source_cnt++;
                                    flag_at_source=1;
                                }

                            }
                            if(dest_geocoord && res_lat && res_lng && rowtrip.trip_status==1)
                            {
                                let dest_geocoord_arr= dest_geocoord.split(",");
                                let latto = dest_geocoord_arr[0];
                                let lonto = dest_geocoord_arr[1];
                                let des_distances = calculateDistance(res_lat, latto, res_lng, lonto);
                                if(des_distances*1000 < 200)
                                {
                                    at_destination_cnt++;
                                    flag_at_destination=1;
                                }
                            }

                            if(vehicle_status == "Inactive" || vehicle_status =="")
                            {
                                vehicle_status_modified="Inactive";
                                if(rowtrip.trip_status==1)
                                {
                                    trip_inactive[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                }
                                
                                trip_common_data[mtripid] = {
                                    TripStatus: (rowtrip.trip_status===1) ? "Schedule" : "Completed"
                                };
                                trip_common_data[mtripid]["MTripId"] = mtripid;
                                trip_common_data[mtripid]["ShipmentNo"] = rowtrip.shipment_no;
                                trip_common_data[mtripid]["VehicleNo"] = rowtrip.vehicle_no;
                                trip_common_data[mtripid]["Region"] = rowtrip.region_code;
                                if(rowtrip.trip_status==1)
                                {
                                    bin_sch_vehicles.push(rowtrip.vehicle_no);
                                    trip_common_data[mtripid]["VehicleStatus"] = vehicle_status_modified;
                                    trip_common_data[mtripid]["AtSource"] =flag_at_source; //NA/Blank/1/0
                                    trip_common_data[mtripid]["AtDestination"] =flag_at_destination; //NA/Blank/1/0 
                                    trip_common_data[mtripid]["GPSFilter"] = "Inactive";
                                    trip_common_data[mtripid]["FixedLockFilter"] ="Inactive";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="Inactive";
                                }
                                else
                                {
                                    trip_common_data[mtripid]["VehicleStatus"] = "Completed";
                                    trip_common_data[mtripid]["AtSource"] =at_source; //NA/Blank/1/0
                                    trip_common_data[mtripid]["AtDestination"] =at_destination; //NA/Blank/1/0   
                                    trip_common_data[mtripid]["GPSFilter"] = ""; 
                                    trip_common_data[mtripid]["FixedLockFilter"] ="";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="";
                                }
                               
                                
                                trip_common_data[mtripid]["VehicleLastTime"] = last_time;
                               
                                trip_common_data[mtripid]["StoppageFilter"] = "";
                                trip_common_data[mtripid]["Stop>2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["Stop<2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["DelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["CriticalDelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["DelayTime"] = "NA"; //time value
                                trip_common_data[mtripid]["OnTime"] = "NA"; //Yes/No
                                trip_common_data[mtripid]["DelayFilter"] = "";
                                trip_common_data[mtripid]["ETAFilter"] = "";
                                trip_common_data[mtripid]["ETA"] = ""
                                trip_common_data[mtripid]["ETA>2Hrs"] = ""; //blank /values
                                trip_common_data[mtripid]["ETA<2Hrs"] = ""//blank/values                                
                                trip_common_data[mtripid]["FixedLock"] = "NA" //1/0
                                trip_common_data[mtripid]["FixedLockOpen"] =""; //blank/Open/Close
                                trip_common_data[mtripid]["PortableLock"] ="NA"; //1/0/NA
                                trip_common_data[mtripid]["PortableLockOpen"] ="";  //blank/Open/Close
                                trip_common_data[mtripid]["LockFilter"] =  "";
                                trip_common_data[mtripid]["AlertFilter"] = "";
                                trip_common_data[mtripid]["Alert"] ="NA";//Alert
                                trip_common_data[mtripid]["AlertTime"] ="NA";//AlertTime
                                trip_common_data[mtripid]["RouteDeviation"] ="NA";  //NA blank values
                                trip_common_data[mtripid]["LockAlert"] ="NA";//LockAlert
                                trip_common_data[mtripid]["UnAuthLockAlert"] ="NA";//UnAuthLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["Halt"] ="NA";  //NA blank values
                                                              
                                trip_common_data[mtripid]["FreeVehicles"] =free_vehicles;  //NA/Blank/1/0
                                trip_common_data[mtripid]["DelayedArrived"] =delayed_arrived; //values or blank or NA


                                trip_common_data[mtripid]["ImeiNo1"]= rowtrip?.imei_no || "";
                                trip_common_data[mtripid]["ImeiNo2"]= rowtrip?.imei_no2 || "";
                                trip_common_data[mtripid]["ImeiNo3"]= rowtrip?.imei_no3 || "";
                                trip_common_data[mtripid]["ImeiNo1Type"]= imei_type1;
                                trip_common_data[mtripid]["ImeiNo2Type"]= imei_type2;
                                trip_common_data[mtripid]["ImeiNo3Type"]= imei_type3;
                                trip_common_data[mtripid]["GPSVendor1"]=  rowtrip?.gps_vendor_name || "";
                                trip_common_data[mtripid]["GPSVendor2"]= rowtrip?.gps_vendor2 || "";
                                trip_common_data[mtripid]["GPSVendor3"]= rowtrip?.gps_vendor3 || "";
                                trip_common_data[mtripid]["Distance1"]= rowtrip?.distance_km || "";
                                trip_common_data[mtripid]["Distance2"]= rowtrip?.distance_km_2 || "";
                                trip_common_data[mtripid]["Distance3"]= rowtrip?.distance_km_3 || "";
                                trip_common_data[mtripid]["RunDate"]= rowtrip.run_date;
                                trip_common_data[mtripid]["RunCode"]= rowtrip?.run_code || "";
                                trip_common_data[mtripid]["FleetNo"]= rowtrip?.fleet_no|| "";
                                trip_common_data[mtripid]["Route"]= rowtrip?.route_code|| "";
                                trip_common_data[mtripid]["RouteCategory"]=feeder_parent_bin[rowtrip.trip_type];
                                trip_common_data[mtripid]["Origin"]= rowtrip.source_code;
                                trip_common_data[mtripid]["Destination"]=  rowtrip.destination_code;
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["ShipmentMethod"]= shipment_method;
                                trip_common_data[mtripid]["DriverName"]= driver_name;
                                trip_common_data[mtripid]["DriverNumber"]= driver_mobile;
                                trip_common_data[mtripid]["TTMapped"]= scTTmapped;                                                              
                                trip_common_data[mtripid]["DistanceCover"]= "";
                                trip_common_data[mtripid]["RemainingDistance"]= curr_dest_distance;
                                trip_common_data[mtripid]["CloseBy"]= rowtrip?.close_by || rowtrip?.close_remarks;                                                              
                                trip_common_data[mtripid]["CloseDate"]= rowtrip?.close_date || "";

                                trip_common_data[mtripid]["MobileATD"]= val_DepartureGeo;
                                trip_common_data[mtripid]["MobileATA"]= val_ArrivalGeo;
                                trip_common_data[mtripid]["GPSATD"]= val_DepartureGps;
                                trip_common_data[mtripid]["GPSATA"]= val_ArrivalGps;
                                trip_common_data[mtripid]["ApiATD"]= val_DepartureApi;
                                trip_common_data[mtripid]["ApiATA"]= val_ArrivalApi;
                                trip_common_data[mtripid]["AHT"]=  rowtrip?.aht || "";

                                trip_common_data[mtripid]["ATA"]= ata_tmp;
                                trip_common_data[mtripid]["ATD"]= atd_tmp;
                                trip_common_data[mtripid]["STA"]= rowtrip?.schedule_arrival || "";
                                trip_common_data[mtripid]["STD"]= rowtrip?.schedule_departure || "";
                                trip_common_data[mtripid]["VehicleGeocoord"]= vehicle_geocoord;
                                trip_common_data[mtripid]["LastLocation"]= last_location;
                                trip_common_data[mtripid]["DelayReason"] ="";
                                trip_common_data[mtripid]["Customer"]=customerData[mtripid] || "";
                                    
                                trip_common_data[mtripid]["FixedLockInactive"] = "" ;//1/0
                                trip_common_data[mtripid]["FixedLockNA"] = "" ;//1/0
                                trip_common_data[mtripid]["PortableLockInactive"] = ""; //1/0
                                trip_common_data[mtripid]["PortableLockNA"] = "";//1/0

                            }

                            else if(vehicle_status =="Stopped" ) 
                            {
                                vehicle_status_modified="Stopped";
                                let flag_stop2h = binDashboardData[ship]?.stopped_gt_2h || "";
                                let stop_duration = binDashboardData[ship]?.stop_duration || "";
                                let stop_lasttime = binDashboardData[ship]?.last_halt_time_current || "";
                                let stop_since = stop_lasttime;
                                let secs = strtotime(currentDateTime) - strtotime(last_time);// == <seconds between the two times>
                                if(flag_stop2h =="1")   // 2h and more
                                {
                                   
                                    vehicle_status_modified="Stopped > 2Hr";
                                    if(rowtrip.trip_status==1)
                                    {
                                        trip_stopped_2h[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                    }
                                    
                                    trip_common_data[mtripid] = {
                                        TripStatus: (rowtrip.trip_status===1) ? "Schedule" : "Completed"
                                    };
                                    trip_common_data[mtripid]["MTripId"] = mtripid;
                                    trip_common_data[mtripid]["ShipmentNo"] = rowtrip.shipment_no;
                                    trip_common_data[mtripid]["VehicleNo"] = rowtrip.vehicle_no;
                                    trip_common_data[mtripid]["Region"] = rowtrip.region_code;
                                    if(rowtrip.trip_status==1)
                                    {
                                        bin_sch_vehicles.push(rowtrip.vehicle_no);
                                        trip_common_data[mtripid]["VehicleStatus"] = vehicle_status_modified;
                                        trip_common_data[mtripid]["GPSFilter"] = "Stopped";
                                        trip_common_data[mtripid]["StoppageFilter"] = "Stop>2Hrs";
                                        trip_common_data[mtripid]["Stop>2Hrs"] = secondsToDecimalHours(secs); //blank/value
                                        trip_common_data[mtripid]["AtSource"] =flag_at_source; //NA/Blank/1/0
                                        trip_common_data[mtripid]["AtDestination"] =flag_at_destination; //NA/Blank/1/0 
                                    }
                                    else
                                    {
                                        trip_common_data[mtripid]["VehicleStatus"] = "Completed";
                                        trip_common_data[mtripid]["GPSFilter"] = "";
                                        trip_common_data[mtripid]["StoppageFilter"] = "";
                                        trip_common_data[mtripid]["Stop>2Hrs"] = "";
                                        trip_common_data[mtripid]["AtSource"] =at_source; //NA/Blank/1/0
                                        trip_common_data[mtripid]["AtDestination"] =at_destination; //NA/Blank/1/0
                                    }
                                    trip_common_data[mtripid]["FixedLockFilter"] ="";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="";
                                    
                                    trip_common_data[mtripid]["VehicleLastTime"] = last_time;
                                   
                                    trip_common_data[mtripid]["Stop<2Hrs"] = ""; //blank/value
                                    trip_common_data[mtripid]["DelayStatus"] = ""; //blank/1/0
                                    trip_common_data[mtripid]["CriticalDelayStatus"] = ""; //blank/1/0
                                    trip_common_data[mtripid]["DelayTime"] = "NA"; //time value
                                    trip_common_data[mtripid]["OnTime"] = "NA"; //Yes/No
                                    trip_common_data[mtripid]["DelayFilter"] = "";
                                    trip_common_data[mtripid]["ETAFilter"] = "";
                                    trip_common_data[mtripid]["ETA"] = ""
                                    trip_common_data[mtripid]["ETA>2Hrs"] = ""; //blank /values
                                    trip_common_data[mtripid]["ETA<2Hrs"] = ""//blank/values                                
                                    trip_common_data[mtripid]["FixedLock"] = "NA" //1/0
                                    trip_common_data[mtripid]["FixedLockOpen"] =""; //blank/Open/Close
                                    trip_common_data[mtripid]["PortableLock"] ="NA"; //1/0/NA
                                    trip_common_data[mtripid]["PortableLockOpen"] ="";  //blank/Open/Close
                                    trip_common_data[mtripid]["LockFilter"] =  "";
                                    trip_common_data[mtripid]["AlertFilter"] = "";
                                    trip_common_data[mtripid]["Alert"] ="NA";//Alert
                                    trip_common_data[mtripid]["AlertTime"] ="NA";//AlertTime
                                    trip_common_data[mtripid]["RouteDeviation"] ="NA";  //NA blank values
                                    trip_common_data[mtripid]["LockAlert"] ="NA";//LockAlert
                                    trip_common_data[mtripid]["UnAuthLockAlert"] ="NA";//UnAuthLockAlert
                                    trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                    trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                    trip_common_data[mtripid]["Halt"] =stop_since;  //NA blank values
                                                                  
                                    trip_common_data[mtripid]["FreeVehicles"] =free_vehicles;  //NA/Blank/1/0
                                    trip_common_data[mtripid]["DelayedArrived"] =delayed_arrived; //values or blank or NA
    
    
                                    trip_common_data[mtripid]["ImeiNo1"]= rowtrip?.imei_no || "";
                                    trip_common_data[mtripid]["ImeiNo2"]= rowtrip?.imei_no2 || "";
                                    trip_common_data[mtripid]["ImeiNo3"]= rowtrip?.imei_no3 || "";
                                    trip_common_data[mtripid]["ImeiNo1Type"]= imei_type1;
                                    trip_common_data[mtripid]["ImeiNo2Type"]= imei_type2;
                                    trip_common_data[mtripid]["ImeiNo3Type"]= imei_type3;
                                    trip_common_data[mtripid]["GPSVendor1"]=  rowtrip?.gps_vendor_name || "";
                                    trip_common_data[mtripid]["GPSVendor2"]= rowtrip?.gps_vendor2 || "";
                                    trip_common_data[mtripid]["GPSVendor3"]= rowtrip?.gps_vendor3 || "";
                                    trip_common_data[mtripid]["Distance1"]= rowtrip?.distance_km || "";
                                    trip_common_data[mtripid]["Distance2"]= rowtrip?.distance_km_2 || "";
                                    trip_common_data[mtripid]["Distance3"]= rowtrip?.distance_km_3 || "";
                                    trip_common_data[mtripid]["RunDate"]= rowtrip.run_date;
                                    trip_common_data[mtripid]["RunCode"]= rowtrip?.run_code || "";
                                    trip_common_data[mtripid]["FleetNo"]= rowtrip?.fleet_no|| "";
                                    trip_common_data[mtripid]["Route"]= rowtrip?.route_code|| "";
                                    trip_common_data[mtripid]["RouteCategory"]=feeder_parent_bin[rowtrip.trip_type];
                                    trip_common_data[mtripid]["Origin"]= rowtrip.source_code;
                                    trip_common_data[mtripid]["Destination"]=  rowtrip.destination_code;
                                    trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                    trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                    trip_common_data[mtripid]["ShipmentMethod"]= shipment_method;
                                    trip_common_data[mtripid]["DriverName"]= driver_name;
                                    trip_common_data[mtripid]["DriverNumber"]= driver_mobile;
                                    trip_common_data[mtripid]["TTMapped"]= scTTmapped;                                                              
                                    trip_common_data[mtripid]["DistanceCover"]= rowtrip?.distanceKm ||"";
                                    trip_common_data[mtripid]["RemainingDistance"]= curr_dest_distance;
                                    trip_common_data[mtripid]["CloseBy"]= rowtrip?.close_by || rowtrip?.close_remarks;                                                                
                                    trip_common_data[mtripid]["CloseDate"]= rowtrip?.close_date || "";

                                    trip_common_data[mtripid]["MobileATD"]= val_DepartureGeo;
                                    trip_common_data[mtripid]["MobileATA"]= val_ArrivalGeo;
                                    trip_common_data[mtripid]["GPSATD"]= val_DepartureGps;
                                    trip_common_data[mtripid]["GPSATA"]= val_ArrivalGps;
                                    trip_common_data[mtripid]["ApiATD"]= val_DepartureApi;
                                    trip_common_data[mtripid]["ApiATA"]= val_ArrivalApi;
                                    trip_common_data[mtripid]["AHT"]=  rowtrip?.aht || "";
    
                                    trip_common_data[mtripid]["ATA"]= ata_tmp;
                                    trip_common_data[mtripid]["ATD"]= atd_tmp;
                                    trip_common_data[mtripid]["STA"]= rowtrip?.schedule_arrival || "";
                                    trip_common_data[mtripid]["STD"]= rowtrip?.schedule_departure || "";
                                    trip_common_data[mtripid]["VehicleGeocoord"]= vehicle_geocoord;
                                    trip_common_data[mtripid]["LastLocation"]= last_location;
                                    trip_common_data[mtripid]["DelayReason"] ="";
                                    trip_common_data[mtripid]["Customer"]=customerData[mtripid] || "";
                                    
                                    trip_common_data[mtripid]["FixedLockInactive"] = "" ;//1/0
                                    trip_common_data[mtripid]["FixedLockNA"] = "" ;//1/0
                                    trip_common_data[mtripid]["PortableLockInactive"] = ""; //1/0
                                    trip_common_data[mtripid]["PortableLockNA"] = "";//1/0
                                }
                                else
                                {
                                    vehicle_status_modified="Stopped < 2Hr";
                                    // active skip
                                    if(rowtrip.trip_status==1)
                                    {
                                        trip_stopped_2h_less[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                    }
                                   
                                    trip_common_data[mtripid] = {
                                        TripStatus: (rowtrip.trip_status===1) ? "Schedule" : "Completed"
                                    };
                                    trip_common_data[mtripid]["MTripId"] = mtripid;
                                    trip_common_data[mtripid]["ShipmentNo"] = rowtrip.shipment_no;
                                    trip_common_data[mtripid]["VehicleNo"] = rowtrip.vehicle_no;
                                    trip_common_data[mtripid]["Region"] = rowtrip.region_code;
                                    if(rowtrip.trip_status==1)
                                    {
                                        bin_sch_vehicles.push(rowtrip.vehicle_no);
                                        trip_common_data[mtripid]["VehicleStatus"] = vehicle_status_modified;
                                        trip_common_data[mtripid]["GPSFilter"] = "Stopped";
                                        trip_common_data[mtripid]["StoppageFilter"] = "Stop<2Hrs";
                                        trip_common_data[mtripid]["Stop<2Hrs"] = secondsToDecimalHours(secs); //blank/value
                                        trip_common_data[mtripid]["AtSource"] =flag_at_source; //NA/Blank/1/0
                                        trip_common_data[mtripid]["AtDestination"] =flag_at_destination; //NA/Blank/1/0    
                                    }
                                    else
                                    {
                                        trip_common_data[mtripid]["VehicleStatus"] = "Completed";
                                        trip_common_data[mtripid]["GPSFilter"] = "";
                                        trip_common_data[mtripid]["StoppageFilter"] = "";
                                        trip_common_data[mtripid]["Stop<2Hrs"] = ""; //blank/value
                                        trip_common_data[mtripid]["AtSource"] =at_source; //NA/Blank/1/0
                                        trip_common_data[mtripid]["AtDestination"] =at_destination; //NA/Blank/1/0
                                    }
                                    trip_common_data[mtripid]["FixedLockFilter"] ="";
                                    trip_common_data[mtripid]["PortableLockFilter"] ="";
                                    
                                    trip_common_data[mtripid]["VehicleLastTime"] = last_time;
                                    
                                    trip_common_data[mtripid]["Stop>2Hrs"] = ""; //blank/value
                                    trip_common_data[mtripid]["DelayStatus"] = ""; //blank/1/0
                                    trip_common_data[mtripid]["CriticalDelayStatus"] = ""; //blank/1/0
                                    trip_common_data[mtripid]["DelayTime"] = "NA"; //time value
                                    trip_common_data[mtripid]["OnTime"] = "NA"; //Yes/No
                                    trip_common_data[mtripid]["DelayFilter"] = "";
                                    trip_common_data[mtripid]["ETAFilter"] = "";
                                    trip_common_data[mtripid]["ETA"] = ""
                                    trip_common_data[mtripid]["ETA>2Hrs"] = ""; //blank /values
                                    trip_common_data[mtripid]["ETA<2Hrs"] = ""//blank/values                                
                                    trip_common_data[mtripid]["FixedLock"] = "NA" //1/0
                                    trip_common_data[mtripid]["FixedLockOpen"] =""; //blank/Open/Close
                                    trip_common_data[mtripid]["PortableLock"] ="NA"; //1/0/NA
                                    trip_common_data[mtripid]["PortableLockOpen"] ="";  //blank/Open/Close
                                    trip_common_data[mtripid]["LockFilter"] =  "";
                                    trip_common_data[mtripid]["AlertFilter"] = "";
                                    trip_common_data[mtripid]["Alert"] ="NA";//Alert
                                    trip_common_data[mtripid]["AlertTime"] ="NA";//AlertTime
                                    trip_common_data[mtripid]["RouteDeviation"] ="NA";  //NA blank values
                                    trip_common_data[mtripid]["LockAlert"] ="NA";//LockAlert
                                    trip_common_data[mtripid]["UnAuthLockAlert"] ="NA";//UnAuthLockAlert
                                    trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                    trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                    trip_common_data[mtripid]["Halt"] =stop_since;  //NA blank values
                                                                     
                                    trip_common_data[mtripid]["FreeVehicles"] =free_vehicles;  //NA/Blank/1/0
                                    trip_common_data[mtripid]["DelayedArrived"] =delayed_arrived; //values or blank or NA
    
    
                                    trip_common_data[mtripid]["ImeiNo1"]= rowtrip?.imei_no || "";
                                    trip_common_data[mtripid]["ImeiNo2"]= rowtrip?.imei_no2 || "";
                                    trip_common_data[mtripid]["ImeiNo3"]= rowtrip?.imei_no3 || "";
                                    trip_common_data[mtripid]["ImeiNo1Type"]= imei_type1;
                                    trip_common_data[mtripid]["ImeiNo2Type"]= imei_type2;
                                    trip_common_data[mtripid]["ImeiNo3Type"]= imei_type3;
                                    trip_common_data[mtripid]["GPSVendor1"]=  rowtrip?.gps_vendor_name || "";
                                    trip_common_data[mtripid]["GPSVendor2"]= rowtrip?.gps_vendor2 || "";
                                    trip_common_data[mtripid]["GPSVendor3"]= rowtrip?.gps_vendor3 || "";
                                    trip_common_data[mtripid]["Distance1"]= rowtrip?.distance_km || "";
                                    trip_common_data[mtripid]["Distance2"]= rowtrip?.distance_km_2 || "";
                                    trip_common_data[mtripid]["Distance3"]= rowtrip?.distance_km_3 || "";
                                    trip_common_data[mtripid]["RunDate"]= rowtrip.run_date;
                                    trip_common_data[mtripid]["RunCode"]= rowtrip?.run_code || "";
                                    trip_common_data[mtripid]["FleetNo"]= rowtrip?.fleet_no|| "";
                                    trip_common_data[mtripid]["Route"]= rowtrip?.route_code|| "";
                                    trip_common_data[mtripid]["RouteCategory"]=feeder_parent_bin[rowtrip.trip_type];
                                    trip_common_data[mtripid]["Origin"]= rowtrip.source_code;
                                    trip_common_data[mtripid]["Destination"]=  rowtrip.destination_code;
                                    trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                    trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                    trip_common_data[mtripid]["ShipmentMethod"]= shipment_method;
                                    trip_common_data[mtripid]["DriverName"]= driver_name;
                                    trip_common_data[mtripid]["DriverNumber"]= driver_mobile;
                                    trip_common_data[mtripid]["TTMapped"]= scTTmapped;                                                              
                                    trip_common_data[mtripid]["DistanceCover"]= rowtrip?.distanceKm ||"";
                                    trip_common_data[mtripid]["RemainingDistance"]= curr_dest_distance;
                                    trip_common_data[mtripid]["CloseBy"]= rowtrip?.close_by || rowtrip?.close_remarks;                                                                
                                    trip_common_data[mtripid]["CloseDate"]= rowtrip?.close_date || "";

                                    trip_common_data[mtripid]["MobileATD"]= val_DepartureGeo;
                                    trip_common_data[mtripid]["MobileATA"]= val_ArrivalGeo;
                                    trip_common_data[mtripid]["GPSATD"]= val_DepartureGps;
                                    trip_common_data[mtripid]["GPSATA"]= val_ArrivalGps;
                                    trip_common_data[mtripid]["ApiATD"]= val_DepartureApi;
                                    trip_common_data[mtripid]["ApiATA"]= val_ArrivalApi;
                                    trip_common_data[mtripid]["AHT"]=  rowtrip?.aht || "";
    
                                    trip_common_data[mtripid]["ATA"]= ata_tmp;
                                    trip_common_data[mtripid]["ATD"]= atd_tmp;
                                    trip_common_data[mtripid]["STA"]= rowtrip?.schedule_arrival || "";
                                    trip_common_data[mtripid]["STD"]= rowtrip?.schedule_departure || "";
                                    trip_common_data[mtripid]["VehicleGeocoord"]= vehicle_geocoord;
                                    trip_common_data[mtripid]["LastLocation"]= last_location;
                                    trip_common_data[mtripid]["DelayReason"] ="";
                                    trip_common_data[mtripid]["Customer"]=customerData[mtripid] || "";
                                    
                                    trip_common_data[mtripid]["FixedLockInactive"] = "" ;//1/0
                                    trip_common_data[mtripid]["FixedLockNA"] = "" ;//1/0
                                    trip_common_data[mtripid]["PortableLockInactive"] = ""; //1/0
                                    trip_common_data[mtripid]["PortableLockNA"] = "";//1/0
                                } 
                           
                            }
                            else
                            {
                                vehicle_status_modified="Running";
                                if(rowtrip.trip_status==1)
                                {
                                    trip_running[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                       
                                    };
                                }
                                
                                trip_common_data[mtripid] = {
                                    TripStatus: (rowtrip.trip_status===1) ? "Schedule" : "Completed"
                                };
                                trip_common_data[mtripid]["MTripId"] = mtripid;
                                trip_common_data[mtripid]["ShipmentNo"] = rowtrip.shipment_no;
                                trip_common_data[mtripid]["VehicleNo"] = rowtrip.vehicle_no;
                                trip_common_data[mtripid]["Region"] = rowtrip.region_code;
                                if(rowtrip.trip_status==1)
                                {
                                    bin_sch_vehicles.push(rowtrip.vehicle_no);
                                    trip_common_data[mtripid]["VehicleStatus"] = vehicle_status_modified;
                                    trip_common_data[mtripid]["GPSFilter"] = "Running";
                                    trip_common_data[mtripid]["StoppageFilter"] = "Running";
                                    trip_common_data[mtripid]["AtSource"] =flag_at_source; //NA/Blank/1/0
                                    trip_common_data[mtripid]["AtDestination"] =flag_at_destination; //NA/Blank/1/0 
                                }
                                else
                                {
                                    trip_common_data[mtripid]["VehicleStatus"] = vehicle_status_modified;
                                    trip_common_data[mtripid]["GPSFilter"] = "";
                                    trip_common_data[mtripid]["StoppageFilter"] = "";
                                    trip_common_data[mtripid]["AtSource"] =at_source; //NA/Blank/1/0
                                    trip_common_data[mtripid]["AtDestination"] =at_destination; //NA/Blank/1/0
                                }
                                trip_common_data[mtripid]["FixedLockFilter"] ="";
                                trip_common_data[mtripid]["PortableLockFilter"] ="";
                                
                                trip_common_data[mtripid]["VehicleLastTime"] = last_time;
                                
                                trip_common_data[mtripid]["Stop>2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["Stop<2Hrs"] = ""; //blank/value
                                trip_common_data[mtripid]["DelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["CriticalDelayStatus"] = ""; //blank/1/0
                                trip_common_data[mtripid]["DelayTime"] = "NA"; //time value
                                trip_common_data[mtripid]["OnTime"] = "NA"; //Yes/No
                                trip_common_data[mtripid]["DelayFilter"] = "";
                                trip_common_data[mtripid]["ETAFilter"] = "";
                                trip_common_data[mtripid]["ETA"] = ""
                                trip_common_data[mtripid]["ETA>2Hrs"] = ""; //blank /values
                                trip_common_data[mtripid]["ETA<2Hrs"] = ""//blank/values                                
                                trip_common_data[mtripid]["FixedLock"] = "NA" //1/0
                                trip_common_data[mtripid]["FixedLockOpen"] =""; //blank/Open/Close
                                trip_common_data[mtripid]["PortableLock"] ="NA"; //1/0/NA
                                trip_common_data[mtripid]["PortableLockOpen"] ="";  //blank/Open/Close
                                trip_common_data[mtripid]["LockFilter"] =  "";
                                trip_common_data[mtripid]["AlertFilter"] = ""; 
                                trip_common_data[mtripid]["Alert"] ="NA";//Alert
                                trip_common_data[mtripid]["AlertTime"] ="NA";//AlertTime
                                trip_common_data[mtripid]["RouteDeviation"] ="NA";  //NA blank values
                                trip_common_data[mtripid]["LockAlert"] ="NA";//LockAlert
                                trip_common_data[mtripid]["UnAuthLockAlert"] ="NA";//UnAuthLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["TamperLockAlert"] ="NA";//TamperLockAlert
                                trip_common_data[mtripid]["Halt"] ="NA";  //NA blank values
                                                                
                                trip_common_data[mtripid]["FreeVehicles"] =free_vehicles;  //NA/Blank/1/0
                                trip_common_data[mtripid]["DelayedArrived"] =delayed_arrived; //values or blank or NA


                                trip_common_data[mtripid]["ImeiNo1"]= rowtrip?.imei_no || "";
                                trip_common_data[mtripid]["ImeiNo2"]= rowtrip?.imei_no2 || "";
                                trip_common_data[mtripid]["ImeiNo3"]= rowtrip?.imei_no3 || "";
                                trip_common_data[mtripid]["ImeiNo1Type"]= imei_type1;
                                trip_common_data[mtripid]["ImeiNo2Type"]= imei_type2;
                                trip_common_data[mtripid]["ImeiNo3Type"]= imei_type3;
                                trip_common_data[mtripid]["GPSVendor1"]=  rowtrip?.gps_vendor_name || "";
                                trip_common_data[mtripid]["GPSVendor2"]= rowtrip?.gps_vendor2 || "";
                                trip_common_data[mtripid]["GPSVendor3"]= rowtrip?.gps_vendor3 || "";
                                trip_common_data[mtripid]["Distance1"]= rowtrip?.distance_km || "";
                                trip_common_data[mtripid]["Distance2"]= rowtrip?.distance_km_2 || "";
                                trip_common_data[mtripid]["Distance3"]= rowtrip?.distance_km_3 || "";
                                trip_common_data[mtripid]["RunDate"]= rowtrip.run_date;
                                trip_common_data[mtripid]["RunCode"]= rowtrip?.run_code || "";
                                trip_common_data[mtripid]["FleetNo"]= rowtrip?.fleet_no|| "";
                                trip_common_data[mtripid]["Route"]= rowtrip?.route_code|| "";
                                trip_common_data[mtripid]["RouteCategory"]=feeder_parent_bin[rowtrip.trip_type];
                                trip_common_data[mtripid]["Origin"]= rowtrip.source_code;
                                trip_common_data[mtripid]["Destination"]=  rowtrip.destination_code;
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["Transporter"]= rowtrip?.transporter_name || "";
                                trip_common_data[mtripid]["ShipmentMethod"]= shipment_method;
                                trip_common_data[mtripid]["DriverName"]= driver_name;
                                trip_common_data[mtripid]["DriverNumber"]= driver_mobile;
                                trip_common_data[mtripid]["TTMapped"]= scTTmapped;                                                              
                                trip_common_data[mtripid]["DistanceCover"]= rowtrip?.distance_km ||"";
                                trip_common_data[mtripid]["RemainingDistance"]= curr_dest_distance;
                                trip_common_data[mtripid]["CloseBy"]= rowtrip?.close_by || rowtrip?.close_remarks;                                                          
                                trip_common_data[mtripid]["CloseDate"]= rowtrip?.close_date || "";

                                trip_common_data[mtripid]["MobileATD"]= val_DepartureGeo;
                                trip_common_data[mtripid]["MobileATA"]= val_ArrivalGeo;
                                trip_common_data[mtripid]["GPSATD"]= val_DepartureGps;
                                trip_common_data[mtripid]["GPSATA"]= val_ArrivalGps;
                                trip_common_data[mtripid]["ApiATD"]= val_DepartureApi;
                                trip_common_data[mtripid]["ApiATA"]= val_ArrivalApi;
                                trip_common_data[mtripid]["AHT"]=  rowtrip?.aht || "";

                                trip_common_data[mtripid]["ATA"]= ata_tmp;
                                trip_common_data[mtripid]["ATD"]= atd_tmp;
                                trip_common_data[mtripid]["STA"]= rowtrip?.schedule_arrival || "";
                                trip_common_data[mtripid]["STD"]= rowtrip?.schedule_departure || "";
                                trip_common_data[mtripid]["VehicleGeocoord"]= vehicle_geocoord;
                                trip_common_data[mtripid]["LastLocation"]= last_location;
                                trip_common_data[mtripid]["DelayReason"] ="";
                                trip_common_data[mtripid]["Customer"]=customerData[mtripid] || "";
                               
                                trip_common_data[mtripid]["FixedLockInactive"] = "" ;//1/0
                                trip_common_data[mtripid]["FixedLockNA"] = "" ;//1/0
                                trip_common_data[mtripid]["PortableLockInactive"] = ""; //1/0
                                trip_common_data[mtripid]["PortableLockNA"] = "";//1/0
                            }

                            ///--------End of main filter------------//
                            let projected_eta=binDashboardData[ship]?.eta;
                            let projected_eta_arr1 = projected_eta.split(":");
                            let new_time=binDashboardData[ship]?.delaying_sta;


                            if(strtotime(new_time) > strtotime(sta) && sta!="" && new_time!="")
                            {
                                let diff_time_proj_a=strtotime(new_time) -strtotime(sta);
                                if(diff_time_proj_a >=7200 && diff_time_proj_a < 18000)  //15 min
                                {
                                    if(rowtrip.trip_status==1)
                                    {
                                        vehicle_status_modified2="Delay";
                                        trip_delay[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                        
                                        };
                                        trip_common_data[mtripid]["DelayFilter"] = "Delay";
                                        trip_common_data[mtripid]["DelayStatus"] =1;
                                        trip_common_data[mtripid]["DelayTime"] = secondsToDecimalHours(diff_time_proj_a);
                                        trip_common_data[mtripid]["ETA"] = new_time;
                                        trip_common_data[mtripid]["DelayReason"] =delay300series;
                                    }
                                    
                                }
                                else if(diff_time_proj_a >= 18000)
                                {
                                    if(rowtrip.trip_status==1)
                                    {

                                        vehicle_status_modified2="Critical Delay";
                                        trip_critical_delay[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                        
                                        };
                                        trip_common_data[mtripid]["DelayFilter"] = "Critical Delay";
                                        trip_common_data[mtripid]["DelayStatus"] =1;
                                        trip_common_data[mtripid]["DelayTime"] = secondsToDecimalHours(diff_time_proj_a);
                                        trip_common_data[mtripid]["ETA"] = new_time;
                                        trip_common_data[mtripid]["DelayReason"] =delay300series;
                                    }
                                    
                                }
                                else
                                {
                                    let delay_hr_flash =binDashboardData[ship]?.delay_hr;
                                    if(diff_time_proj_a < 7200  && delay_hr_flash <= 0.02) 
                                    {
                                        if(rowtrip.trip_status==1)
                                        {
                                            vehicle_status_modified2="OnTime";
                                            trip_ontime[mtripid] = {
                                                ShipmentNo: rowtrip.shipment_no,
                                            
                                            };
                                            trip_common_data[mtripid]["DelayFilter"] = "OnTime";
                                            trip_common_data[mtripid]["OnTime"] = "Yes";
                                            trip_common_data[mtripid]["ETA"] = new_time;
                                        }
                                        
                                    }
                                    else
                                    {
                                        //if(diff_time_proj_a >= 7200 && diff_time_proj_a < 18000)
                                        {
                                            if(rowtrip.trip_status==1)
                                            {
                                                vehicle_status_modified2="Delay";
                                                trip_delay[mtripid] = {
                                                    ShipmentNo: rowtrip.shipment_no
                                                
                                                };
                                                trip_common_data[mtripid]["DelayFilter"] = "Delay";
                                                trip_common_data[mtripid]["DelayStatus"] =1;
                                                trip_common_data[mtripid]["DelayTime"] = secondsToDecimalHours(diff_time_proj_a);
                                                trip_common_data[mtripid]["ETA"] = new_time;
                                                trip_common_data[mtripid]["DelayReason"] =delay300series;
                                            }
                                        }
                                    }
                                }


                            }
                            else
                            {
                                if(rowtrip.trip_status==1)
                                {
                                    let new_eta=binDashboardData[ship]?.eta;
                                    vehicle_status_modified2="OnTime";
                                    trip_ontime[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no,
                                    
                                    };
                                    trip_common_data[mtripid]["DelayFilter"] = "OnTime";
                                    trip_common_data[mtripid]["OnTime"] = "Yes";
                                    trip_common_data[mtripid]["ETA"] = new_eta;
                                }
                                
                            }
                            if(new_time && new_time != "" && rowtrip.trip_status==1){
                                let diff_time_proj=strtotime(new_time) -strtotime(currentDateTime);
                                if(strtotime(new_time) > strtotime(currentDateTime) && new_time!="") 
                                {
                                    
                                    if(diff_time_proj <=7199) 
                                    {
                                        if(rowtrip.trip_status==1)
                                        {
                                            //etawithin2 hr
                                            vehicle_status_modified2="ETA Less 2Hrs.";
                                            trip_eta_station_less2h[mtripid] = {
                                                ShipmentNo: rowtrip.shipment_no
                                                
                                            };

                                            trip_common_data[mtripid]["ETAFilter"] = "ETA<2Hrs";
                                            
                                            trip_common_data[mtripid]["ETA<2Hrs"] = new_time;
                                        }
                                        
                                    
                                        
                                    }
                                    else
                                    {
                                        if(rowtrip.trip_status==1)
                                        {
                                            vehicle_status_modified2="ETA > 2Hrs.";
                                            trip_eta_station_greater2h[mtripid] = {
                                                ShipmentNo: rowtrip.shipment_no
                                                
                                            };
                                            trip_common_data[mtripid]["ETAFilter"] = "ETA>2Hrs";
                                            trip_common_data[mtripid]["ETA>2Hrs"] = new_time;
                                        }
                                    }


                                }
                                else if(strtotime(new_time) < strtotime(currentDateTime) && new_time!="")
                                {
                                    if(rowtrip.trip_status==1)
                                        {
                                            //etawithin2 hr
                                            vehicle_status_modified2="ETA Less 2Hrs.";
                                            trip_eta_station_less2h[mtripid] = {
                                                ShipmentNo: rowtrip.shipment_no
                                                
                                            };

                                            trip_common_data[mtripid]["ETAFilter"] = "ETA<2Hrs";
                                            
                                            trip_common_data[mtripid]["ETA<2Hrs"] = new_time;
                                        }
                                }
                            }
                            else
                            {
                                if(rowtrip.trip_status==1)
                                {
                                    vehicle_status_modified2="ETA > 2Hrs.";
                                    trip_eta_station_greater2h[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["ETAFilter"] = "ETA>2Hrs";
                                    trip_common_data[mtripid]["ETA>2Hrs"] = new_time;
                                }
                            }
                            /*
                            let vehicle_fixed_lock=binDashboardData[ship]?.fixed_lock || "";
                            let vehicle_portable_lock=binDashboardData[ship]?.portable_lock || "";
                            if(vehicle_fixed_lock!="NA" && rowtrip.trip_status==1 &&  vehicle_fixed_lock!="")// 
                            {
                                    let lock_status_fixed ="";
                                    if(vehicle_fixed_lock=="0" || vehicle_fixed_lock==0)
                                    {
                                        lock_status_fixed ="Open";
                                        trip_fixedlock_open ++;
                                    }
                                    else if(vehicle_fixed_lock=="1" || vehicle_fixed_lock==1)
                                    {
                                        lock_status_fixed="Close";
                                        trip_fixedlock_close ++;
                                    }
                                   
                                    trip_fixedlock[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["LockFilter"] =  "FixedLock";
                                    trip_common_data[mtripid]["FixedLock"] = 1 //1/0
                                    trip_common_data[mtripid]["FixedLockOpen"] =lock_status_fixed; //blank/Open/Close
                                
                            }
                          
                            else if (rowtrip.trip_status==1 && rowtrip.imei_no2 != "" && binDashboardData[ship].last_data2 != "" && binDashboardData[ship].last_data2.deviceDatetimeLR[0] != "") {
                                let letdtTime2 = binDashboardData[ship].last_data2.deviceDatetimeLR[0]; 
                                let dtFormatTime = moment(letdtTime2, 'YYYY-MM-DD HH:mm:ss');  
                                // const diffInHours = currentDateTime.diff(dtFormatTime, 'hours');
                                let diffInHours = strtotime(currentDateTime) - strtotime(dtFormatTime); 
                                if (diffInHours >= 86400) {
                                    // inactive code
                                    console.log("lock inactive ");
                                        trip_fixedlockInactive[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                        trip_common_data[mtripid]["LockFilter"] =  "FixedLockInactive";
                                        trip_common_data[mtripid]["FixedLockInactive"] = 1 //1/0
                                        trip_fixedlock_Inactive++;
                                }else{
                                    // console.log("lock available but else ");
                                     trip_fixedlock_Inactive++;
                                }
                            }

                            else
                            {
                                
                                if(rowtrip.trip_status==1 && binDashboardData[ship]?.fixed_lock==3)
                                {
                                    trip_fixedlockNA[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["LockFilter"] =  "FixedLockNA";
                                    trip_common_data[mtripid]["FixedLockNA"] = 1 //1/0

                                    trip_fixedlock_NA++;
                                }
                               
                            }

                            if(vehicle_portable_lock!="NA")
                            {
                                if(rowtrip.trip_status==1)
                                {
                                    let lock_status_portable="";
                                    if(vehicle_portable_lock=="0" || vehicle_portable_lock==0)
                                    {
                                        lock_status_portable="Open";
                                        trip_portablelock_open ++;
                                    }
                                    else if(vehicle_portable_lock=="1" || vehicle_portable_lock==1)
                                    {
                                        lock_status_portable="Close";
                                        trip_portablelock_close ++;
                                    }
                                    trip_portablelock[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["LockFilter"] =  "PortableLock";
                                    trip_common_data[mtripid]["PortableLock"] =1; //1/0/NA
                                    trip_common_data[mtripid]["PortableLockOpen"] =lock_status_portable;  //blank/Open/Close
                                }
                                
                            }
                            else if (rowtrip.trip_status==1 && rowtrip.imei_no3 != "" && binDashboardData[ship].last_data3 != "" && binDashboardData[ship].last_data3.deviceDatetimeLR[0] != "") {
                                let letdtTime3 = binDashboardData[ship].last_data3.deviceDatetimeLR[0]; 
                                console.log("letdtTime3",letdtTime3);
                        
                                let dtFormatTime = moment(letdtTime3, 'YYYY-MM-DD HH:mm:ss');  
                                let diffInHours = strtotime(currentDateTime) - strtotime(dtFormatTime); 
                                console.log("diffInHours0",diffInHours);
                                
                                if (diffInHours >= 86400) {
                                        
                                        //console.log("diffInHours",diffInHours);
                                        //process.exit();
                                        trip_portablelockInactive[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                        trip_common_data[mtripid]["LockFilter"] =  "PortableLockInactive";
                                        trip_common_data[mtripid]["PortableLockInactive"] = 1 //1/0
                                        trip_portablelock_Inactive++;
                                }
                            }

                            else
                            {
                                if(rowtrip.trip_status==1 && binDashboardData[ship]?.portable_lock==3)
                                {
                                    trip_portablelockNA[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["LockFilter"] =  "PortableLockNA";
                                    trip_common_data[mtripid]["PortableLockNA"] = 1 //1/0
                                    trip_portablelock_NA++;
                                }
                               
                            }
                            */
                            let vehicle_fixed_lock=binDashboardData[ship]?.fixed_lock || "";
                            let vehicle_portable_lock=binDashboardData[ship]?.portable_lock || "";
                            if(rowtrip.trip_status==1){

                                if(vehicle_fixed_lock==0 || vehicle_fixed_lock==1)// 
                                {
                                    let lock_status_fixed ="";
                                    if(vehicle_fixed_lock=="0" || vehicle_fixed_lock==0)
                                    {
                                        lock_status_fixed ="Open";
                                        trip_fixedlock_open ++;
                                        trip_common_data[mtripid]["FixedLockFilter"] ="Open";
                                        
                                    }
                                    else if(vehicle_fixed_lock=="1" || vehicle_fixed_lock==1)
                                    {
                                        lock_status_fixed="Close";
                                        trip_fixedlock_close ++;
                                        trip_common_data[mtripid]["FixedLockFilter"] ="Close";
                                        
                                    }
                                    
                                    trip_fixedlock[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["LockFilter"] =  "FixedLock";
                                    trip_common_data[mtripid]["FixedLock"] = 1 //1/0
                                    trip_common_data[mtripid]["FixedLockOpen"] =lock_status_fixed; //blank/Open/Close
                                    
                                    
                                }else if(vehicle_fixed_lock == 2) {
                                    
                                    trip_fixedlockInactive[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["FixedLockFilter"] ="Inactive";
                                    
                                    trip_common_data[mtripid]["LockFilter"] =  "FixedLockInactive";
                                    trip_common_data[mtripid]["FixedLockInactive"] = 1 //1/0
                                    trip_fixedlock_Inactive++;
                            
                                }else if(vehicle_fixed_lock == 3 || vehicle_fixed_lock =="NA"){
                                        trip_fixedlockNA[mtripid] = {
                                            ShipmentNo: rowtrip.shipment_no
                                            
                                        };
                                        trip_common_data[mtripid]["FixedLockFilter"] ="NonElock";
                                        
                                        trip_common_data[mtripid]["LockFilter"] =  "FixedLockNA";
                                        trip_common_data[mtripid]["FixedLockNA"] = 1 //1/0

                                        trip_fixedlock_NA++;
                                }else{
                                    //console.log("Wrong Value Come From trip_dashboard_live_status For Fixed Lock");
                                }

                                if(vehicle_portable_lock==0 || vehicle_portable_lock==1){

                                    let lock_status_portable="";
                                    if(vehicle_portable_lock=="0" || vehicle_portable_lock==0)
                                    {
                                        
                                        trip_common_data[mtripid]["PortableLockFilter"] ="Open";
                                        lock_status_portable="Open";
                                        trip_portablelock_open ++;
                                    }
                                    else if(vehicle_portable_lock=="1" || vehicle_portable_lock==1)
                                    {
                                        
                                        trip_common_data[mtripid]["PortableLockFilter"] ="Close";
                                        lock_status_portable="Close";
                                        trip_portablelock_close ++;
                                    }
                                    trip_portablelock[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    trip_common_data[mtripid]["LockFilter"] =  "PortableLock";
                                    trip_common_data[mtripid]["PortableLock"] =1; //1/0/NA
                                    trip_common_data[mtripid]["PortableLockOpen"] =lock_status_portable;  //blank/Open/Close
                                    
                                    
                                }else if (vehicle_portable_lock == 2) { 

                                    trip_portablelockInactive[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    
                                    trip_common_data[mtripid]["PortableLockFilter"] ="Inactive";
                                    trip_common_data[mtripid]["LockFilter"] =  "PortableLockInactive";
                                    trip_common_data[mtripid]["PortableLockInactive"] = 1 //1/0
                                    trip_portablelock_Inactive++;

                                }else if(vehicle_portable_lock == 3 || vehicle_portable_lock == "NA"){

                                    trip_portablelockNA[mtripid] = {
                                        ShipmentNo: rowtrip.shipment_no
                                        
                                    };
                                    
                                    trip_common_data[mtripid]["PortableLockFilter"] ="NonElock";
                                    trip_common_data[mtripid]["LockFilter"] =  "PortableLockNA";
                                    trip_common_data[mtripid]["PortableLockNA"] = 1 //1/0
                                    trip_portablelock_NA++;
                                    
                                }else{
                                    //console.log("Wrong Value Come From trip_dashboard_live_status for Portable lock");
                                }
                            }
                            //-------end of main code--------------------//

                        });

                    }

                    //);

                    
                    //console.log(bin_sch_vehicles);
                     
                    //process.exit(0);
                    for (const [key, rowtrip] of Object.entries(trip_common_data))
                    {
                        let  stoppageAlerts ="";
                        //console.log(key);
                        

                        if(rowtrip.TripStatus=="Completed")
                        {
                            let idle_time=0;
                            //console.log(rowtrip.CloseDate,bin_sch_vehicles[rowtrip.VehicleNo]);
                        //console.log(bin_sch_vehicles);process.exit(0);
                            if(!bin_sch_vehicles.includes(rowtrip.VehicleNo) && rowtrip.CloseDate!="" && !bin_capture_free_vehicles.includes(rowtrip.VehicleNo))
                            {
                                let cls_date= rowtrip.CloseDate;
                                idle_time =strtotime(current_time)-strtotime(cls_date);
                                //if(idle_time >7200)
                                {
                                    // console.log(rowtrip.VehicleNo,idle_time);
                                    free_vehicles_cnt++;
                                    trip_common_data[rowtrip.MTripId]["FreeVehicles"]=1;
                                    bin_capture_free_vehicles.push(rowtrip.VehicleNo);
                                }
                            }
                        }

                        if(rowtrip.ATA && rowtrip.STA)
                        {
                            let dely_arrived="";
                            let ata1=rowtrip.ATA;
                            let sta1=rowtrip.STA;
                            if(strtotime(ata1) > strtotime(sta1))
                            {
                                dely_arrived=strtotime(ata1)- strtotime(sta1);
                                delayed_arrived_cnt++;
                                trip_common_data[rowtrip.MTripId]["DelayedArrived"]=secondsToDecimalHours(dely_arrived);
                            }
                        }
                           
                        //console.log(key,trigger_info['67ad5b049d53bba6ac00ff56'].DFG);process.exit(0);
                        // ['DFG','SCHEDULED_HALT','UNSCHEDULED_HALT','SENSITIVE_HALT','CRITICAL','UNAUTHORIZED_LOCK','TAMPER_LOCK','SCHEDULED_FUEL_STATION','SCHEDULED_DHABA'];
                    
                        if (trigger_info[key] ) {
                            if(rowtrip.TripStatus=="Schedule")
                            {    
                                let key_alert=Object.keys(trigger_info[key]);
                                key_alert.forEach(element => {
                                    //console.log(trigger_info[key][element]);process.exit(0);
                                    if(chk_alert.includes(element) && element=="DFG")
                                    {
                                        trip_dfg[rowtrip.MTripId] = {
                                            ShipmentNo: rowtrip.ShipmentNo
                                        
                                        };
                                        //console.log(trigger_info[key].DFG[0].location);process.exit(0);
                                        trip_common_data[rowtrip.MTripId]["RouteDeviation"]= "Route Deviated From "+trigger_info[key].DFG[0].location ;  
                                        trip_common_data[rowtrip.MTripId]["Alert"]=trigger_info[key].DFG[0].alert_type;
                                        trip_common_data[rowtrip.MTripId]["AlertTime"]=trigger_info[key].DFG[0].sts;

                                        stoppageAlerts+=`RouteDeviation,`;
                                    }

                                    else if(chk_alert.includes(element) && (element=="UNAUTHORIZED_LOCK" || element=="TAMPER_LOCK"))
                                    {
                                        trip_lock[rowtrip.MTripId] = {
                                            ShipmentNo: rowtrip.ShipmentNo
                                        
                                        };
                                        

                                        stoppageAlerts+=element+",";
                                    }
                                    else if(chk_alert.includes(element) && (element=="SCHEDULED_HALT" || element=="UNSCHEDULED_HALT" || element=="SENSITIVE_HALT"|| element=="CRITICAL" || element=="SCHEDULED_FUEL_STATION" || element=="SCHEDULED_DHABA"))
                                    {
                                        trip_halt[rowtrip.MTripId] = {
                                            ShipmentNo: rowtrip.ShipmentNo
                                        
                                        };
                                        

                                        stoppageAlerts+=element+",";
                                    }
                                });
                               
                            }
                                    
                        }
                       
                        
                        
                        if(stoppageAlerts!="" )
                        {
                            stoppageAlerts = stoppageAlerts.slice(0, -1);
                            trip_common_data[rowtrip.MTripId]["AlertFilter"] = stoppageAlerts;
                        }
                    }
                    

                    // Similar to PHP's $data_final[]
                    let total_stopped=Object.keys(trip_stopped_2h).length+Object.keys(trip_stopped_2h_less).length;
                    let data_header = {
                        OnTrip:  Object.keys(trip_common_data).length ,
                        TripSchedule: trip_schedule,
                        TripCompleted : trip_completed,
                        NonGPS: Object.keys(trip_nonintegrated).length,
                        InActive:  Object.keys(trip_inactive).length,
                        Running: Object.keys(trip_running).length, 
                        Stopped: total_stopped,
                        CriticalDelay:  Object.keys(trip_critical_delay).length,
                        OnTimeTrip: Object.keys(trip_ontime).length,
                        Delay: Object.keys(trip_delay).length,
                        LockAlert: Object.keys(trip_lock).length,
                        ETA_2Hrs: Object.keys(trip_eta_station_less2h).length,
                        ETA_2HrsMore: Object.keys(trip_eta_station_greater2h).length,
                        Stop_2Hrs: Object.keys(trip_stopped_2h).length, 
                        Stop_2HrsLess: Object.keys(trip_stopped_2h_less).length, 
                        RouteDeviation: Object.keys(trip_dfg).length, 
                        Halt: Object.keys(trip_halt).length,
                        AtSource:at_source_cnt,
                        AtDestination: at_destination_cnt,
                        FreeVehicles: free_vehicles_cnt,
                        DelayedArrived:delayed_arrived_cnt,

                        FixedLock: Object.keys(trip_fixedlock).length,
                        PortableLock: Object.keys(trip_portablelock).length, 
                        FixedLockOpen: trip_fixedlock_open,
                        FixedLockClose: trip_fixedlock_close,
                        FixedLockNA:trip_fixedlock_NA,
                        FixedLockInactive: trip_fixedlock_Inactive,
                        PortableLockOpen: trip_portablelock_open,
                        PortableLockClose: trip_portablelock_close,
                        PortableLockNA: trip_portablelock_NA,
                        PortableLockInactive: trip_portablelock_Inactive
                    };

                    //console.log(trip_common_info);
                    /*data_final.TripData =trip_common_data;
                    data_final.OnTripDetail = trip_common_info;
                    data_final.CriticalDelayDetail = trip_critical_delay;
                    data_final.OnTimeTripDetail = trip_ontime;
                    data_final.DelayDetail = trip_delay;
                    data_final.LockAlertDetail = trip_lock;
                    data_final.ETA_2HrsDetail = trip_eta_station_less2h;
                    data_final.Stop_2HrsDetail = trip_stopped_2h;
                    data_final.DFGDetail = trip_dfg;
                    data_final.NonIntegratedDetail = trip_nonintegrated;
                    data_final.InActiveDetail = trip_inactive;
                    
                    data_final.FixedLockDetail = trip_fixedlock;
                    data_final.PortableLockDetail = trip_portablelock;*/

                    /*data_final.DayWiseTrip = trip_daywise_count;
                    data_final.DayWiseIntercityTrip = trip_daywise_intercity_count;
                    data_final.DayWiseIntracityTrip = trip_daywise_intracity_count;*/

                    // Output the data as JSON
                    //console.log(JSON.stringify(data_final));

                    final_data.Status="fail";
                    if(data_header)
                    {                        
                        final_data.Status="success";
                    }
                    final_data.Header=data_header;
                    final_data.MainDashboard=trip_common_data;
                    //final_data.Header=headerData;
                    
                    // console.log(trip_common_data);
                    
                    
                    //////END//////////
                }
                //res.status(200).json(slowArray);
                //res.status(200).json("success");
                
                res.status(200).json(final_data);
            }
        }
        else{
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
    }catch(error){
        res.status(500).json({error: error.message});
        // res.status(500).json({error: req.body});
    }
};




// exports.scheduleDashboardDtdcTrackingLink =async(req,res) =>{
//     try{
//         const {AccessToken,ShipmentNo,VehicleLastTime,DeveloperOption,DeveloperOptionId} =req.body;
//         let final_data = {};
//         final_data.Status="fail";
//         let response ={};
//         if(AccessToken!=null && ShipmentNo){
//             let user_info ={};
//             const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
//             if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
//             {
                
//                 user_info.Status=1;                
//                 user_info.AccountId=DeveloperOptionId;
//             }
//             else
//             {
//                  user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
//             }
//             //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
//             if (user_info && user_info.Status === 2) {
//                 response.Result = user_info.Result;
//                 response.Message = user_info.Message;
//                 final_data.Message=user_info.Message;
//                 res.status(200).json(final_data);
//             }
//             else{
//                 //to do code
//                 //const user_id =5659;
//                 const user_id = user_info.AccountId;
//                 const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
//                 if (result.length > 0) {
//                     const resultUsr=result[0];
//                     const user_type= resultUsr['user_type'];
//                     const self_group_id= resultUsr['group_id'];
//                     const group_id =resultUsr['group_id'];
//                     const group_type= resultUsr['group_type'];
//                     const name= resultUsr['name']; 


//                     const  tableP = 'courier_trip_detail';                    
//                     const conditionsP={};
//                     conditionsP.group_id=group_id;
//                     conditionsP.shipment_no=ShipmentNo;
//                     conditionsP.status=1;
//                     const fieldsP = {
//                         projection: {
//                             _id: 1,
//                             dynamic_url: 1,
//                             salt_key: 1,
//                             trip_status: 1,
//                             imei_no: 1,
//                             run_date: 1,
//                             last_gps_time: 1
//                         }
//                     };
//                     const result_val = await  mongu.getMongoQuery(conditionsP, fieldsP, tableP);
//                     if(result_val.length >0)
//                     {
//                         result_val.forEach((value) => { 
//                             let run_date= value.run_date;
//                             let imeino=value.imei_no;
//                             if(strtotime(VehicleLastTime) > strtotime(run_date))
//                             {
//                                 if(imeino)
//                                 {
//                                     if(value.dynamic_url)
//                                     {
//                                         final_data.Link=value.dynamic_url;
//                                         final_data.Status="success";
//                                         res.status(200).json(final_data);
                                        
//                                     }
//                                     else
//                                     {
//                                         //const data = `${ShipmentNo}\`^${group_id}`;
//                                         const data = ShipmentNo+"`^"+group_id;
//                                         const encode_data = Buffer.from(data).toString('base64');
//                                         let salt_key= getSalt();
//                                         let base_url='https://itraceit.in//tr';
//                                         let dynamic_url= base_url+"?track="+encode_data+"&KEY="+salt_key;
//                                         //update mongo
//                                         const updateData = {};                                        
//                                         updateData.dynamic_url = dynamic_url;
//                                         updateData.salt_key = salt_key;
//                                         const updateField = { $set: updateData };
//                                         //console.log(updateField);
//                                         const result_update =  mongu.updateCVMongoQuery(conditionsP, updateField, tableP);
//                                         console.log(result_update);
//                                         final_data.Link=dynamic_url;
//                                         final_data.Status="success";
//                                         res.status(200).json(final_data);
//                                     }
                                    
//                                 }
//                                 else{
//                                     final_data.Message="Cannot generate link. Imei is not assigned";
//                                     final_data.Status="fail";
//                                     res.status(200).json(final_data);
//                                 }
                                
//                             }
//                             else{
//                                 final_data.Message="Cannot generate link. GPS is InActive";
//                                 final_data.Status="fail";
//                                 res.status(200).json(final_data);
//                             }

                            
//                         });
//                     }
//                     else{
//                         final_data.Message="Trip not Found";
//                         final_data.Status="fail";
//                         res.status(200).json(final_data);
//                     }
                    

//                 //console.log(result_val);
//                 //process.exit(0);
                
//                 }
//             }
//         }
//         else{
           
//             final_data.Message="Payload Missing";
//             res.status(501).json(final_data);
//         }
//     }catch(error){
//         res.status(500).json({error:error.message});
//     }
// };

////////////////////////////////////////FUNCTIONS ///////////////////////////////////////////

function getSalt() {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/][{};:?.,!@$%*()-_=+|';
    let randString = '';
    const randStringLen = 8;

    for (let i = 0; i < randStringLen; i++) {
        const randChar = charset[Math.floor(Math.random() * charset.length)];
        randString += randChar;
    }

    return randString;
}

function strtotime(value){
    //return Math.floor(Date.parse(value) / 1000);
    return new Date(value).getTime()/ 1000;
   
    
}

function decimalHours(time) {
    const hms = time.split(":");
    if (hms.length == 3) {
        const total = parseInt(hms[0]) + (parseInt(hms[1]) / 60) + (parseInt(hms[2]) / 3600);
        let last = Math.floor(total * 100) / 100;
        const exp_last = last.toString().split('.');

        if (exp_last.length == 2 && parseInt(exp_last[1]) > 59) {
            return parseFloat(total.toFixed(1));
        } else {
            return last;
        }
    } else {
        return false;
    }
}


function getTimeDecimalHr(dechr) {
  const seconds = dechr * 3600;

  const hr = Math.floor(seconds / 3600);
  let mi = Math.floor((seconds - hr * 3600) / 60);
  mi = mi < 10 ? `0${mi}` : mi; // Ensure two digits for minutes

  const final_hours = `${hr}:${mi}`;
  return `${final_hours}:00`;
}

function secondsToDecimalHours(seconds) {
    const hours = seconds / 3600;
    return hours.toFixed(2); // Returns the result rounded to 2 decimal places
}


function secondsToTimeLocal(seconds) {
    // extract hours
    let hours = Math.floor(seconds / (60 * 60));
    if (hours < 10) {
        hours = "0" + hours;
    }

    // extract minutes
    const divisorForMinutes = seconds % (60 * 60);
    let minutes = Math.floor(divisorForMinutes / 60);
    if (minutes < 10) {
        minutes = "0" + minutes;
    }

    // extract the remaining seconds
    const divisorForSeconds = divisorForMinutes % 60;
    seconds = Math.ceil(divisorForSeconds);
    if (seconds < 10) {
        seconds = "0" + seconds;
    }

    return {
        h: hours,
        m: minutes,
        s: seconds
    };
}




function date_formating(datepost) {
    // Create a Day.js object from the input date
    const newDate = dayjs(datepost);

    // Format to m/d/Y H:i
    return newDate.format('MM/DD/YYYY HH:mm');
}

function calculateDistance(latFrom, latTo, lonFrom, lonTo) {
    if (latFrom == '' || latTo == '' || lonFrom == '' || lonTo == '') {
        return 0;
    }

    const lat1 = degreesToRadians(latFrom);
    const lon1 = degreesToRadians(lonFrom);
    
    const lat2 = degreesToRadians(latTo);
    const lon2 = degreesToRadians(lonTo);

    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;

    const temp = Math.pow(Math.sin(deltaLat / 2.0), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(deltaLon / 2.0), 2);
    const distance = 6378.1 * 2 * Math.atan2(Math.sqrt(temp), Math.sqrt(1 - temp));

    return distance;
}

function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

