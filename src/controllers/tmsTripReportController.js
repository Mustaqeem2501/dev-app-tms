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
exports.tmsTripReportFilter = async(req,res) => {
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

exports.tmsTripReport = async(req,res) => {
    try{
        const {AccessToken,Origin,Destination,Route,TripId,DateFrom,DateTo,TripStatus,VehicleNo,DeveloperOption,DeveloperOptionId,ReportType,ForCustomer} = req.body;
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
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
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
                    if( ForCustomer ==""){
                        conditions.group_id=group_id;
                    }
                    else if(ForCustomer && ForCustomer !="" && ForCustomer == "0041")
                    {
                        tableP = 'courier_trip_detail';
                        tableC= 'courier_trip_detail_customer';
                        conditions.group_id=ForCustomer;
                        dbFlag = "0041";
                    }
                    else if(ForCustomer && ForCustomer !="" && ForCustomer == "5691")
                    {
                        tableP = 'dtdc_trip_detail';
                        tableC= 'dtdc_trip_detail_customer';
                        conditions.group_id=ForCustomer;
                        dbFlag = "5691";
                    }else if(ALL){

                    }
                   
                    let transporter_name="";
                    const [TransportersRole] = await db.promise().query("SELECT type_detail_id FROM logistic_role_assignment WHERE  status =? AND user_id = ? ",[1,user_id]);
                    // console.log(TransportersRole[0].type_detail_id);process.exit(0);
                    let transporter_id=0;

                    if(TransportersRole)
                    {
                        let type_detail_id=TransportersRole[0].type_detail_id;
                        const [Transporters] = await db.promise().query("SELECT id,name,code FROM transporters WHERE  status =? AND id= ?",[1,type_detail_id]);
                        if(Transporters.length >0)
                        {
                            transporter_id= Transporters[0].id;
                        }
                        conditions.transporter_id= transporter_id;
                    }
                  
                    if(TripId)
                    {
                        conditions.shipment_no = TripId; 
                    }
                    else
                    {
                        if(DateFrom && DateTo)
                        {
                            conditions.run_date = {
                                $gte: DateFrom + " 00:00:00",  
                                $lte: DateTo + " 23:59:59"
                            };
                        }
                        else
                        {
                            final_data.Message="Payload Start Date and End Date is Missing";
                            res.status(501).json(final_data);
                            return;
                        }

                        if(TripStatus && TripStatus!="")
                        {                            
                            conditions.trip_status= parseInt(TripStatus, 10); // Converts to 42 (integer)
                        }
                        
                        if(VehicleNo)
                        {
                            conditions.vehicle_no=VehicleNo;
                        }
                        if(Origin)
                        {
                            conditions.source_code=Origin;                                           
                        }
                        if(Destination)
                        {
                            conditions.destination_code=Destination;                                               
                        }
                        if(Route)
                        {
                            conditions.route_code=Route;                            
                        }
                        let factid=[];
                    }
                    let resultsA = [];
                    
                    let fieldsP1={};
                    //to do code according to ForCustomer
                    let result_valP_TEMP = []
                    if(dbFlag=="0041"){
                        result_valP_TEMP = await  mongu.getMongoQuery(conditions, fieldsP1, tableP);
                    }else{
                        result_valP_TEMP = await  mongu.getCVMongoQuery(conditions, fieldsP1, tableP);
                    }
        
                    resultsA = resultsA.concat(result_valP_TEMP);
                    let idsa=[];
                    let results = [];
                    let finalCust = [];

                    if(resultsA.length >0)
                    {                          
                        resultsA.forEach(trp => {
                            const m_id= String(trp._id.$oid);  
                            idsa.push(m_id); 
                            let pre_load = { ...trp };

                            const defaultValues = {
                                driver_lastgps: "",
                                driver_sync: "",
                                driver_last_auth: "",
                                total_bag: "",
                                remarks: "",
                                other_c2pc_push: "",
                                other_run_code: "",
                                close_remarks: "",
                                run_code_push_id: "",
                                other_source_code: "",
                                other_source_id: "",
                                transporter_id: "",
                                closur_day: "",
                                distance_km: "",
                                distance_km_2: "",
                                distance_km_3: "",
                                exception_backend: "",
                                close_by: "",
                                transporter_name: "",
                                edit_id: 0,
                                exception_gps_tampered_backend: "",
                                exception_common_backend: "",
                                exception_common_backend_2: "",
                                exception_common_backend_3: "",
                                create_date: "",
                                close_date: "",
                                edit_date_backend: "",
                                last_gps_time: "",
                                c2pc_date: "",
                                route_code_type: "",
                                imei_no_type: "",
                                imei_no2: "",
                                gps_vendor2: "",
                                imei_no_type2: "",
                                imei_no3: "",
                                gps_vendor3: "",
                                imei_no_type3: "",
                                run_code_push_by: ""
                            };

                            // Assign defaults for missing properties
                            Object.keys(defaultValues).forEach(key => {

                                if (pre_load[key] === undefined) {
                                    pre_load[key] = defaultValues[key];
                                }

                                let not_route_flag=0;
                                
                                let route_id = trp?.route_id || "";
                                if(route_id=="" || route_id==0)
                                {
                                    not_route_flag=1;
                                }
                                
                                pre_load['not_route_master']=not_route_flag;
                            });

                            // Add the processed object to the results array
                            results.push(pre_load);
                        });

                        let ids = [...new Set(idsa)];

                        let index_pre_chunk  = [];
                        for (let i = 0; i < ids.length; i += 300) {
                            index_pre_chunk.push(ids.slice(i, i + 300));
                        }

                        console.time("TStart");
                        let fieldsC = {};
                        let sort_order = 1;                    
                        fieldsC = { sort: { sequence_no: sort_order } };
                        // to do code according to ForCustomer
                        // const tableC= 'courier_trip_detail_customer';
                        let resultsCustomer=[];
                        
                        if(TripId || Origin || Destination|| Route || TripStatus || VehicleNo || ReportType)
                        {
                            for(let ids_chunk of index_pre_chunk )
                            {
                                //let resultsCustomer=[];
                                let conditionsC = {
                                    group_id: String(group_id),
                                    status:1
                                };
                                conditionsC.obj ={ m_trip_id: { $in: Object.values(ids_chunk) } };  
                                //to do code according to ForCustomer                      
                                let resultsCustomerTmp  = [];

                                if(dbFlag=="0041"){
                                    resultsCustomerTmp = await  mongu.getMongoQuery(conditionsC, fieldsC, tableC);
                                }else{
                                    resultsCustomerTmp = await  mongu.getCVMongoQuery(conditionsC, fieldsC, tableC);
                                }

                                //console.log(resultsCustomerTmp);
                                resultsCustomer = resultsCustomer.concat(resultsCustomerTmp);
                            }
                            //
                        }
                        else
                        {
                            if(DateFrom && DateTo)
                            {
                                const dateTodayTrip = dayjs(DateFrom).add(0, 'day').format('YYYY-MM-DD');

                                const date1 = new Date(dateTodayTrip);
                                const date2 = new Date(DateTo);

                                const diffTime = Math.abs(date2 - date1); // Difference in milliseconds
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert to days
                                for (let j = 0; j < diffDays; j++) {
                                    const time1 = moment(dateTodayTrip + " 00:00:00")
                                    .add(j, 'days')
                                    .format('YYYY-MM-DD HH:mm:ss');
                                    const loop_date =  time1.split(" ")[0];

                                    let conditionsC = {
                                        group_id: String(group_id),
                                        status:1
                                    };
                                    conditionsC.create_date = {
                                        $gte: loop_date + " 00:00:00",  
                                        $lte: loop_date + " 23:59:59"      
                                    };

                                    //to do code according to ForCustomer
                                    let resultsCustomerTmp = [];

                                    if(dbFlag=="0041"){
                                        resultsCustomerTmp = await  mongu.getMongoQuery(conditionsC, fieldsC, tableC);
                                    }else{
                                        resultsCustomerTmp = await  mongu.getCVMongoQuery(conditionsC, fieldsC, tableC);
                                    }
                                    resultsCustomer = resultsCustomer.concat(resultsCustomerTmp);
                                }
                            }
                        }
                        //console.log(resultsCustomer);
                        console.timeEnd("TStart");
                        if (resultsCustomer.length > 0) {
                            resultsCustomer.forEach(value => {
                                
                                let mtid = String(value.m_trip_id.$oid);
                                // Define all fields with fallback values
                                const f_sequence_no = value.sequence_no ?? "";
                                const f_location_sequence = value.location_sequence ?? "";
                                const f_arrival_time = value.arrival_time ?? "";
                                const f_departure_time = value.departure_time ?? "";
                                const f_geo_arrival_time = value.geo_arrival_time ?? "";
                                const f_geo_departure_time = value.geo_departure_time ?? "";
                                const f_arrival_geocoord = value.arrival_geocoord ?? "";
                                const f_departure_geocoord = value.departure_geocoord ?? "";
                                const f_geo_arrival_geocoord = value.geo_arrival_geocoord ?? "";
                                const f_geo_departure_geocoord = value.geo_departure_geocoord ?? "";
                                const f_pod_status = value.pod_status ?? "";
                                const f_edit_date = value.edit_date ?? "";
                                const f_edit_id = value.edit_id ?? "";
                                const f_gps_departure_time = value.gps_departure_time ?? "";
                                const f_gps_arrival_time = value.gps_arrival_time ?? "";
                                const f_location_geocoord = value.location_geocoord ?? "";
                                const f_location_id = value.location_id ?? "";
                                const f_location_name = value.location_name ?? "";
                                const f_location_code = value.location_code ?? "";
                                const f_schedule_time_arrival = value.schedule_time_arrival ?? "";
                                const f_schedule_time_departure = value.schedule_time_departure ?? "";
                                const f_travel_time = value.travel_time ?? "";
                                const f_halt_duration = value.halt_duration ?? "";
                                const f_c2pc_date_in = value.c2pc_date_in ?? "";
                                const f_c2pc_date_out = value.c2pc_date_out ?? "";
                                const f_gps_edit_time_arrival = value.gps_edit_time_arrival ?? "";
                                const f_gps_edit_time_departure = value.gps_edit_time_departure ?? "";
                                const f_gps_recieved_time_arrival = value.gps_recieved_time_arrival ?? "";
                                const f_gps_recieved_time_departure = value.gps_recieved_time_departure ?? "";
                                const f_app_recieved_time_arrival = value.app_recieved_time_arrival ?? "";
                                const f_app_recieved_time_departure = value.app_recieved_time_departure ?? "";
                                const f_distance_km = value.distance_km ?? "";
                                const f_c2pc_push_in = value.c2pc_push_in ?? "";
                                const f_c2pc_push_out = value.c2pc_push_out ?? "";
                                const f_api_departure_time = value.api_departure_time ?? "";
                                const f_api_arrival_time = value.api_arrival_time ?? "";
                                const f_bay_no = value.bay_no ?? "";
                                const f_gate_in_time = value.gate_in_time ?? "";
                                const f_gate_in_by = value.gate_in_by ?? "";
                                const f_total_shipment_in = value.total_shipment_in ?? "";
                                const f_weight_in = value.weight_in ?? "";
                                const f_remarks_in = value.remarks_in ?? "";
                                const f_gate_out_time = value.gate_out_time ?? "";
                                const f_gate_out_by = value.gate_out_by ?? "";
                                const f_total_shipment_out = value.total_shipment_out ?? "";
                                const f_weight_out = value.weight_out ?? "";
                                const f_remarks_out = value.remarks_out ?? "";
                                const f_bay_no_in = value.bay_no_in ?? "";
                                const f_bay_no_out = value.bay_no_out ?? "";
                                const f_handover = value.handover_time ?? "";

                        
                                // Store the data in finalCust array
                                    //2dArray
                                // Assigning data to the finalCust object
                                if (!finalCust[String(mtid)]) {
                                    finalCust[String(mtid)] = [];
                                }

                                finalCust[String(mtid)].push({
                                    LocationId: f_location_id,
                                    LocationName: f_location_name,
                                    LocationGeocoord: f_location_geocoord,
                                    LocationCode: f_location_code,
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
                                    ArrivalGeoCoord: f_arrival_geocoord,
                                    DepartureGeoCoord: f_departure_geocoord,
                                    GeoArrivalGeoCoord: f_geo_arrival_geocoord,
                                    GeoDepartureGeoCoord: f_geo_departure_geocoord,
                                    PodStatus: f_pod_status,
                                    EditDate: f_edit_date,
                                    EditId: f_edit_id,                                            
                                    DepartureTime: f_departure_time,
                                    DepartureGps: f_gps_departure_time,
                                    ArrivalGps: f_gps_arrival_time,                                      
                                    
                                    DistanceKm: f_distance_km,                                       
                                    ArrivalApi: f_api_arrival_time,
                                    DepartureApi: f_api_departure_time,                                        
                                    RemarksIn: f_remarks_in,
                                    
                                });

                            });
                        }
                        //process.exit(0);
                        
                        //console.log(finalCust);

                    }
                       
                    let user_list=[];
                    //to do code according to ForCustomer
                    const [resultUsrB] = await db.promise().query("SELECT `id`,`username`,`name` FROM user WHERE  `group_id`=? AND `status`=? AND `user_type`=? ",[group_id,1,12]);
                    
                    if(resultUsrB.length >0)
                    { 
                        resultUsrB.forEach(row => {
                            user_list[row.id] = row.username+"("+ name +")";
                        });
                    } 
                    
                    let trip_data=  await tms_courier_trips_report_data(user_list,results,finalCust,ReportType,group_id);
                    
                    final_data.Status="success";
                    final_data.Report=trip_data;
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
    }
};

const tms_courier_trips_report_data = async(user_list,rtrips,finalCust,report_type,group_id) =>
{
    
    //console.log(zone_id_arr);

    const customer_bin={};
    const customer_id_arr={};
    const [LCustomer] = await db.promise().query("SELECT `id`,`code` FROM logistic_customer_master WHERE  `status` =? AND `group_id` = ?",[1,group_id]);
    if(LCustomer.length >0)
    {
        LCustomer.forEach(row => {
            customer_bin[row.code] = row.code;
            customer_id_arr[row.id]= row.code;
        });
    }

  


    let tripData=[];
    //let l=1
    // console.log(rtrips.length);
    // console.log(rtrips);process.exit(0);
    rtrips.forEach(event => {
        //console.log("loop="+l);
        //l=l+1;
        let sys_rem = 0;
        let id = String(event._id.$oid);
        let rnd_dt_lstP = "";
    
        if (event.run_date !== "") {
            rnd_dt_lstP = event.run_date.split(" ");
        }
    
        let actual_arv_lstP = "";
        let actual_arv_lstP_by = "";
        let actual_arv_coord_lstP = "";
        let scv_tP = "";
        let scd_t="";
        let ac_halt_f = "";
        let halt_diff_time_count = 0;
        let halt_diff_time_count_sch = 0;
        let scTTtaken = "";
        let flag_qr = 0;
        let is_qr = 0;
        let is_qr_not = 0;
        let is_gps = 0;
        let delay_in_arv_lstPHr = "";
        let customer_geocoord = "";
        let customer_name = "";
        let customer_label = "";
        let customer_visited = "";
        let actual_dep_lstP = "";
        let actual_dep_lstP_by = "";
        let actual_dep_coord_lstP = "";
        let delay_in_dep_lstP = "";
        let scTTmapped = "-";
        let scTTdelay ="-";
    
        // Sorting finalCust[id] by SequenceNo
        if (finalCust[id]) {
            //finalCust[id.trim()].sort((a, b) => a.SequenceNo - b.SequenceNo);
            finalCust[id].sort((a, b) => {
                return a.SequenceNo - b.SequenceNo;
            });
        }
       
        let val_DepartureGeo ="";
        let val_ArrivalGeo="";
        let val_DepartureGps="";
        let val_ArrivalGps="";
        let val_DepartureApi="";
        let val_ArrivalApi="";

    
        let ServerGPSReceivedIn_A = "";
        let ServerGPSProcessedIn_A = "";
        let PushTimeIn_A = "";
        let ServerGPSReceivedOut_A = "";
        let ServerGPSProcessedOut_A = "";
        let PushTimeOut_A = "";
    
        // New code for bd
        let branch_handovertime = "-";
        let gate_outtime = "-";
        let gate_intime = "-";
        let gps_ata = "-";
        let gps_atd = "-";
        let acceptance_time = "-";
        let bay_no = "-";
        let shipment_count = "-";
        let weight = "-";
        let bay_no_in =  "-";
        let shipment_count_out = "-";
        let weight_out = "-";
    
        let branch_handovertime_dest = "-";
        let gate_outtime_dest = "-";
        let gate_intime_dest = "-";
        let gps_ata_dest = "-";
        let gps_atd_dest = "-";
        let acceptance_time_dest = "-";
        let bay_no_dest = "-";
        let shipment_count_dest = "-";
        let weight_dest = "-";
        let delay_in_arv_lstP = "";
        let bay_no_in_dest =  "-";
        let bay_no_out_dest =  "-";
        let bay_no_int =  "-";
        let bay_no_out =  "-";
        let shipment_count_out_dest=  "-";
        let weight_out_dest =  "-";
         let scd=0;
         let acd = 0;
         let acv = 0;
         //console.log(finalCust);process.exit(0);
         if(finalCust[id])
         {
            finalCust[id].forEach((value) => {
                if(value.LocationSequenceNo==0)
                {
                    val_DepartureGeo=value.DepartureGeo;
                    val_DepartureGps=value.DepartureGps;
                    val_DepartureApi=value.DepartureApi;

                    ServerGPSReceivedOut_A=value.ServerGPSReceivedOut; //gps_recieved_time_departure
                    ServerGPSProcessedOut_A=value.ServerProcessedOut; //gps_edit_time_departure
                    PushTimeOut_A=value.PushTimeOut; //c2pc_date_out
                    if(value.ServerProcessedOut=="") {
                        ServerGPSProcessedOut_A=value.ServerProcessedAppOut;//app process time
                    } 
                }
    
    
                if(value.LocationSequenceNo==2) {

                    val_ArrivalGeo=value.ArrivalGeo;
                    val_ArrivalGps=value.ArrivalGps;
                    val_ArrivalApi=value.ArrivalApi;


                    ServerGPSReceivedIn_A=value.ServerGPSReceivedIn; //gps_recieved_time_arrival
                    ServerGPSProcessedIn_A=value.ServerProcessedIn;  //gps_edit_time_arrival 
                    PushTimeIn_A=value.PushTimeIn; //c2pc_date_in
                    if(value.ServerProcessedIn=="") {
                        ServerGPSProcessedIn_A=value.ServerProcessedAppIn;//app process time
                    }
    
                    if(event.trip_status==2) {
                        value.ArrivalGeo="";
                    }
                }
    
                customer_geocoord += `${value.LocationGeocoord}|`;
                customer_name += `${value.LocationCode}\`~`;
    
                let label="M0";
                if(value.LocationSequenceNo!="" && value.SequenceNo!="")
                {
                    if(value.LocationSequenceNo==0)
                    {
                        label="M0";
                    }                                    
                    else
                    {
                        label="M"+(parseInt(value.SequenceNo)-1);
                    }
                }
                customer_label +=label+`~`;
                
                if (value.PodStatus == "1") {
                    customer_visited += "1:";
                } else {
                    customer_visited += "0:";
                    //customer_visited += "1:";
                }
    
                let clsb=event.close_by;
                let clsby="";
                if(value.EditId!=null && value.EditId!="") {
                    clsby=value.EditId;
                }
    
                let ac_arival_f="";
                let ac_departure_f="";
                if(value.ArrivalGps!="")
                {
                    ac_arival_f=value.ArrivalGps;
                    is_gps = 1;
                }
                else if(value.ArrivalGeo!="")
                {
                    ac_arival_f==value.ArrivalGeo;
                }
                else if(value.ArrivalApi!="")
                {
                    ac_arival_f=value.ArrivalApi;
                }
              
                
                // Departure processing
                if(value.DepartureGps!="")
                {
                    ac_departure_f=value.DepartureGps;
                }
                else if(value.DepartureGeo!="")
                {
                    ac_departure_f==value.DepartureGeo;
                }
                else if(value.DepartureApi!="")
                {
                    ac_departure_f=value.DepartureApi;
                }
              
    
                // Calculate halt time differences
                if (
                    ac_arival_f != "" &&
                    ac_departure_f != "" &&
                    value.LocationSequenceNo != "0" &&
                    value.LocationSequenceNo != "2"
                ) {
                    const halt_diff_time = 
                       strtotime(ac_departure_f) - strtotime(ac_arival_f);
                        halt_diff_time_count += halt_diff_time;
    
                    if (value.ScheduleTimeArrival != "" && value.ScheduleTimeDeparture != "") {
                        const halt_diff_time_sch = 
                            strtotime(value.ScheduleTimeDeparture) - strtotime(value.ScheduleTimeArrival);
                            halt_diff_time_count_sch += halt_diff_time_sch;
                    }
                }
                let arrival_time_tmpg="";
               // console.log(event);process.exit(0);
                if (value.LocationSequenceNo == 2  && value.SequenceNo!=1) {
                   
                    //actual_arv_lstP ,actual_arv_lstP_by,actual_arv_coord_lstP
                    //--updated code on 2002025---//
                    if(value.ArrivalGps!="")
                    {
                        actual_arv_lstP=value.ArrivalGps;
                        actual_arv_lstP_by="Geofence";
                        actual_arv_coord_lstP=value.LocationGeocoord;  //because it is done at location
                    }
                    else if(value.ArrivalGeo!="")
                    {
                        actual_arv_lstP=value.ArrivalGeo;
                        actual_arv_lstP_by ="Manual";                        
                        actual_arv_coord_lstP = value.GeoArrivalGeoCoord;
                    }
                    else if(value.ArrivalApi!="")
                    {
                        actual_arv_lstP = value.ArrivalApi;
                        actual_arv_lstP_by = event.imei_no ? "API" : "Manual";
                        actual_arv_coord_lstP = "";
                    }
                 
                    
                
                    if (actual_arv_lstP) {
                        acv = strtotime(actual_arv_lstP);
                
                        let scv_t =  event.schedule_arrival;
                
                        if (scv_t) {
                            const scv = strtotime(scv_t);
                            if (acv >= scv) {
                                const diff_time = acv - scv;
                                const hms1 = secondsToTimeLocal(diff_time);
                                delay_in_arv_lstP = `${hms1.h}:${hms1.m}:${hms1.s}`;
                                const diff_time_tmp = delay_in_arv_lstP.split(":");
                                delay_in_arv_lstPHr = `${diff_time_tmp[0]}.${diff_time_tmp[1]}`;
                            }
                        } else {
                            delay_in_arv_lstP = "-";
                        }
                    }
                   // console.log(actual_arv_lstP);
                }
                
                if (value.LocationSequenceNo == 0 && value.SequenceNo==1) {
                    //console.log(value);process.exit(0);
                    if(value.DepartureGps!="")
                    {
                        actual_dep_lstP = value.DepartureGps;
                        actual_dep_lstP_by = "Geofence";
                        actual_dep_coord_lstP = value.LocationGeocoord; 
                    }
                    else if(value.DepartureGeo!="")
                    {
                        actual_dep_lstP = value.DepartureGeo;
                        actual_dep_lstP_by = "Manual";
                        actual_dep_coord_lstP = value.GeoDepartureGeoCoord;
                    }
                    else if(value.DepartureApi!="")
                    {
                        actual_dep_lstP = value.DepartureApi;
                        actual_dep_lstP_by = event.imei_no ? "API" : "Manual";
                        actual_dep_coord_lstP = "";
                    }
                
                    if(actual_dep_lstP)
                    {
                        acd = strtotime(actual_dep_lstP);
                    }
                    else
                    {
                        acd = strtotime(event.run_date);
                    }
                    if (actual_dep_lstP && event.schedule_departure) {
                        
                        scd = strtotime(event.schedule_departure);
                
                        if (acd >= scd) {
                            let diff_time = acd - scd;
                            let hms1 = secondsToTimeLocal(diff_time);
                            delay_in_dep_lstP = `${hms1.h}:${hms1.m}:${hms1.s}`;
                            
                        }
                    } else if (event.run_date && event.schedule_departure) {
                       
                         scd = strtotime(event.schedule_departure);
                
                        if (acd >= scd) {
                            let diff_time = acd - scd;
                            let hms1 = secondsToTimeLocal(diff_time);
                            delay_in_dep_lstP = `${hms1.h}:${hms1.m}:${hms1.s}`;
                            
                        }
                    }
                }
                
                if (value.LocationSequenceNo == 0) {
                     scd_t = value.ScheduleTimeDeparture || event.schedule_departure;
                     scd = strtotime(scd_t);
                
                    // New code for DTDC
                    branch_handovertime = value.HandOverTime;
                     gps_ata = value.ArrivalGps;
                
                     acceptance_time = ""; // Placeholder for future logic if needed
                     bay_no = value.BayNo || "-";
                
                     shipment_count = value.TotalShipmentIn || "-";
                     weight = value.WeightIn || "-";
                     
                     bay_no_out = value.BayNoOut || "-";
                     bay_no_in = value.BayNoIn || "-";
                     shipment_count_out = value.TotalShipmentOut || "-";
                     weight_out = value.WeightOut || "-";
                
                    // New code for DTDC continued
                     gate_outtime = value.GateOutTime || "-";
                     gate_intime = value.GateInTime || "-";
                     gps_atd = value.DepartureGps || "-";
                }
    
                
                if (value.LocationSequenceNo == 2) {
                     scv_tP = value.ScheduleTimeArrival && value.ScheduleTimeArrival !== "" 
                        ? value.ScheduleTimeArrival 
                        : event.schedule_arrival;
                
                    /*if (event.shipment_method!="LTL Pick-Up" && event.shipment_method!="BA Pick-Up" && event.shipment_method!="Express Pick-Up" && event.shipment_method!="CP Pick-Up" && event.shipment_method!="LTL Delivery" && event.shipment_method!="LTL PUD" &&  event.shipment_method!="BA Delivery" && event.shipment_method!="Express Delivery" && event.shipment_method!="CP Delivery"
                    ) {
                       // scv_tP = "";
                    }*/
                
                    // New code for dtdc
                     branch_handovertime_dest = value.ArrivalGeo;
                
                     gps_ata_dest = value.ArrivalGps;
                     bay_no_dest = value.BayNo;
                
                     shipment_count_dest = value.TotalShipmentIn || "-";
                     weight_dest = value.WeightIn || "-";
                
                     bay_no_in_dest = value.BayNoIn || "-";
                     bay_no_out_dest = value.BayNoOut || "-";
                
                     shipment_count_out_dest = value.TotalShipmentOut || "-";
                     weight_out_dest = value.WeightOut || "-";
                
                     gate_outtime_dest = value.GateOutTime || "-";
                     gate_intime_dest = value.GateInTime || "-";
                
                     gps_atd_dest = value.DepartureGps || "-";
                    // End of dtdc
                }
                //console.log(value)
            if(scv_tP && scd )
            {
                
                const scv = scv_tP ? strtotime(scv_tP) : null; // Convert to timestamp in seconds
                //scTTmapped = "-";
                let scTT = "";
    
                if (scv >= scd && scd && scv) {
                    scTT = scv - scd;
                    const hms1 = secondsToTimeLocal(scTT);
                    scTTmapped = `${hms1.h}:${hms1.m}:${hms1.s}`; // bug 1
                }
                //console.log(scv_tP,scv,scd,scTTmapped);process.exit(0);
    
                let scTTk = "";
                //scTTtaken = "-";
               // console.log(acd,acv)
                if (acd !== 0 && acv !== 0 && acv >= acd && acv ) {
                    scTTk = acv - acd;
                    const hms1 = secondsToTimeLocal(scTTk);
                    scTTtaken = `${hms1.h}:${hms1.m}:${hms1.s}`;
                }
    
                scTTdelay = "-";
                if (
                    scTTtaken !== "-" &&
                    scTTmapped !== "-" &&
                    scTTk &&
                    scTT &&
                    scTTk >= scTT
                ) {
                    const scTTdelay1 = scTTk - scTT;
                    const hms1 = secondsToTimeLocal(scTTdelay1);
                    scTTdelay = `${hms1.h}:${hms1.m}:${hms1.s}`;
                }
    
            }  
            
            let scTTk = "";
            //scTTtaken = "-";
           // console.log(acd,acv)
            if (acd !== 0 && acv !== 0 && acv >= acd && acv ) {
                scTTk = acv - acd;
                const hms1 = secondsToTimeLocal(scTTk);
                scTTtaken = `${hms1.h}:${hms1.m}:${hms1.s}`;
            }
    
                //////
    
            });
         }
        
        if (customer_geocoord && customer_geocoord != "") {
            customer_geocoord = customer_geocoord.trim().slice(0, -1);
        }
        
        if (customer_name && customer_name != "") {
            customer_name = customer_name.trim().slice(0, -2);
        }

        if(customer_label && customer_label!=""){
            customer_label =customer_label.slice(0,-1);
        }
        
        if (customer_visited && customer_visited != "") {
            customer_visited = customer_visited.trim().slice(0, -1);
        }

        let driver_exp = "";
        let sup_exception = "";
        let status_lstP = "";

        if (actual_arv_lstP_by && actual_arv_lstP_by != "") {
            status_lstP = actual_arv_lstP_by;
        } else if (actual_dep_lstP_by && actual_dep_lstP_by != "") {
            status_lstP = actual_dep_lstP_by;
        } else {
            status_lstP = "Manual";
        }

        if (is_gps == 0 && event.imei_no != "") {
            // driver_exp += " GPS Down."; // temporarily commented
        }

        if (event.is_vehicle_master == "0") {
            sup_exception += " Vehicle NA in Vehicle Master";
        }

        if (event.route_id == "0" &&
          
            event.shipment_method !== "Pick Up" && event.shipment_method !== "Delivery" &&  event.shipment_method !== "Pick Up and Delivery" 
            //event.shipment_method!="LTL Pick-Up" && event.shipment_method!="BA Pick-Up" && event.shipment_method!="Express Pick-Up" && event.shipment_method!="CP Pick-Up" && event.shipment_method!="LTL Delivery" && event.shipment_method!="LTL PUD" &&  event.shipment_method!="BA Delivery" && event.shipment_method!="Express Delivery" && event.shipment_method!="CP Delivery"
        ) {
            sup_exception += " Route NA in Network Module";
            sup_exception += " Fleet NA in Network Module";
        } else if (event.route_id != "0" && event.route_code_type == "1") {
            sup_exception += " Route NA in Network Module";
            sup_exception += " Fleet NA in Network Module";
        } else if (   String(event.not_fleet_master)== "1" &&
            event.shipment_method !== "Pick Up" && event.shipment_method !== "Delivery" &&  event.shipment_method !== "Pick Up and Delivery" 
            //event.shipment_method!="LTL Pick-Up" && event.shipment_method!="BA Pick-Up" && event.shipment_method!="Express Pick-Up" && event.shipment_method!="CP Pick-Up" && event.shipment_method!="LTL Delivery" && event.shipment_method!="LTL PUD" &&  event.shipment_method!="BA Delivery" && event.shipment_method!="Express Delivery" && event.shipment_method!="CP Delivery"
            ) {
            sup_exception += " Fleet NA in Network Module";
        }

        if (event.imei_no == "") {
            driver_exp += " No GPS";
        }
        if (event.destination_id == "0") {
            sup_exception += " Destination NA in Network Master";
        }
        if(event.source_id =="0") {
            sup_exception += " Origin NA in Network Master";
        }

        let row = {};
        let trip_status_smr = "";

        if (event.trip_status == 1) {
            trip_status_smr = "Running";
        }
        else if (event.trip_status == 2) {
            trip_status_smr = "Cancelled";
        }
         else if (event.trip_status == 0 ) {
            trip_status_smr = `Close (${status_lstP})`;
        } 
        else if (event.trip_status == 3) {
            trip_status_smr = `Rejected (${status_lstP})`;
        }

     
        
        row.Source = event.source_code;
        
        row.Destination = event.destination_code;
        row.RouteCode = event.route_code;
        row.RouteName = event.route_name;
        
        row.ShipmentNo = event.shipment_no;
       
        //row.RunDate=date_formating(event.run_date);
        row.RunDate=event.run_date;
        row.VehicleNo = event.vehicle_no;

        //----------------------state,Branch,Area code to be required to done later ----------
        let source_id=event.source_id;
        
       

        row.Driver = event.driver_name;
        row.DriverMobile = event.driver_mobile;
        row.Transporter = event.transporter_name;

        
        row.GPSATD =val_DepartureGps;
        row.GPSATA =val_ArrivalGps;
       
       
        

        row.STD = event.schedule_departure;        
        row.ATD = actual_dep_lstP;
        if(actual_dep_lstP=="") {
          
            row.ATD = event.run_date;
        }
        row.DelayDeparture= delay_in_dep_lstP;
       
        row.STA = event.schedule_arrival;
        let close_date="-";
        if(actual_arv_lstP!="") {
            if(event.close_remarks=="Forcefull_closure1")
            {
                //row.ATA = "-";
                row.ATA = actual_arv_lstP;
                close_date=event.close_date;
            }
            else
            {
                row.ATA = actual_arv_lstP;
                close_date=actual_arv_lstP;
            }
        }
        else
        {
            row.ATA = "-";
        }
        row.TTMapped = scTTmapped;
        row.TTTaken = scTTtaken;
        row.DelayArrival = delay_in_arv_lstP;
        row.DelayTT = scTTdelay;

        if (event.imei_no !== "") {
            row.TrackHistory1 = {
              Id: event._id.$oid,
              Imei: event.imei_no,
              Vno: event.vehicle_no,
              RnDt: event.run_date,
             
              CustGeo: customer_geocoord,
              CustName: customer_name,
              CustLabel: customer_label,
              CloseDt: close_date,
              ShpNo: event.shipment_no,
              SrcCode: event.source_code,
              DestCode: event.destination_code,
             
              CustVisited: customer_visited,
            };
            row.Imei1 = event.imei_no;
          } else {
            row.TrackHistory1 = "NA";
            row.Imei1 = event.imei_no;
          }
          
          if (event.imei_no2 !== "") {
            row.TrackHistory2 = {
              Id: event._id.$oid,
              Imei: event.imei_no2,
              Vno: event.vehicle_no,
              RnDt: event.run_date,
             
              CustGeo: customer_geocoord,
              CustName: customer_name,
              CustLabel: customer_label,
              CloseDt: close_date,
              ShpNo: event.shipment_no,
              SrcCode: event.source_code,
              DestCode: event.destination_code,
              
              CustVisited: customer_visited,
            };
            row.Imei2 = event.imei_no2;
          } else {
            row.TrackHistory2 = "NA";
            row.Imei2 = "";
          }
          
          if (event.imei_no3 !== "") {
            row.TrackHistory3 = {
              Id: event._id.$oid,
              Imei: event.imei_no3,
              Vno: event.vehicle_no,
              RnDt: event.run_date,
              
              CustGeo: customer_geocoord,
              CustName: customer_name,
              CustLabel: customer_label,
              CloseDt: close_date,
              ShpNo: event.shipment_no,
              SrcCode: event.source_code,
              DestCode: event.destination_code,
             
              CustVisited: customer_visited,
            };
            row.Imei3 = event.imei_no3;
          } else {
            row.TrackHistory3 = "NA";
            row.Imei3 = "";
          }
          


       
        row.DistanceKm1 =event.distance_km;
        row.DistanceKm2 = event.distance_km_2;
        row.DistanceKm3 = event.distance_km_3;

        let exp_new = "";

        // Check if `exception_gps_tampered_backend` exists and `gps_vendor_name` is "Secutrak"
        if (event.exception_gps_tampered_backend != "" && event.gps_vendor_name== "Secutrak") {
            exp_new += event.exception_gps_tampered_backend + ",";
        }

        // Check for No Device or No GPS Device exceptions
        if (event.exception_common_backend == "No Device" || event.exception_common_backend== "No GPS Device") {
            event.exception_common_backend = "GPS NA ";
            event.gps_vendor_name = "";
        }

        // Append exception if exists
        if (event.exception_common_backend !== "") {
            exp_new += event.exception_common_backend + ",";
        }

        // Check if imei_no is empty
        if (event.imei_no== "") {
            exp_new = "GPS NA ";
            event.gps_vendor_name = "";
        }

        // Remove trailing comma if any
        if (exp_new !== "") {
            exp_new = exp_new.slice(0, -1);  // equivalent to PHP's substr to remove last character
        } else {
            // Check for imei_no again and set final value
            if (event.imei_no== "") {
                exp_new = "GPS NA ";
                event.gps_vendor_name = "";
            } else {
                exp_new = "GPS Active";
            }
        }
        row.GPSException1 =exp_new;

        let exp_new2 = "";

        // Check for exceptions related to "No Device" or "No fixed Device"
        if (event.exception_common_backend_2 == "No Device" || event.exception_common_backend_2 == "No fixed Device") {
            event.exception_common_backend_2 = "GPS NA "; 
            event.gps_vendor2 = "";
        }

        // Append exception if exists
        if (event.exception_common_backend_2 != "") {
            exp_new2 += event.exception_common_backend_2 + ",";
        }

        // Check if imei_no2 is empty
        if (event.imei_no2 == "") {
            exp_new2 = "GPS NA "; 
            event.gps_vendor2  = "";
        }

        // Remove trailing comma if any
        if (exp_new2 != "") {
            exp_new2 = exp_new2.slice(0, -1);  // equivalent to PHP's substr to remove last character
        } else {
            // Check for imei_no2 again and set final value
            if (event.imei_no2 == "") {
                exp_new2 = "GPS NA "; 
                event.gps_vendor2  = "";
            } else {
                exp_new2 = "GPS Active";
            }
        }
        row.GPSException2 = exp_new2; 

        let exp_new3 = "";

        // Check for exceptions related to "No Device" or "No portable Device"
        if (event.exception_common_backend_3 == "No Device" || event.exception_common_backend_3 == "No portable Device") {
            event.exception_common_backend_3  = "GPS NA "; 
            event.gps_vendor3  = "";
        }

        // Append exception if exists
        if (event.exception_common_backend_3  !== "") {
            exp_new3 += event.exception_common_backend_3 + ",";
        }

        // Check if imei_no3 is empty
        if (event.imei_no3 == "") {
            exp_new3 = "GPS NA "; 
            event.gps_vendor3  = "";  // Set GPS vendor blank when GPS is NA
        }

        // Remove trailing comma if any
        if (exp_new3 !== "") {
            exp_new3 = exp_new3.slice(0, -1);  // equivalent to PHP's substr to remove last character
        } else {
            // Check for imei_no3 again and set final value
            if (event.imei_no3 == "") {
                exp_new3 = "GPS NA "; 
                event.gps_vendor3 = "";
            } else {
                exp_new3 = "GPS Active";
            }
        }

        row.GPSException3 = exp_new3;



        // Check trip type and add the appropriate value to the row array
        if (event.trip_type == 2) {
            row.SupervisorException =sup_exception;
        } else {
            row.SupervisorException="-";
        }

        // Check trip status and driver acceptance to determine the trip status message
        if (event.trip_status == 1 ) {
            row.TripStatus ="Running";
        } 
        else if(event.trip_status ==2 ) {
             row.TripStatus = "Cancelled";
        }
        else if( event.trip_status ==3 ) {
             row.TripStatus = "Rejected ("+status_lstP+")";
        } 
        else if(event.trip_status ==0  ) {

            if(event.close_remarks =="Forcefull_closure1") {
                row.TripStatus = "Close (Forcefull)";
            } 
            else if( event.close_remarks =="BackendClosure") {
                row.TripStatus = "Close (BackEnd)";
            } else if(event.close_remarks =="Geofence_closure1") {
                row.TripStatus = "Close (Geofence-1)";
            }
            else if(event.close_remarks =="Geofence_closure2") {
                row.TripStatus = "Close (Geofence-2)";
            }
            else if(event.close_remarks =="supervisor close") {
                row.TripStatus = "Close (Manual)";
            } else if(event.close_remarks=="Web Closure") {
                row.TripStatus = "Close (Web)";
            } else if(event.close_remarks =="API_closure1") {
                row.TripStatus = "Close (GNMS ATA)";
            } 
            else if(event.close_remarks =="Polygon_closure1") {
                row.TripStatus = "Close (Geofence)";
            }
            else if(event['imei_no']=="") {
                row.TripStatus = "Close (Manual)";
            } else {
                row.TripStatus = "Close ("+status_lstP+")";
            }
        }
        else if(event.trip_status ==0  ) {
            if( event.close_remarks =="Forcefull_closure1") {
                row.TripStatus = "Close (Forcefull)";
            } else if(event.close_remarks =="BackendClosure") {
                row.TripStatus = "Close (BackEnd)";
            } else if(event.close_remarks =="Geofence_closure1") {
                row.TripStatus = "Close (Geofence-1)";
            }
            else if( event.close_remarks =="Geofence_closure2") {
                row.TripStatus = "Close (Geofence-2)";
            }
            else if(event.close_remarks =="supervisor close") {
                row.TripStatus = "Close (Manual)";
            } else if(event.close_remarks =="Web Closure") {
                row.TripStatus = "Close (Web)";
            } else if(event.close_remarks =="API_closure1") {
                row.TripStatus = "Close (GNMS ATA)";
            } 
            else if( event.close_remarks =="Polygon_closure1") {
                row.TripStatus = "Close (Geofence)";
            }
            else {
                row.TripStatus = "Close ("+status_lstP+")";
            }
        } 

        let closeby_string = "-,";
        if (event.trip_status == 0) {
            if (event.close_remarks == "Geofence_closure1") {
                row.CloseBy ="Close (Geofence-1)";
                closeby_string = "Close (Geofence-1)";
            } else if (event.close_remarks == "Geofence_closure2") {
                row.CloseBy="Close (Geofence-2)";
                closeby_string = "Close (Geofence-2)";
            } else if (event.close_remarks == "Polygon_closure1") {
                row.CloseBy="Close (Geofence)";
                closeby_string = "Close (Geofence)";
            } else if (event.close_remarks== "Forcefull_closure1") {
                row.CloseBy="Close (Forcefull)";
                closeby_string = "Close (Forcefull)";
            } else if (event.close_remarks == "BackendClosure") {
                row.CloseBy="Close (Backend)";
                closeby_string = "Close (Backend)";
            } else if (event.close_remarks == "supervisor close") {
                if (event.close_by  !== "") {
                    row.CloseBy=`"${event.close_by }"`;
                } else {
                    row.CloseBy="Close (Manual)";
                }
                closeby_string = "Close (Manual)";
            } else if (event.close_remarks == "Web Closure") {
                row.CloseBy="Close (Web)";
                closeby_string = "Close (Web)";
            } else if (event.close_remarks == "API_closure1") {
                row.CloseBy="Close (API)";
                closeby_string = "Close (API)";
            } else {
                if (event.close_by  == null || event.close_by == "") {
                    if (event.remarks != null && event.remarks  != "") {
                        row.CloseBy=event.remarks;
                        closeby_string = `"${event.remarks}",`;
                    } else {
                        row.CloseBy=event.close_remarks;
                        closeby_string = `"${event.close_remarks}",`;
                    }
                } else {
                    row.CloseBy=event?.close_by || "Backend_closure";
                    closeby_string = `"${event?.close_by || "Backend_closure"}",`;
                }
            }
        } else {
            if (event.close_by  !== "") {
                row.CloseBy=event.close_by ;
                closeby_string = `"${event.close_by }",`;
            } else {
                row.CloseBy="";
                closeby_string = ",";
            }
        }

        if(event.close_remarks =="Forcefull_closure1")
        {
            row.CloseDate=event.close_date;
        }
        if(event.close_date=="")
        {
            row.CloseDate=event.close_date;
        }
       
        if(event.trip_type==2 && user_list[event.create_id]!="") {
            row.CreateBy = user_list[event.create_id];
        } else {
            row.CreateBy = user_list[event.create_id];
        }
        if(event.closer_imei_type==1)
        {
            row.CloseByDevice="Primary";
        }
        else if(event.closer_imei_type==2)
        {
            row.CloseByDevice="Secoundary";
        }
        else if(event.closer_imei_type==3)
        {
            row.CloseByDevice="Tertiary";
        }
        else 
        {
            row.CloseByDevice ="-";
        }

        row.Bag = event.total_bag; 
        row.Remarks = event.remarks;
        
        let gpsv1=event.gps_vendor_name;
        let gpsv2=event.gps_vendor2;
        let gpsv3=event.gps_vendor3;

        let gpsvt1=event.imei_no_type ;
        let gpsvt2=event.imei_no_type2 ;
        let gpsvt3=event.imei_no_type3 ;

        let normal_vendor="";
        let portableelock_vendor="";
        let fixedlock_vendor="";
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
        normal_vendor=gpsv1;
        portableelock_vendor=gpsv3;
        fixedlock_vendor=gpsv2;
        /*
        if(Vendor && Vendor=="2") //fo ilgic
        {
            if(flag_not_ilgic==0)
            {            
                return;
            }
        }
        if(Vendor && Vendor=="3") //fo third party
        {
            if(flag_not_ilgic==1)
            {            
                return;
            }
        }*/
        
        
        row.GPSVendorType1=normal_vendor;
        row.GPSVendorType2=fixedlock_vendor;
        row.GPSVendorType3=portableelock_vendor;

        if(gpsvt1==13)
        {
            row.PortableLockVendor=event.gps_vendor_name;
        }
        else if(gpsvt2==13)
        {
            row.PortableLockVendor=event.gps_vendor2;
        }
        else if(gpsvt3==13)
        {
            row.PortableLockVendor=event.gps_vendor3;
        }
        else
        {
            row.PortableLockVendor="-";
        }

       
        
        row.CreateDate = event.create_date;
        row.CloseDate = event.close_date;
       
        row.Id=event._id.$oid;
      
        row.Detail=[];
        //console.log(row);process.exit(0);
        if(report_type==1)
        {
            tripData.push(row); 
        }
        
        if(report_type==2)//details
        {
            let branch_handovertime = "-";
            let gate_outtime = "-";
            let gate_intime = "-";
            let gps_ata = "-";
            let gps_atd = "-";
            let acceptance_time = "-";
            let bay_no = "-";
            let shipment_count = "-";
            let weight = "-";
            let bay_no_in =  "-";
            let shipment_count_out = "-";
            let weight_out="-";
            let LocationWise= [];
            let LocationWiseDetail= [];
            let LocationVisited = [];
           
            if( finalCust[id])
            {
                finalCust[id].forEach((value) => {
                    // Assuming 'LocationWise', 'LocationWiseDetail', 'LocationVisited', 'value', and 'event' are pre-defined.
    
                    LocationWise.push(value.LocationCode);
    
                    if (!LocationWiseDetail[value.LocationCode]) {
                        LocationWiseDetail[value.LocationCode] = [];
                    }
                    LocationWiseDetail[value.LocationCode].push(value);
    
                    if (value.LocationCode == event.source_code) {
                        LocationVisited.push(value.LocationCode);
                    }
    
                    if (value.LocationCode == event.destination_code) {
                        return; // Equivalent to `continue` in PHP when inside a loop
                    }
    
                    if(value.LocationSequenceNo==2) {
                          
                        if(event.trip_status==2) {
                            value.ArrivalGeo="";
                        }
                    }
                    if(value.LocationCode!=event.source_code) 
                    {
                        branch_handovertime = value.DepartureGeo;
    
                        if(value.ArrivalGeo)
                        {
                            acceptance_time=value.ArrivalGeo;
                        }
                        else
                        {
                            acceptance_time=value.ArrivalGps;
                        }
                        gate_outtime = value.GateOutTime;
                        gate_intime = value.GateInTime;                            
                        gps_atd= value.DepartureGps;                         
                        //$gate_outtime="";
                        //$gate_intime="";
                        gps_ata=value.ArrivalGps;
                        //$gps_atd="";
    
                        bay_no=value.BayNo;
                        shipment_count= value.TotalShipmentIn;
                        if(shipment_count=="")
                        {
                            shipment_count="-";
                        }
    
                        weight= value.WeightIn;
                        if(weight=="")
                        {
                            weight="-";
                        }
                        bay_no_in=value.BayNoIn;
                        if(bay_no_in=="")
                        {
    
                            bay_no_in="-";
                        }
                        bay_no_out=value.BayNoOut;
                        if(bay_no_out=="")
                        {
                            bay_no_out="-";
                        }
                        shipment_count_out= value.TotalShipmentOut;
                        if(shipment_count_out=="")
                        {
                            shipment_count_out="-";
                        }
                        weight_out= value.WeightOut;
                        if(weight_out=="")
                        {
                            weight_out="-";
                        } 
                        /// 
                        let rowc = {};
                        
                       
                        rowc.Source = event.source_code;
                        rowc.Destination = value.LocationCode;
                       
                        rowc.RouteCode = event.route_code;
                        rowc.RouteName = event.route_name;
                   
                        rowc.ShipmentNo = event.shipment_no;  
                        
                        
                        let keypos = 0;
                        let keypos_flag = 0;
                        let c2pc_datetime = "-";
                        
    
    
                        // Determine 'rundate_Dt1'
                        let rundate_Dt1;
                        if (keypos_flag == 0) {
                            rundate_Dt1 = date_formating(event.run_date);
                        } else {
                            if (event.run_code_edit_date == "") {
                                rundate_Dt1 = date_formating(event.run_date);
                            } else {
                                const other_run_code_edit_date = event.run_code_edit_date.split(",");
                                if (other_run_code_edit_date[keypos]) {
                                    rundate_Dt1 = date_formating(other_run_code_edit_date[keypos]);
                                } else {
                                    rundate_Dt1 = date_formating(event.run_date);
                                }
                            }
                        }
    
                        // Determine 'createBy'
                        let createBy;
                        if (keypos_flag == 0) {
                            createBy = user_list[event.create_id];
                        } else {
                            if (event.run_code_push_id == "") {
                                createBy = user_list[event.create_id];
                            } else {
                                const other_run_code_push_id = event.run_code_push_id.split(",");
                                const other_run_code_push_by = event.run_code_push_by.split(",");
                                if (other_run_code_push_by[keypos]) {
                                    createBy = `${other_run_code_push_id[keypos]}(${other_run_code_push_by[keypos]})`;
                                } else {
                                    createBy = user_list[event.create_id];
                                }
                            }
                        }
    
                        rowc.RunDate=rundate_Dt1;
                        rowc.VehicleNo = event.vehicle_no;
                       
                      
                        rowc.Driver = event.driver_name;
                        rowc.DriverMobile = event.driver_mobile;
                        rowc.Transporter = event.transporter_name;
                       
                        rowc.GPSATD =val_DepartureGps;
                        rowc.GPSATA =val_ArrivalGps;
                      
                      
                        rowc.STD = event.schedule_departure;        
                        rowc.ATD = actual_dep_lstP;
                        if(actual_dep_lstP=="") {                       
                            rowc.ATD = event.run_date;
                        }
                        rowc.DelayDeparture= delay_in_dep_lstP;
                        
                        if (value.ScheduleTimeArrival != "" && value.ScheduleTimeArrival != null) {
                            
                            row.STA=value.ScheduleTimeArrival;
                        } else {
                            if (value.LocationCode == event.destination_code) {
                                const sch_arr_time_Dt1 = date_formating(event.schedule_arrival);
                                row.STA=event.schedule_arrival;
                            } else {
                                row.STA="-";
                            }
                        }
    
    
                        let actual_arv_lst = "-";
                        let actual_arv_lst_by = "";
                        let actual_arv_coord_lst = "";
                        const clsb = event.close_by;
                        let clsby = value.EditId != null && value.EditId != "" ? value.EditId : "";
    
                        let arrival_time_tmpg1 = "";
                        
                        if(value.ArrivalGps!="")
                        {
                            actual_arv_lst=value.ArrivalGps;
                            actual_arv_lst_by="Geofence";
                            actual_arv_coord_lst=value.LocationGeocoord;  //because it is done at location
                        }
                        else if(value.ArrivalGeo!="")
                        {
                            actual_arv_lst=value.ArrivalGeo;
                            actual_arv_lst_by ="Manual";                        
                            actual_arv_coord_lst = value.GeoArrivalGeoCoord;
                        }
                        else if(value.ArrivalApi!="")
                        {
                            actual_arv_lst = value.ArrivalApi;
                            actual_arv_lst_by = event.imei_no ? "API" : "Manual";
                            actual_arv_coord_lst = "";
                        }
                        
                       
                        // Calculate delays and times
                        let delay_in_arv_lst = "-";
                        let acv = actual_arv_lst != "-" && actual_arv_lst != null ? strtotime(actual_arv_lst) : 0;
                        if (acv) {
                            const scv_t = value.ScheduleTimeArrival;
                            if (scv_t) {
                                const scv = strtotime(scv_t);
                                if (acv >= scv) {
                                    const diff_time = acv - scv;
                                    const hms1 = secondsToTimeLocal(diff_time);
                                    delay_in_arv_lst = `${hms1.h}:${hms1.m}:${hms1.s}`;
                                }
                            }
                        }
    
                        const scd_t = event.schedule_departure;
                        const scd = strtotime(scd_t);
                        const scv_t = value.ScheduleTimeArrival;
                        const scv = strtotime(scv_t);
    
                        let scTTmapped = "-";
                        if (scv >= scd && scv_t && scd_t) {
                            const scTT = scv - scd;
                            const hms1 = secondsToTimeLocal(scTT);
                            scTTmapped = `${hms1.h}:${hms1.m}:${hms1.s}`;
                        }
    
                        let scTTtaken = "-";
                        if (acv && scd && acv >= scd) {
                            const scTTk = acv - scd;
                            const hms1 = secondsToTimeLocal(scTTk);
                            scTTtaken = `${hms1.h}:${hms1.m}:${hms1.s}`;
                        }
    
                        let scTTdelay = "-";
                        if (scTTtaken != "-" && scTTmapped != "-" && acv >= scd) {
                            const scTTdelay1 = acv - scd;
                            const hms1 = secondsToTimeLocal(scTTdelay1);
                            scTTdelay = `${hms1.h}:${hms1.m}:${hms1.s}`;
                        }
    
                        // Add final value to row
                        if (actual_arv_lst != "-" && actual_arv_lst != null) {
                            const actual_arv_lst1 = date_formating(actual_arv_lst);
                            rowc.ATA=actual_arv_lst1;
                        } else {
                            rowc.ATA= "-";
                        }
    
                        rowc.TTMapped = scTTmapped;
                        rowc.TTTaken = scTTtaken;
                        rowc.DelayArrival = delay_in_arv_lst;
                        rowc.DelayTT = scTTdelay;
    
                        let ac_arival="";
                        let ac_departure="";
                        let ac_halt="";
                        if(value.ArrivalGps!="")
                        {
                            ac_arival=value.ArrivalGps;
                            is_gps = 1;
                        }
                        else if(value.ArrivalGeo!="")
                        {
                            ac_arival==value.ArrivalGeo;
                        }
                        else if(value.ArrivalApi!="")
                        {
                            ac_arival=value.ArrivalApi;
                        }
                       
                        
                        // Departure processing
                        if(value.DepartureGps!="")
                        {
                            ac_departure=value.DepartureGps;
                        }
                        else if(value.DepartureGeo!="")
                        {
                            ac_departure==value.DepartureGeo;
                        }
                        else if(value.DepartureApi!="")
                        {
                            ac_departure=value.DepartureApi;
                        }
            
                      
                       
    
                        if (event.distance_km && value.DistanceKm) {
                            const od2 = Math.abs(event.distance_km - value.DistanceKm);
                            rowc.DistanceKm1=od2.toFixed(2);
                          } else {
                            rowc.DistanceKm1="-";
                          }
                        
                          // Calculate absolute difference for distance_km_2
                          if (event.distance_km_2 && value.DistanceKm) {
                            const od2 = Math.abs(event.distance_km_2 - value.DistanceKm);
                            rowc.DistanceKm2=od2.toFixed(2);
                          } else {
                            rowc.DistanceKm2="-";
                          }
                        
                          // Calculate absolute difference for distance_km_3
                          if (event.distance_km_3 && value.DistanceKm) {
                            const od2 = Math.abs(event.distance_km_3 - value.DistanceKm);
                            rowc.DistanceKm3=od2.toFixed(2);
                          } else {
                            rowc.DistanceKm3="-";
                          } 
    
                          let exp_new = "";
    
                        // Check if `exception_gps_tampered_backend` exists and `gps_vendor_name` is "Secutrak"
                        if (event.exception_gps_tampered_backend != "" && event.gps_vendor_name== "Secutrak") {
                            exp_new += event.exception_gps_tampered_backend + ",";
                        }
    
                        
                        // Check for No Device or No GPS Device exceptions
                        if (event.exception_common_backend == "No Device" || event.exception_common_backend== "No GPS Device") {
                            event.exception_common_backend = "GPS NA ";
                            event.gps_vendor_name = "";
                        }
    
                        // Append exception if exists
                        if (event.exception_common_backend !== "") {
                            exp_new += event.exception_common_backend + ",";
                        }
    
                        // Check if imei_no is empty
                        if (event.imei_no== "") {
                            exp_new = "GPS NA ";
                            event.gps_vendor_name = "";
                        }
    
                        // Remove trailing comma if any
                        if (exp_new !== "") {
                            exp_new = exp_new.slice(0, -1);  // equivalent to PHP's substr to remove last character
                        } else {
                            // Check for imei_no again and set final value
                            if (event.imei_no== "") {
                                exp_new = "GPS NA ";
                                event.gps_vendor_name = "";
                            } else {
                                exp_new = "GPS Active";
                            }
                        }
                        rowc.GPSException1 =exp_new;
                        let exp_new2 = "";
    
                        // Check for exceptions related to "No Device" or "No fixed Device"
                        if (event.exception_common_backend_2 == "No Device" || event.exception_common_backend_2 == "No fixed Device") {
                            event.exception_common_backend_2 = "GPS NA "; 
                            event.gps_vendor2 = "";
                        }
    
                        // Append exception if exists
                        if (event.exception_common_backend_2 != "") {
                            exp_new2 += event.exception_common_backend_2 + ",";
                        }
    
                        // Check if imei_no2 is empty
                        if (event.imei_no2 == "") {
                            exp_new2 = "GPS NA "; 
                            event.gps_vendor2  = "";
                        }
    
                        // Remove trailing comma if any
                        if (exp_new2 != "") {
                            exp_new2 = exp_new2.slice(0, -1);  // equivalent to PHP's substr to remove last character
                        } else {
                            // Check for imei_no2 again and set final value
                            if (event.imei_no2 == "") {
                                exp_new2 = "GPS NA "; 
                                event.gps_vendor2  = "";
                            } else {
                                exp_new2 = "GPS Active";
                            }
                        }
                        rowc.GPSException2 = exp_new2; 
    
                        let exp_new3 = "";
                       
                        // Check for exceptions related to "No Device" or "No portable Device"
                        if (event.exception_common_backend_3 == "No Device" || event.exception_common_backend_3 == "No portable Device") {
                            event.exception_common_backend_3  = "GPS NA "; 
                            event.gps_vendor3  = "";
                        }
    
                        // Append exception if exists
                        if (event.exception_common_backend_3  !== "") {
                            exp_new3 += event.exception_common_backend_3 + ",";
                        }
    
                        // Check if imei_no3 is empty
                        if (event.imei_no3 == "") {
                            exp_new3 = "GPS NA "; 
                            event.gps_vendor3  = "";  // Set GPS vendor blank when GPS is NA
                        }
    
                        // Remove trailing comma if any
                        if (exp_new3 !== "") {
                            exp_new3 = exp_new3.slice(0, -1);  // equivalent to PHP's substr to remove last character
                        } else {
                            // Check for imei_no3 again and set final value
                            if (event.imei_no3 == "") {
                                exp_new3 = "GPS NA "; 
                                event.gps_vendor3 = "";
                            } else {
                                exp_new3 = "GPS Active";
                            }
                        }
                        
                        rowc.GPSException3 = exp_new3;       
                         // Check trip type and add the appropriate value to the row array
                        if (event.trip_type == 2) {
                            rowc.SupervisorException =sup_exception;
                            
                        } else {
                            rowc.SupervisorException="-";
                        }
    
                        if (value.ArrivalGps && value.ArrivalGps !== "") {
                            rowc.TripStatus="Close (Geofence)";
                        } else if (value.ArrivalGeo && value.ArrivalGeo !== "") {
                            rowc.TripStatus="Close (Manual)";
                        } else if (value.ArrivalApi && value.ArrivalApi !== "") {
                            rowc.TripStatus="Close (GNMS ATA)";
                        } else {
                            if (event.trip_status == 2) {
                                rowc.TripStatus="Cancelled";
                            } else {
                                rowc.TripStatus="ATANA";
                            }
                        }
    
                        if(value.EditId)
                        {
                            rowc.CloseBy = user_list[value.EditId]; 
                        }
                        else{
                            if (value.ArrivalGps && value.ArrivalGps !== "") {
                                rowc.CloseBy="Close (Geofence)";
                            } else if (value.ArrivalGeo && value.ArrivalGeo !== "") {
                                rowc.CloseBy="Close (Manual)";
                            } else if (value.ArrivalApi && value.ArrivalApi !== "") {
                                rowc.CloseBy="Close (GNMS ATA)";
                            } else {
                                // Code modified
                                if (value.ArrivalGps && value.ArrivalGps !== "") {
                                    rowc.CloseBy="Close (Geofence)";
                                } else if (value.ArrivalGeo && value.ArrivalGeo !== "") {
                                    rowc.CloseBy="Close (Manual)";
                                } else if (value.ArrivalApi && value.ArrivalApi !== "") {
                                    rowc.CloseBy="Close (API)";
                                } else {
                                    rowc.CloseBy="Close (BackEnd)";
                                }
                            }
                        }


                        if(event.closer_imei_type==1)
                        {
                            rowc.CloseByDevice="Primary";
                        }
                        else if(event.closer_imei_type==2)
                        {
                            rowc.CloseByDevice="Secoundary";
                        }
                        else if(event.closer_imei_type==3)
                        {
                            rowc.CloseByDevice="Tertiary";
                        }
                        else 
                        {
                            rowc.CloseByDevice ="-";
                        }   
                        rowc.CreateBy =createBy;
                        rowc.Bag ="-"; 
                        rowc.Remarks = "-";
    
                        
                        
                        rowc.GPSVendorType1=normal_vendor;
                        rowc.GPSVendorType2=fixedlock_vendor;
                        rowc.GPSVendorType3=portableelock_vendor;
                       
                        if(gpsvt1==13)
                            {
                                rowc.PortableLockVendor=event.gps_vendor_name;
                            }
                            else if(gpsvt2==13)
                            {
                                rowc.PortableLockVendor=event.gps_vendor2;
                            }
                            else if(gpsvt3==13)
                            {
                                rowc.PortableLockVendor=event.gps_vendor3;
                            }
                            else
                            {
                                rowc.PortableLockVendor="-";
                            }

                       
    
                        rowc.CreateDate = "-";
                        rowc.CloseDate = "-";
                       
                        rowc.Id=event._id.$oid;
                        
                        
                        //rowc.RouteCategory = feeder_parent_bin[event.trip_type];
                        
                        
                        row.Detail.push(rowc);
                        //console.log(event.shipment_no);
                    }
    
    
                    //
                    
                });
            }
            
            if(LocationWise.length>2)
            {
                LocationWise.forEach((LcoW) => {
                    if (LocationVisited.includes(LcoW)) {
                        return;
                    }
                    finalCust[id].forEach((value) => {
                        if (LocationVisited.includes(value.LocationCode)) {
                            return;
                        }
                        if (value.LocationCode == LcoW) {
                            LocationVisited.push(value.LocationCode);
                        }

                        if(value.LocationSequenceNo==2) {
                      
                            if(event.trip_status==2) {
                                value.ArrivalGeo="";
                            }
                        }
                        if (value.LocationCode !== LocationWiseDetail[LcoW][0].LocationCode) 
                        {

                            branch_handovertime = value.DepartureGeo;

                            if(value.ArrivalGeo)
                            {
                                acceptance_time=value.ArrivalGeo;
                            }
                            else
                            {
                                acceptance_time=value.ArrivalGps;
                            }
                            gate_outtime = value.GateOutTime;
                            gate_intime = value.GateInTime;                            
                            gps_atd= value.DepartureGps;                         
                            //$gate_outtime="";
                            //$gate_intime="";
                            gps_ata=value.ArrivalGps;
                            //$gps_atd="";

                            bay_no=value.BayNo;
                            shipment_count= value.TotalShipmentIn;
                            if(shipment_count=="")
                            {
                                shipment_count="-";
                            }

                            weight= value.WeightIn;
                            if(weight=="")
                            {
                                weight="-";
                            }
                            bay_no_in=value.BayNoIn;
                            if(bay_no_in=="")
                            {

                                bay_no_in="-";
                            }
                            bay_no_out=value.BayNoOut;
                            if(bay_no_out=="")
                            {
                                bay_no_out="-";
                            }
                            shipment_count_out= value.TotalShipmentOut;
                            if(shipment_count_out=="")
                            {
                                shipment_count_out="-";
                            }
                            weight_out= value.WeightOut;
                            if(weight_out=="")
                            {
                                weight_out="-";
                            } 
                            /// 
                            let esrcode =LocationWiseDetail[LcoW][0].LocationCode;
                            let rowc = {};
                            
                            
                            rowc.Source = LocationWiseDetail[LcoW][0].LocationCode;
                            rowc.Destination = value.LocationCode;
                            
                            rowc.RouteName = event.route_name;
                           
                            rowc.ShipmentNo = event.shipment_no;  

                            let keypos = 0;
                            let keypos_flag = 0;
                            let c2pc_datetime = "-";
                            

                       
                            // Determine 'rundate_Dt1'
                            let rundate_Dt1;
                            if (keypos_flag == 0) {
                                rundate_Dt1 = date_formating(event.run_date);
                            } else {
                                if (event.run_code_edit_date == "") {
                                    rundate_Dt1 = date_formating(event.run_date);
                                } else {
                                    const other_run_code_edit_date = event.run_code_edit_date.split(",");
                                    if (other_run_code_edit_date[keypos]) {
                                        rundate_Dt1 = date_formating(other_run_code_edit_date[keypos]);
                                    } else {
                                        rundate_Dt1 = date_formating(event.run_date);
                                    }
                                }
                            }

                            // Determine 'createBy'
                            let createBy;
                            if (keypos_flag == 0) {
                                createBy = user_list[event.create_id];
                            } else {
                                if (event.run_code_push_id == "") {
                                    createBy = user_list[event.create_id];
                                } else {
                                    const other_run_code_push_id = event.run_code_push_id.split(",");
                                    const other_run_code_push_by = event.run_code_push_by.split(",");
                                    if (other_run_code_push_by[keypos]) {
                                        createBy = `${other_run_code_push_id[keypos]}(${other_run_code_push_by[keypos]})`;
                                    } else {
                                        createBy = user_list[event.create_id];
                                    }
                                }
                            }

                            rowc.RunDate=rundate_Dt1;
                            rowc.VehicleNo = event.vehicle_no;
                             //----------------------state,Branch,Area code to be required to done later ----------
                           
                            rowc.Driver = event.driver_name;
                            rowc.DriverMobile = event.driver_mobile;
                            rowc.Transporter = event.transporter_name;
                           
                            rowc.GPSATD =val_DepartureGps;
                            rowc.GPSATA =val_ArrivalGps;
                         
                            rowc.STD = LocationWiseDetail[LcoW][0].ScheduleTimeDeparture;      

                            let actual_dep_lst="";
                            let actual_arv_dep_by="";
                            let actual_dep_coord_lst="";
                            let dep_time_tmpgP="";

                            
                            let actual_dep_lst_by = "";

                            if(LocationWiseDetail[LcoW][0].DepartureGps!="")
                            {
                                actual_dep_lst = LocationWiseDetail[LcoW][0].DepartureGps;
                                actual_dep_lst_by = "Geofence";
                                actual_dep_coord_lst = LocationWiseDetail[LcoW][0].LocationGeocoord; 
                            }
                            else if(LocationWiseDetail[LcoW][0].DepartureGeo!="")
                            {
                                actual_dep_lst = LocationWiseDetail[LcoW][0].DepartureGeo;
                                actual_dep_lst_by = "Manual";
                                actual_dep_coord_lst = LocationWiseDetail[LcoW][0].GeoDepartureGeoCoord;
                            }
                            else if(LocationWiseDetail[LcoW][0].DepartureApi!="")
                            {
                                actual_dep_lst = LocationWiseDetail[LcoW][0].DepartureApi;
                                actual_dep_lst_by = event.imei_no ? "API" : "Manual";
                                actual_dep_coord_lst = "";
                            }
                            ////
                         

                            let delay_in_dep_lst = "";
                            let acd = 0;
                            if (actual_dep_lst) {
                            acd = strtotime(actual_dep_lst);
                            if (
                                LocationWiseDetail[LcoW][0].ScheduleTimeDeparture &&
                                LocationWiseDetail[LcoW][0].ScheduleTimeDeparture !== null
                            ) {
                                const scd_t = LocationWiseDetail[LcoW][0].ScheduleTimeDeparture;
                                const scd = strtotime(scd_t);
                                if (acd >= scd) {
                                const diff_time = acd - scd;
                                const hms1 = secondsToTimeLocal(diff_time);
                                delay_in_dep_lst = `${hms1.h}:${hms1.m}:${hms1.s}`;
                                }
                            }
                            }

                            if (!actual_dep_lst) {
                            actual_dep_lst_by = "";
                            }

                            //const actual_dep_lstc1 = actual_dep_lst ? dateFormatting(actual_dep_lst.trim()) : "-";
                            rowc.ATD=actual_dep_lst;
                            rowc.DelayDeparture=delay_in_dep_lst;
                            
                            if (LocationWiseDetail[LcoW][0].ScheduleTimeArrival != "" && LocationWiseDetail[LcoW][0].ScheduleTimeArrival != null) {
                        
                                row.STA=LocationWiseDetail[LcoW][0].ScheduleTimeArrival;
                            } else {
                                row.STA="-";
                            }
                            
                            let actual_arv_lst = "-";
                            let actual_arv_lst_by = "";
                            let actual_arv_coord_lst = "";
                            const clsb = event.close_by;
                            let clsby = value.EditId != null && value.EditId != "" ? value.EditId : "";

                            let arrival_time_tmpg1 = "";
                            if(value.ArrivalGps!="")
                            {
                                actual_arv_lst=value.ArrivalGps;
                                actual_arv_lst_by="Geofence";
                                actual_arv_coord_lst=value.LocationGeocoord;  //because it is done at location
                            }
                            else if(value.ArrivalGeo!="")
                            {
                                actual_arv_lst=value.ArrivalGeo;
                                actual_arv_lst_by ="Manual";                        
                                actual_arv_coord_lst = value.GeoArrivalGeoCoord;
                            }
                            else if(value.ArrivalApi!="")
                            {
                                actual_arv_lst = value.ArrivalApi;
                                actual_arv_lst_by = event.imei_no ? "API" : "Manual";
                                actual_arv_coord_lst = "";
                            }
            
                   
                   
                    // Calculate delays and times
                    let delay_in_arv_lst = "-";
                    let acv = actual_arv_lst != "-" && actual_arv_lst != null ? strtotime(actual_arv_lst) : 0;
                    if (acv) {
                        let scv_t = value.ScheduleTimeArrival;
                        if (scv_t) {
                            const scv =strtotime(scv_t);
                            if (acv >= scv) {
                                const diff_time = acv - scv;
                                const hms1 = secondsToTimeLocal(diff_time);
                                delay_in_arv_lst = `${hms1.h}:${hms1.m}:${hms1.s}`;
                            }
                        }
                    }

                    scd_t = LocationWiseDetail[LcoW][0].ScheduleTimeDeparture ;
                    scd = strtotime(scd_t);
                    let scv_t = value.ScheduleTimeArrival;
                    scv = strtotime(scv_t);

                    let scTTmapped = "-";
                    if (scv >= scd && scv_t && scd_t) {
                        const scTT = scv - scd;
                        const hms1 = secondsToTimeLocal(scTT);
                        scTTmapped = `${hms1.h}:${hms1.m}:${hms1.s}`;
                    }

                    let scTTtaken = "-";
                    if (acv && scd && acv >= scd) {
                        const scTTk = acv - scd;
                        const hms1 = secondsToTimeLocal(scTTk);
                        scTTtaken = `${hms1.h}:${hms1.m}:${hms1.s}`;
                    }

                    let scTTdelay = "-";
                    if (scTTtaken != "-" && scTTmapped != "-" && acv >= scd) {
                        const scTTdelay1 = acv - scd;
                        const hms1 = secondsToTimeLocal(scTTdelay1);
                        scTTdelay = `${hms1.h}:${hms1.m}:${hms1.s}`;
                    }

                     // Add final value to row
                     if (actual_arv_lst != "-" && actual_arv_lst != null) {
                        const actual_arv_lst1 = date_formating(actual_arv_lst);
                        rowc.ATA=actual_arv_lst1;
                    } else {
                        rowc.ATA= "-";
                    }

                    rowc.TTMapped = scTTmapped;
                    rowc.TTTaken = scTTtaken;
                    rowc.DelayArrival = delay_in_arv_lst;
                    rowc.DelayTT = scTTdelay;
                    let ac_arival="";
                    let ac_departure="";
                    let ac_halt="";
                    if(value.ArrivalGps!="")
                    {
                        ac_arival=value.ArrivalGps;
                        is_gps = 1;
                    }
                    else if(value.ArrivalGeo!="")
                    {
                        ac_arival==value.ArrivalGeo;
                    }
                    else if(value.ArrivalApi!="")
                    {
                        ac_arival=value.ArrivalApi;
                    }
                  
                    // Departure processing
                    if(value.DepartureGps!="")
                    {
                        ac_departure=value.DepartureGps;
                    }
                    else if(value.DepartureGeo!="")
                    {
                        ac_departure==value.DepartureGeo;
                    }
                    else if(value.DepartureApi!="")
                    {
                        ac_departure=value.DepartureApi;
                    }
                   
                    
                   

                    if (event.distance_km && LocationWiseDetail[LcoW][0].DistanceKm) {
                        const od2 = Math.abs(event.distance_km - LocationWiseDetail[LcoW][0].DistanceKm);
                        rowc.DistanceKm1=od2.toFixed(2);
                      } else {
                        rowc.DistanceKm1="-";
                      }
                    
                      // Calculate absolute difference for distance_km_2
                      if (event.distance_km_2 && LocationWiseDetail[LcoW][0].DistanceKm) {
                        const od2 = Math.abs(event.distance_km_2 - LocationWiseDetail[LcoW][0].DistanceKm);
                        rowc.DistanceKm2=od2.toFixed(2);
                      } else {
                        rowc.DistanceKm2="-";
                      }
                    
                      // Calculate absolute difference for distance_km_3
                      if (event.distance_km_3 && LocationWiseDetail[LcoW][0].DistanceKm) {
                        const od2 = Math.abs(event.distance_km_3 - LocationWiseDetail[LcoW][0].DistanceKm);
                        rowc.DistanceKm3=od2.toFixed(2);
                      } else {
                        rowc.DistanceKm3="-";
                      } 

                      let exp_new = "";

                      // Check if `exception_gps_tampered_backend` exists and `gps_vendor_name` is "Secutrak"
                      if (event.exception_gps_tampered_backend != "" && event.gps_vendor_name== "Secutrak") {
                          exp_new += event.exception_gps_tampered_backend + ",";
                      }
  
                      
                      // Check for No Device or No GPS Device exceptions
                      if (event.exception_common_backend == "No Device" || event.exception_common_backend== "No GPS Device") {
                          event.exception_common_backend = "GPS NA ";
                          event.gps_vendor_name = "";
                      }
  
                      // Append exception if exists
                      if (event.exception_common_backend !== "") {
                          exp_new += event.exception_common_backend + ",";
                      }
  
                      // Check if imei_no is empty
                      if (event.imei_no== "") {
                          exp_new = "GPS NA ";
                          event.gps_vendor_name = "";
                      }
  
                      // Remove trailing comma if any
                      if (exp_new !== "") {
                          exp_new = exp_new.slice(0, -1);  // equivalent to PHP's substr to remove last character
                      } else {
                          // Check for imei_no again and set final value
                          if (event.imei_no== "") {
                              exp_new = "GPS NA ";
                              event.gps_vendor_name = "";
                          } else {
                              exp_new = "GPS Active";
                          }
                      }
                      rowc.GPSException1 =exp_new;
                      let exp_new2 = "";
  
                      // Check for exceptions related to "No Device" or "No fixed Device"
                      if (event.exception_common_backend_2 == "No Device" || event.exception_common_backend_2 == "No fixed Device") {
                          event.exception_common_backend_2 = "GPS NA "; 
                          event.gps_vendor2 = "";
                      }
  
                      // Append exception if exists
                      if (event.exception_common_backend_2 != "") {
                          exp_new2 += event.exception_common_backend_2 + ",";
                      }
  
                      // Check if imei_no2 is empty
                      if (event.imei_no2 == "") {
                          exp_new2 = "GPS NA "; 
                          event.gps_vendor2  = "";
                      }
  
                      // Remove trailing comma if any
                      if (exp_new2 != "") {
                          exp_new2 = exp_new2.slice(0, -1);  // equivalent to PHP's substr to remove last character
                      } else {
                          // Check for imei_no2 again and set final value
                          if (event.imei_no2 == "") {
                              exp_new2 = "GPS NA "; 
                              event.gps_vendor2  = "";
                          } else {
                              exp_new2 = "GPS Active";
                          }
                      }
                      rowc.GPSException2 = exp_new2; 
  
                      let exp_new3 = "";
  
                      // Check for exceptions related to "No Device" or "No portable Device"
                      if (event.exception_common_backend_3 == "No Device" || event.exception_common_backend_3 == "No portable Device") {
                          event.exception_common_backend_3  = "GPS NA "; 
                          event.gps_vendor3  = "";
                      }
  
                      // Append exception if exists
                      if (event.exception_common_backend_3  !== "") {
                          exp_new3 += event.exception_common_backend_3 + ",";
                      }
  
                      // Check if imei_no3 is empty
                      if (event.imei_no3 == "") {
                          exp_new3 = "GPS NA "; 
                          event.gps_vendor3  = "";  // Set GPS vendor blank when GPS is NA
                      }
  
                      // Remove trailing comma if any
                      if (exp_new3 !== "") {
                          exp_new3 = exp_new3.slice(0, -1);  // equivalent to PHP's substr to remove last character
                      } else {
                          // Check for imei_no3 again and set final value
                          if (event.imei_no3 == "") {
                              exp_new3 = "GPS NA "; 
                              event.gps_vendor3 = "";
                          } else {
                              exp_new3 = "GPS Active";
                          }
                      }
  
                      rowc.GPSException3 = exp_new3;       
                       // Check trip type and add the appropriate value to the row array
                      if (event.trip_type == 2) {
                          rowc.SupervisorException =sup_exception;
                      } else {
                          rowc.SupervisorException="-";
                      }
  
                      if (value.ArrivalGps && value.ArrivalGps !== "") {
                          rowc.TripStatus="Close (Geofence)";
                      } else if (value.ArrivalGeo && value.ArrivalGeo !== "") {
                          rowc.TripStatus="Close (Manual)";
                      } else if (value.ArrivalApi && value.ArrivalApi !== "") {
                          rowc.TripStatus="Close (GNMS ATA)";
                      } else {
                          if (event.trip_status === 2) {
                              rowc.TripStatus="Cancelled";
                          } else {
                              rowc.TripStatus="ATANA";
                          }
                      }
  
                      if(value.EditId)
                      {
                          rowc.CloseBy = user_list[value.EditId]; 
                      }
                      else{
                          if (value.ArrivalGps && value.ArrivalGps !== "") {
                              rowc.CloseBy="Close (Geofence)";
                          } else if (value.ArrivalGeo && value.ArrivalGeo !== "") {
                              rowc.CloseBy="Close (Manual)";
                          } else if (value.ArrivalApi && value.ArrivalApi !== "") {
                              rowc.CloseBy="Close (GNMS ATA)";
                          } else {
                              // Code modified
                              if (value.ArrivalGps && value.ArrivalGps !== "") {
                                  rowc.CloseBy="Close (Geofence)";
                              } else if (value.ArrivalGeo && value.ArrivalGeo !== "") {
                                  rowc.CloseBy="Close (Manual)";
                              } else if (value.ArrivalApi && value.ArrivalApi !== "") {
                                  rowc.CloseBy="Close (API)";
                              } else {
                                  rowc.CloseBy="Close (BackEnd)";
                              }
                          }
                      }
                      rowc.CreateBy =createBy;
                      if(event.closer_imei_type==1)
                    {
                        rowc.CloseByDevice="Primary";
                    }
                    else if(event.closer_imei_type==2)
                    {
                        rowc.CloseByDevice="Secoundary";
                    }
                    else if(event.closer_imei_type==3)
                    {
                        rowc.CloseByDevice="Tertiary";
                    }
                    else 
                    {
                        rowc.CloseByDevice ="-";
                    }   
                      rowc.Bag ="-"; 
                      rowc.Remarks = "-";
  
                      
                      
                      rowc.GPSVendorType1=normal_vendor;
                      rowc.GPSVendorType2=fixedlock_vendor;
                      rowc.GPSVendorType3=portableelock_vendor;

                      if(gpsvt1==13)
                        {
                            rowc.PortableLockVendor=event.gps_vendor_name;
                        }
                        else if(gpsvt2==13)
                        {
                            rowc.PortableLockVendor=event.gps_vendor2;
                        }
                        else if(gpsvt3==13)
                        {
                            rowc.PortableLockVendor=event.gps_vendor3;
                        }
                        else
                        {
                            rowc.PortableLockVendor="-";
                        }
                      
                     
  
                      rowc.CreateDate = "-";
                      rowc.CloseDate = "-";
                     
          
                      rowc.Id=event._id.$oid;
                      //rowc.RouteCategory = feeder_parent_bin[event.trip_type];





                            row.Detail.push(rowc);

                        }



                        
                    });
                    
                });
                

            }

            tripData.push(row); 
            //////
        } 

    });
    
    //console.log(tripData);process.exit(0);

    return tripData;
};


exports.tmsTripCustomerDetails =async(req,res) =>{
    try{
        const {AccessToken,MTripId,DeveloperOption,DeveloperOptionId} =req.body;
        let final_data = {};
        final_data.Status="fail";
        let response ={};
        if(AccessToken!=null && MTripId){
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
                //to do code
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
                
                const index_pre  = [];
                let finalCust = [];
                let fieldsC = {};
                let sort_order = 1;
                let resultsCustomer=[];
                fieldsC = { sort: { sequence_no: sort_order } };
                const tableC= 'courier_trip_detail_customer';
                index_pre.push(MTripId);
                let conditionsC = {
                    group_id: String(group_id)                                   
                    
                };
                conditionsC.obj ={ m_trip_id: { $in: Object.values(index_pre) } };  
                                       
                resultsCustomer = await mongu.getMongoQuery(conditionsC, fieldsC, tableC);
                if(resultsCustomer)
                {
                    let flag_lookst=1;
                    let flag_current_station=0;
                    let consec_travel_time_sec=0;
                    resultsCustomer.forEach(value => {

                        let end_station_sta="";
                        let current_station_code="";
                        let current_station_sch_dept="";
                        let current_station_geocoord="";
                        let next_station_code="";
                        let next_station_geocoord="";
                        let current_station_sch_arrival="";


                        let $=t = value.travel_time;
                        if (t != "" && t != null) {
                            const te = t.split(".");
                            if (te[0] != undefined && te[1] != undefined) {
                                const tes1 = parseInt(te[0]) * 3600;
                                const tes2 = parseInt(te[1]) * 60;
                                const tes = tes1 + tes2;
                                consec_travel_time_sec = tes;
                            }
                        }
                        
                        let mtid = String(value.m_trip_id.$oid);
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

                        let f_arrival_geocoord="";
                        if(value.arrival_geocoord)
                        {
                            f_arrival_geocoord=value.arrival_geocoord;
                        }

                        let f_departure_geocoord="";
                        if(value.departure_geocoord)
                        {
                            f_departure_geocoord=value.departure_geocoord;
                        }

                        let f_geo_arrival_geocoord="";
                        if(value.geo_arrival_geocoord)
                        {
                            f_geo_arrival_geocoord=value.geo_arrival_geocoord;
                        }

                        let f_geo_departure_geocoord="";
                        if(value.geo_departure_geocoord)
                        {
                            f_geo_departure_geocoord=value.geo_departure_geocoord;
                        }

                        let f_gps_departure_geocoord="";
                        if(value.gps_departure_geocoord)
                        {
                            f_gps_departure_geocoord=value.gps_departure_geocoord;
                        }
                        let f_gps_arrival_geocoord="";
                        if(value.gps_arrival_geocoord)
                        {
                            f_gps_arrival_geocoord=value.gps_arrival_geocoord;
                        }
                        let f_pod_status="";
                        if(value.pod_status)
                        {
                            f_pod_status=value.pod_status;
                        }
                        let f_edit_date="";
                        if(value.edit_date)
                        {
                            f_edit_date=value.edit_date;
                        }

                        let f_edit_id="";
                        if(value.edit_id)
                        {
                            f_edit_id=value.edit_id;
                        }

                        let f_location_geocoord="";
                        if(value.location_geocoord)
                        {
                            f_location_geocoord=value.location_geocoord;
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

                        let current_station_reached_time="";
                        if(value.arrival_time)
                        {
                            current_station_reached_time=value.arrival_time;
                        }

                        if(value.departure_time)
                        {
                            current_station_reached_time=value.departure_time;
                        }

                        if(value.geo_arrival_time)
                        {
                            current_station_reached_time=value.geo_arrival_time;
                        }

                        if(value.geo_departure_time)
                        {
                            current_station_reached_time=value.geo_departure_time;
                        }

                        if(value.gps_arrival_time)
                        {
                            current_station_reached_time=value.gps_arrival_time;
                        }

                        if(value.gps_departure_time)
                        {
                            current_station_reached_time=value.gps_departure_time;
                        }

                        if(value.gps_departure_time)
                        {
                            current_station_reached_time=value.gps_departure_time;
                        }

                        let f_radius="";
                        if(value.radius)
                        {
                            f_radius=value.radius;
                        }

                        
                        if (current_station_reached_time != "" && flag_lookst == 1) {
                            flag_current_station = 1;
                            current_station_geocoord = f_location_geocoord;
                            current_station_code = value.location_code;
                            current_station_sch_dept = value.schedule_time_departure;
                        } else {
                            if (flag_lookst == 1) {
                                if (flag_current_station == 0 && value.location_sequence == 0) {
                                    current_station_geocoord = f_location_geocoord;
                                    current_station_code = value.location_code;
                                    current_station_sch_dept = value.schedule_time_departure;
                                }
                                if (value.location_sequence != 0) {
                                    if (flag_current_station == 0) {
                                        current_station_geocoord = f_location_geocoord;
                                        current_station_code = value.location_code;
                                        current_station_sch_dept = value.schedule_time_departure;
                                        flag_current_station = 1;
                                    } else {
                                        next_station_geocoord = f_location_geocoord;
                                        next_station_code = value.location_code;
                                        current_station_sch_arrival = value.schedule_time_arrival;
                                        flag_lookst = 0;
                                    }
                                }
                                if (value.location_sequence == 2) {  // For end station
                                    end_station_sta = value.schedule_time_arrival;
                                }
                            }
                        }
                        
                        
                        finalCust.push({
                            LocationName: value.location_name,
                            LocationGeocoord: f_location_geocoord,
                            LocationCode: value.location_code,
                            ScheduleTimeArrival: value.schedule_time_arrival,
                            ScheduleTimeDeparture: value.schedule_time_departure,
                            SequenceNo: f_sequence_no,
                            LocationSequenceNo: f_location_sequence,
                            TravelTime: value.travel_time,
                            TravelTimeCons: consec_travel_time_sec,
                            HaltDuration: value.halt_duration,
                            Arrival: f_arrival_time,
                            Departure: f_departure_time,
                            ArrivalGeo: f_geo_arrival_time,
                            DepartureGeo: f_geo_departure_time,
                            ArrivalGeoCoord: f_arrival_geocoord,
                            DepartureGeoCoord: f_departure_geocoord,
                            GeoArrivalGeoCoord: f_geo_arrival_geocoord,
                            GeoDepartureGeoCoord: f_geo_departure_geocoord,
                            PodStatus: f_pod_status,
                            EditDate: f_edit_date,
                            EditId: f_edit_id,
                            GpsDepartureGpsCoord: f_gps_departure_geocoord,
                            GpsArrivalGpsCoord:f_gps_arrival_geocoord,
                            ArrivalGps: f_gps_arrival_time,
                            Radius:f_radius
                        });
                        

                        //////////////



                    });
                }
                //console.log(finalCust);
                //console.log(Object.keys(finalCust).length);
                finalCust.sort((a, b) => {
                    return a.SequenceNo - b.SequenceNo;
                });

                //console.log(finalCust);
                let customer_geocoord ="";
                let customer_name="";
                let customer_visited="";
                let trip_details =[];
                finalCust.forEach((valueC) => {
                    //console.log(valueC);
                    //process.exit(0);
                    let actual_arv_lstP = "-";
                    let actual_arv_lstP_by = "-";
                    let actual_arv_coord_lstP = "-";                         
                    let actual_dep_lstP ="-";  
                    let actual_dep_lstP_by="-";  
                    let actual_dep_coord_lstP="-";            
                    let delay_in_arv_lstP = "-";
                    let status_arrival="-";
               
                    if (valueC.LocationSequenceNo != 0) {
                        customer_geocoord += valueC.LocationGeocoord + "|";
                        customer_name += valueC.LocationCode + "`~";
                        
                        if (valueC.PodStatus == "1") {
                            customer_visited += "1:";
                        } else {
                            customer_visited += "0:";
                        }

                        if (valueC.ArrivalGps  && valueC.ArrivalGeo ) {
                            if (strtotime(valueC.ArrivalGps) < strtotime(valueC.ArrivalGeo)) {
                                actual_arv_lstP = valueC.ArrivalGps;
                                actual_arv_lstP_by = "GPS";
                                actual_arv_coord_lstP = valueC.GpsArrivalGpsCoord;
                            } else {
                                actual_arv_lstP = valueC.ArrivalGeo;
                                actual_arv_lstP_by = "Manual";                               
                                actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;
                            }
                        }
                        else if (!valueC.ArrivalGps && valueC.ArrivalGeo ) {
                            actual_arv_lstP = valueC.ArrivalGeo;                            
                            actual_arv_lstP_by = "Manual";                           
                            actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;
                        } else if (valueC.ArrivalGps  && (!valueC.ArrivalGeo || valueC.ArrivalGeo == "")) {
                            actual_arv_lstP = valueC.ArrivalGps;
                            actual_arv_lstP_by = "GPS";                           
                            actual_arv_coord_lstP = valueC.GpsArrivalGpsCoord;
                        } /*else {
                            actual_arv_lstP = valueC.ArrivalGeo;
                            actual_arv_lstP_by = "Manual";
                            actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;
                        }*/
                    }
                    if (valueC.LocationSequenceNo != 2) {
                        

                        if (valueC.DepartureGps  && valueC.DepartureGeo ) {
                            if (strtotime(valueC.DepartureGps) < strtotime(valueC.DepartureGeo)) {
                                actual_dep_lstP = valueC.DepartureGps;
                                actual_dep_lstP_by = "GPS";                                
                                actual_dep_coord_lstP = valueC.GpsDepartureGpsCoord;
                            } else {
                                actual_dep_lstP = valueC.DepartureGeo;
                                actual_dep_lstP_by = "Manual";                               
                                actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;
                            }
                        }
                        else if (!valueC.DepartureGps && valueC.DepartureGeo ) {
                            actual_dep_lstP = valueC.DepartureGeo;                            
                            actual_dep_lstP_by = "Manual";                           
                            actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;
                        } else if (valueC.DepartureGps  && (!valueC.DepartureGeo || valueC.DepartureGeo == "")) {
                            actual_dep_lstP = valueC.DepartureGps;
                            actual_dep_lstP_by = "GPS";                           
                            actual_dep_coord_lstP = valueC.GpsDepartureGpsCoord;
                        } /*else {
                            actual_dep_lstP = valueC.DepartureGeo;
                            actual_dep_lstP_by = "Manual";
                            actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;
                        }*/
                    }
                    if(actual_arv_lstP!="-")
                    {
                        status_arrival="Arrived ("+ actual_arv_lstP_by +")"
                    }

                    if(valueC.ScheduleTimeArrival && actual_arv_lstP!="-")
                    {
                        if(strtotime(valueC.ScheduleTimeArrival) < strtotime(actual_arv_lstP))
                        {
                            let secdiff= strtotime(actual_arv_lstP) - strtotime(valueC.ScheduleTimeArrival) ;
                            delay_in_arv_lstP= secondsToDecimalHours(secdiff)+"Hrs. Delay";
                        }
                        else if(strtotime(valueC.ScheduleTimeArrival) > strtotime(actual_arv_lstP))
                        {
                            let secdiff=  strtotime(valueC.ScheduleTimeArrival)- strtotime(actual_arv_lstP) ;
                            delay_in_arv_lstP= secondsToDecimalHours(secdiff)+"Hrs. Before";
                        }
                        else{
                            delay_in_arv_lstP="OnTime";
                        }
                    }
                    
                    trip_details.push({
                        "Source":valueC.LocationCode,
                        "Label":"M"+valueC.SequenceNo,
                        "Coordinates":valueC.LocationGeocoord,
                        "SequenceNo":valueC.SequenceNo,
                        "STD":valueC.ScheduleTimeDeparture,
                        "ATD":actual_dep_lstP,
                        "STA":valueC.ScheduleTimeArrival,
                        "ATA":actual_arv_lstP,
                        "DelayArrival":delay_in_arv_lstP,
                        "Status":status_arrival,
                        "Radius":valueC.Radius
                    });

                });

                //console.log(trip_details);
                //process.exit(0);
                final_data.TripDetails=trip_details;
                final_data.Status="success";
                res.status(200).json(final_data);
                }
            }
        }
        else{
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
    }catch(error){
        res.status(500).json({error:error.message});
    }
};

exports.getTmsVehicle = async (req, res) => {
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    
    let response ={};
    let user_info ={};
    let vehicleIds = "";
    let vids = [];
    let resData={};
    resData.Status="fail";
    try {
        
        const {AccessToken,DeveloperOption,DeveloperOptionId,searchQuery} = req.body;        
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    let vids1 = [];
                    if(userType === 19) { // Zonal Manager
                        vids1 = await getZoneManagerVehicle(user_id, group_id);
                        vids=vids1;                        
                    }else if(userType === 12) { // Manager Login                                        
                        vids1 = await getZoneVehicle(user_id, group_id);
                        vids=vids1;                    
                    }else if(userType === 10) { // Transporter Login                                        
                        vids1 = await getTransporterVehicle(user_id, group_id, userType);                        
                        vids=vids1;
                        
                    }else{                                        
                        const sql_VUM = `SELECT vehicle_id FROM vehice_user_mapping WHERE status = 1 AND user_id = ${user_id}`;
                        const [vids2] = await db.promise().query(sql_VUM);
                        vids=vids2;
                    }
                    
                    //console.log(vids);
                    //let bin_vid={};
                    if(vids.length>0){
                       
                        /*vids.forEach(row => {   
                            //console.log(row);                           
                            //bin_vid[row.vehicle_id]=row.vehicle_id;
                            vehicleIds+=row.vehicle_id+",";
                        });
                        vehicleIds=vehicleIds.trim().slice(0, -1);*/
                        vehicleIds = vids.map(item => item.vehicle_id).join(' ,');
                        //console.log(vehicleIds);process.exit(0);
                        if(vehicleIds.length>0){
                            const sql_Veh = `SELECT id, vehicle_number FROM vehicle WHERE status = 1 AND id IN (${vehicleIds}) AND vehicle_number LIKE '%${searchQuery}%'`;
                            const [rowVeh] = await db.promise().query(sql_Veh);
                            
                            if(rowVeh.length>0){
                                resData.Data=rowVeh;
                                resData.Status="success";
                                res.status(200).json(resData);
                            }else{
                                err = "Data Not Found.";
                                resData.Message= err;
                                res.status(200).json(resData);
                            }

                        }else{
                            err = "Record Not Found.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }
                    }else{
                        err = "Assignment Data Not Found.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }                    
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

async function getZoneManagerVehicle(userId, groupId) {
    let response = [];
    //let vehicleIds = '';
    const sql_LUZM = `SELECT zone_id FROM logistic_user_zone_mapping WHERE status = 1 AND user_id = ${userId} AND group_id='${groupId}'`;
    try {
        const [rows_LUZM] = await db.promise().query(sql_LUZM);
        if(rows_LUZM.length>0){
            let zone_id = rows_LUZM[0].zone_id;

            const sql_VZA = `SELECT vehicle_id FROM vehicle_zone_assignment WHERE status = 1 AND zone_id = ${zone_id} AND group_id='${groupId}'`;
            response = await db.promise().query(sql_VZA);
            //const [rows_VZA] = await db.promise().query(sql_VZA);
            //const vehicleIds = rows_VZA.map(item => item.vehicle_id).join(' ,');
            //console.log(vehicleIds);process.exit(0);
        }
        
    } catch (error) {
        console.error('Error fetching alert:', error);
    }
      
    return response;
}

async function getZoneVehicle(userId, groupId) {
    
    let response = [];
    const sql_LFAA = `SELECT factory_id FROM logistic_factory_account_assignment WHERE status = 1 AND account_id = ${userId} AND group_id='${groupId}'`;
    
    try {
        const [rows_LFAA] = await db.promise().query(sql_LFAA);
        
        if(rows_LFAA.length>0){
            //let fac_id = rows_LFAA[0].factory_id;
            const factoryIds = rows_LFAA.map(item => item.factory_id).join(' ,');
            
            const sql_LCZM = `SELECT zone_id FROM logistic_customer_zone_mapping WHERE status = 1 AND customer_id IN(${factoryIds}) AND group_id='${groupId}'`;
            const [rows_LCZM] = await db.promise().query(sql_LCZM);
            
            if(rows_LCZM.length>0){
                const zoneIds = rows_LCZM.map(item => item.zone_id).join(' ,');

                const sql_VZA = `SELECT vehicle_id FROM vehicle_zone_assignment WHERE status = 1 AND zone_id IN(${zoneIds}) AND group_id='${groupId}'`;
                response = await db.promise().query(sql_VZA);
                console.log(rows_VZA);process.exit(0);
            }else{
                console.log('LCZM data not found');
            }
        }
        
    } catch (error) {
        console.error('Error fetching alert:', error);
    }
    //console.log('out');process.exit(0);  
    return response;
}

async function getTransporterVehicle(userId, groupId, userType) {
    let response = [];
    try {
        
        const sql_VUM = `SELECT vehicle_id FROM vehice_user_mapping WHERE status = 1 AND user_id = ${userId}`;
        const [rows_VUM] = await db.promise().query(sql_VUM);
        
        const sql_LRA = `SELECT type_detail_id FROM logistic_role_assignment WHERE status = 1 AND user_type = ${userType} AND user_id=${userId}`;
        const [rows_LRA] = await db.promise().query(sql_LRA);
        
        if(rows_LRA.length>0){
            const typeIds = rows_LRA.map(item => item.type_detail_id).join(' ,');
            let response1 = [];

            const sql_VTA = `SELECT vehicle_id FROM vehicle_transporter_assignment WHERE status = 1 AND transporter_id IN(${typeIds})`;
            const [rows_VTA] = await db.promise().query(sql_VTA);
            response1 = rows_VUM.concat(rows_VTA); 
            response = response1;
            
        }else{
            console.log('vehicleUserMappingData is not available.');
        }
        //console.log(response);process.exit(0);
        
    } catch (error) {
        console.error('Error fetching alert:', error);
    }
    //console.log('out');process.exit(0);  
    
    return response;           
}




exports.scheduleDashboardDtdcDetails =async(req,res) =>{
    try{
        const {AccessToken,MTripId,DeveloperOption,DeveloperOptionId} =req.body;
        let final_data = {};
        final_data.Status="fail";
        let response ={};
        if(AccessToken!=null && MTripId){
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
                //to do code
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
                
                const index_pre  = [];
                let finalCust = [];
                let fieldsC = {};
                let sort_order = 1;
                let resultsCustomer=[];
                fieldsC = { sort: { sequence_no: sort_order } };
                const tableC= 'courier_trip_detail_customer';
                index_pre.push(MTripId);
                let conditionsC = {
                    group_id: String(group_id)                                   
                    
                };
                conditionsC.obj ={ m_trip_id: { $in: Object.values(index_pre) } };  
                                       
                resultsCustomer = await mongu.getMongoQuery(conditionsC, fieldsC, tableC);
                if(resultsCustomer)
                {
                    let flag_lookst=1;
                    let flag_current_station=0;
                    let consec_travel_time_sec=0;
                    resultsCustomer.forEach(value => {

                        let end_station_sta="";
                        let current_station_code="";
                        let current_station_sch_dept="";
                        let current_station_geocoord="";
                        let next_station_code="";
                        let next_station_geocoord="";
                        let current_station_sch_arrival="";


                        let $=t = value.travel_time;
                        if (t != "" && t != null) {
                            const te = t.split(".");
                            if (te[0] != undefined && te[1] != undefined) {
                                const tes1 = parseInt(te[0]) * 3600;
                                const tes2 = parseInt(te[1]) * 60;
                                const tes = tes1 + tes2;
                                consec_travel_time_sec = tes;
                            }
                        }
                        
                        let mtid = String(value.m_trip_id.$oid);
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

                        let f_arrival_geocoord="";
                        if(value.arrival_geocoord)
                        {
                            f_arrival_geocoord=value.arrival_geocoord;
                        }

                        let f_departure_geocoord="";
                        if(value.departure_geocoord)
                        {
                            f_departure_geocoord=value.departure_geocoord;
                        }

                        let f_geo_arrival_geocoord="";
                        if(value.geo_arrival_geocoord)
                        {
                            f_geo_arrival_geocoord=value.geo_arrival_geocoord;
                        }

                        let f_geo_departure_geocoord="";
                        if(value.geo_departure_geocoord)
                        {
                            f_geo_departure_geocoord=value.geo_departure_geocoord;
                        }

                        let f_gps_departure_geocoord="";
                        if(value.gps_departure_geocoord)
                        {
                            f_gps_departure_geocoord=value.gps_departure_geocoord;
                        }
                        let f_gps_arrival_geocoord="";
                        if(value.gps_arrival_geocoord)
                        {
                            f_gps_arrival_geocoord=value.gps_arrival_geocoord;
                        }
                        let f_pod_status="";
                        if(value.pod_status)
                        {
                            f_pod_status=value.pod_status;
                        }
                        let f_edit_date="";
                        if(value.edit_date)
                        {
                            f_edit_date=value.edit_date;
                        }

                        let f_edit_id="";
                        if(value.edit_id)
                        {
                            f_edit_id=value.edit_id;
                        }

                        let f_location_geocoord="";
                        if(value.location_geocoord)
                        {
                            f_location_geocoord=value.location_geocoord;
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

                        let current_station_reached_time="";
                        if(value.arrival_time)
                        {
                            current_station_reached_time=value.arrival_time;
                        }

                        if(value.departure_time)
                        {
                            current_station_reached_time=value.departure_time;
                        }

                        if(value.geo_arrival_time)
                        {
                            current_station_reached_time=value.geo_arrival_time;
                        }

                        if(value.geo_departure_time)
                        {
                            current_station_reached_time=value.geo_departure_time;
                        }

                        if(value.gps_arrival_time)
                        {
                            current_station_reached_time=value.gps_arrival_time;
                        }

                        if(value.gps_departure_time)
                        {
                            current_station_reached_time=value.gps_departure_time;
                        }

                        if(value.gps_departure_time)
                        {
                            current_station_reached_time=value.gps_departure_time;
                        }

                        
                        if (current_station_reached_time != "" && flag_lookst == 1) {
                            flag_current_station = 1;
                            current_station_geocoord = f_location_geocoord;
                            current_station_code = value.location_code;
                            current_station_sch_dept = value.schedule_time_departure;
                        } else {
                            if (flag_lookst == 1) {
                                if (flag_current_station == 0 && value.location_sequence == 0) {
                                    current_station_geocoord = f_location_geocoord;
                                    current_station_code = value.location_code;
                                    current_station_sch_dept = value.schedule_time_departure;
                                }
                                if (value.location_sequence != 0) {
                                    if (flag_current_station == 0) {
                                        current_station_geocoord = f_location_geocoord;
                                        current_station_code = value.location_code;
                                        current_station_sch_dept = value.schedule_time_departure;
                                        flag_current_station = 1;
                                    } else {
                                        next_station_geocoord = f_location_geocoord;
                                        next_station_code = value.location_code;
                                        current_station_sch_arrival = value.schedule_time_arrival;
                                        flag_lookst = 0;
                                    }
                                }
                                if (value.location_sequence == 2) {  // For end station
                                    end_station_sta = value.schedule_time_arrival;
                                }
                            }
                        }
                        
                        
                        finalCust.push({
                            LocationName: value.location_name,
                            LocationGeocoord: f_location_geocoord,
                            LocationCode: value.location_code,
                            ScheduleTimeArrival: value.schedule_time_arrival,
                            ScheduleTimeDeparture: value.schedule_time_departure,
                            SequenceNo: f_sequence_no,
                            LocationSequenceNo: f_location_sequence,
                            TravelTime: value.travel_time,
                            TravelTimeCons: consec_travel_time_sec,
                            HaltDuration: value.halt_duration,
                            Arrival: f_arrival_time,
                            Departure: f_departure_time,
                            ArrivalGeo: f_geo_arrival_time,
                            DepartureGeo: f_geo_departure_time,
                            ArrivalGeoCoord: f_arrival_geocoord,
                            DepartureGeoCoord: f_departure_geocoord,
                            GeoArrivalGeoCoord: f_geo_arrival_geocoord,
                            GeoDepartureGeoCoord: f_geo_departure_geocoord,
                            PodStatus: f_pod_status,
                            EditDate: f_edit_date,
                            EditId: f_edit_id,
                            GpsDepartureGpsCoord: f_gps_departure_geocoord,
                            GpsArrivalGpsCoord:f_gps_arrival_geocoord,
                            ArrivalGps: f_gps_arrival_time
                        });
                        

                        //////////////



                    });
                }
                //console.log(finalCust);
                //console.log(Object.keys(finalCust).length);
                finalCust.sort((a, b) => {
                    return a.SequenceNo - b.SequenceNo;
                });

                //console.log(finalCust);
                let customer_geocoord ="";
                let customer_name="";
                let customer_visited="";
                let trip_details =[];
                finalCust.forEach((valueC) => {
                    //console.log(valueC);
                    //process.exit(0);
                    let actual_arv_lstP = "-";
                    let actual_arv_lstP_by = "-";
                    let actual_arv_coord_lstP = "-";                         
                    let actual_dep_lstP ="-";  
                    let actual_dep_lstP_by="-";  
                    let actual_dep_coord_lstP="-";            
                    //let delay_in_arv_lstP = "-";
                    let status_arrival="-";
               
                    if (valueC.LocationSequenceNo != 0) {
                        customer_geocoord += valueC.LocationGeocoord + "|";
                        customer_name += valueC.LocationCode + "`~";
                        
                        if (valueC.PodStatus == "1") {
                            customer_visited += "1:";
                        } else {
                            customer_visited += "0:";
                        }

                        if (valueC.ArrivalGps  && valueC.ArrivalGeo ) {
                            if (strtotime(valueC.ArrivalGps) < strtotime(valueC.ArrivalGeo)) {
                                actual_arv_lstP = valueC.ArrivalGps;
                                actual_arv_lstP_by = "GPS";
                                actual_arv_coord_lstP = valueC.GpsArrivalGpsCoord;
                            } else {
                                actual_arv_lstP = valueC.ArrivalGeo;
                                actual_arv_lstP_by = "Manual";                               
                                actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;
                            }
                        }
                        else if (!valueC.ArrivalGps && valueC.ArrivalGeo ) {
                            actual_arv_lstP = valueC.ArrivalGeo;                            
                            actual_arv_lstP_by = "Manual";                           
                            actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;
                        } else if (valueC.ArrivalGps  && (!valueC.ArrivalGeo || valueC.ArrivalGeo == "")) {
                            actual_arv_lstP = valueC.ArrivalGps;
                            actual_arv_lstP_by = "GPS";                           
                            actual_arv_coord_lstP = valueC.GpsArrivalGpsCoord;
                        } /*else {
                            actual_arv_lstP = valueC.ArrivalGeo;
                            actual_arv_lstP_by = "Manual";
                            actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;
                        }*/
                    }
                    if (valueC.LocationSequenceNo != 2) {
                        

                        if (valueC.DepartureGps  && valueC.DepartureGeo ) {
                            if (strtotime(valueC.DepartureGps) < strtotime(valueC.DepartureGeo)) {
                                actual_dep_lstP = valueC.DepartureGps;
                                actual_dep_lstP_by = "GPS";                                
                                actual_dep_coord_lstP = valueC.GpsDepartureGpsCoord;
                            } else {
                                actual_dep_lstP = valueC.DepartureGeo;
                                actual_dep_lstP_by = "Manual";                               
                                actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;
                            }
                        }
                        else if (!valueC.DepartureGps && valueC.DepartureGeo ) {
                            actual_dep_lstP = valueC.DepartureGeo;                            
                            actual_dep_lstP_by = "Manual";                           
                            actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;
                        } else if (valueC.DepartureGps  && (!valueC.DepartureGeo || valueC.DepartureGeo == "")) {
                            actual_dep_lstP = valueC.DepartureGps;
                            actual_dep_lstP_by = "GPS";                           
                            actual_dep_coord_lstP = valueC.GpsDepartureGpsCoord;
                        } /*else {
                            actual_dep_lstP = valueC.DepartureGeo;
                            actual_dep_lstP_by = "Manual";
                            actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;
                        }*/
                    }
                    if(actual_arv_lstP!="-")
                    {
                        status_arrival="Arrived ("+ actual_arv_lstP_by +")"
                    }

                    if(valueC.ScheduleTimeArrival && actual_arv_lstP!="-")
                    {
                        if(strtotime(valueC.ScheduleTimeArrival) < strtotime(actual_arv_lstP))
                        {
                            let secdiff= strtotime(actual_arv_lstP) - strtotime(valueC.ScheduleTimeArrival) ;
                            delay_in_arv_lstP= secondsToDecimalHours(secdiff)+"Hrs. Delay";
                        }
                        else if(strtotime(valueC.ScheduleTimeArrival) > strtotime(actual_arv_lstP))
                        {
                            let secdiff=  strtotime(valueC.ScheduleTimeArrival)- strtotime(actual_arv_lstP) ;
                            delay_in_arv_lstP= secondsToDecimalHours(secdiff)+"Hrs. Before";
                        }
                        else{
                            delay_in_arv_lstP="OnTime";
                        }
                    }

                    trip_details.push({
                        "Source":valueC.LocationCode,
                        "STD":valueC.ScheduleTimeDeparture,
                        "ATD":actual_dep_lstP,
                        "STA":valueC.ScheduleTimeArrival,
                        "ATA":actual_arv_lstP,
                        "DelayArrival":delay_in_arv_lstP,
                        "Status":status_arrival
                    });

                });

                //console.log(trip_details);
                //process.exit(0);
                final_data.TripDetails=trip_details;
                final_data.Status="success";
                res.status(200).json(final_data);
                }
            }
        }
        else{
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
    }catch(error){
        res.status(500).json({error:error.message});
    }
};


exports.scheduleDashboardDtdcTrackingLink =async(req,res) =>{
    try{
        const {AccessToken,ShipmentNo,VehicleLastTime,DeveloperOption,DeveloperOptionId} =req.body;
        let final_data = {};
        final_data.Status="fail";
        let response ={};
        if(AccessToken!=null && ShipmentNo){
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
                //to do code
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


                    const  tableP = 'courier_trip_detail';                    
                    const conditionsP={};
                    conditionsP.group_id=group_id;
                    conditionsP.shipment_no=ShipmentNo;
                    conditionsP.status=1;
                    const fieldsP = {
                        projection: {
                            _id: 1,
                            dynamic_url: 1,
                            salt_key: 1,
                            trip_status: 1,
                            imei_no: 1,
                            run_date: 1,
                            last_gps_time: 1
                        }
                    };
                    const result_val = await  mongu.getMongoQuery(conditionsP, fieldsP, tableP);
                    if(result_val.length >0)
                    {
                        result_val.forEach((value) => { 
                            let run_date= value.run_date;
                            let imeino=value.imei_no;
                            if(strtotime(VehicleLastTime) > strtotime(run_date))
                            {
                                if(imeino)
                                {
                                    if(value.dynamic_url)
                                    {
                                        final_data.Link=value.dynamic_url;
                                        final_data.Status="success";
                                        res.status(200).json(final_data);
                                        
                                    }
                                    else
                                    {
                                        //const data = `${ShipmentNo}\`^${group_id}`;
                                        const data = ShipmentNo+"`^"+group_id;
                                        const encode_data = Buffer.from(data).toString('base64');
                                        let salt_key= getSalt();
                                        let base_url='https://itraceit.in//tr';
                                        let dynamic_url= base_url+"?track="+encode_data+"&KEY="+salt_key;
                                        //update mongo
                                        const updateData = {};                                        
                                        updateData.dynamic_url = dynamic_url;
                                        updateData.salt_key = salt_key;
                                        const updateField = { $set: updateData };
                                        //console.log(updateField);
                                        const result_update =  mongu.updateCVMongoQuery(conditionsP, updateField, tableP);
                                        console.log(result_update);
                                        final_data.Link=dynamic_url;
                                        final_data.Status="success";
                                        res.status(200).json(final_data);
                                    }
                                    
                                }
                                else{
                                    final_data.Message="Cannot generate link. Imei is not assigned";
                                    final_data.Status="fail";
                                    res.status(200).json(final_data);
                                }
                                
                            }
                            else{
                                final_data.Message="Cannot generate link. GPS is InActive";
                                final_data.Status="fail";
                                res.status(200).json(final_data);
                            }

                            
                        });
                    }
                    else{
                        final_data.Message="Trip not Found";
                        final_data.Status="fail";
                        res.status(200).json(final_data);
                    }
                    

                //console.log(result_val);
                //process.exit(0);
                
                }
            }
        }
        else{
           
            final_data.Message="Payload Missing";
            res.status(501).json(final_data);
        }
    }catch(error){
        res.status(500).json({error:error.message});
    }
};

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

