const mongu =require("../../lib/mongo/mongo_api");
const o_cassandra = require('../../lib/cassandra-lib/libLog');
const moment = require('moment-timezone');

const getCourierUsertypeTripConditions = async (db, userType, userId, groupId) => {
    let conditionsP = {};
    conditionsP.group_id = groupId;
    conditionsP.trip_status = 1;
  
    // For Manager user_type = "12"
    if (userType == "12") {
      const queryLocMapping = `
        SELECT logistic_factory_account_assignment.factory_id, logistic_customer_master.code 
        FROM logistic_factory_account_assignment
        JOIN logistic_customer_master 
        ON logistic_customer_master.id = logistic_factory_account_assignment.factory_id
        WHERE logistic_factory_account_assignment.account_id = ?
        AND logistic_factory_account_assignment.group_id = ?
        AND logistic_factory_account_assignment.status = 1
        AND logistic_customer_master.status = 1
        AND logistic_customer_master.group_id = ?
      `;
  
      const [rows, fields]  = await db.promise().query(queryLocMapping, [userId, groupId, groupId]);
      //console.log(rows);
      let ccidStation = [];
      let cccodeStation = [];
      
      rows.forEach(row => {

        const ccid = row.factory_id;
        //console.log(ccid);
        ccidStation.push(parseInt(ccid, 10));  // Convert to integer
        cccodeStation.push(row.code);
      });
  
      conditionsP['$or'] = [
        { source_code: { $in: cccodeStation } },
        { destination_code: { $in: cccodeStation } }
      ];
      //console.log(conditionsP);
    } 
    // For Regional Manager user_type = "19"
    else if (userType == "19") {
      try {
        const sqlZoneManager = `
          SELECT DISTINCT zone_id 
          FROM logistic_user_zone_mapping 
          WHERE user_id = ? 
          AND status = 1
        `;
        //console.log(sqlZoneManager);
        const [resultZone,FresultZone] = await db.promise().query(sqlZoneManager, [userId]);
        //console.log(resultZone);
       
        let zid = resultZone.map(row => row.zone_id).join(',');
         
        if (zid) {
          const sqlZoneLocation = `
            SELECT customer_id 
            FROM logistic_customer_zone_mapping 
            WHERE zone_id IN (${zid}) 
            AND status = 1
          `;
          const [rstLocation,FrsLocation] = await db.promise().query(sqlZoneLocation);
  
          let plant = rstLocation.map(row => row.customer_id).join(',');
  
          if (plant) {
            const queryLocMapping = `
              SELECT logistic_customer_master.id AS factory_id, logistic_customer_master.code 
              FROM logistic_customer_master 
              WHERE logistic_customer_master.status = 1 
              AND logistic_customer_master.group_id = ? 
              AND logistic_customer_master.id IN (${plant})
            `;
  
            const [locChkMapping,FlocChkMapping] = await db.promise().query(queryLocMapping, [groupId]);
  
            let ccidStation = [];
            let cccodeStation = [];
  
            locChkMapping.forEach(row => {
              const ccid = row.factory_id;
              ccidStation.push(parseInt(ccid, 10));  // Convert to integer
              cccodeStation.push(row.code);
            });
  
            conditionsP['$or'] = [
              { source_code: { $in: cccodeStation } },
              { destination_code: { $in: cccodeStation } }
            ];
          }
        }
      } catch (error) {
        console.error(error);
        throw new Error('Error in fetching conditions for Regional Manager');
      }
    }
  
    return conditionsP;
  };

const chekGroupAssignment = async (user_id,forGroupId)=>{
  try{
      // Query to select data from the table
        const sqlQuery = `SELECT * FROM monitoring_group_assingment_master WHERE user_id = ? AND status = '1'`;
        
        // Execute the query
        const [rows] = await db.promise().query(sqlQuery, [user_id]);
        
        let groupId = null;
        // Loop through the result set to find the matching group ID
        for (const row of rows) {
            groupId = row.assigned_group;
            
            // If the group matches, break the loop
            if (groupId === forGroupId) {
                break;
            }
        }
        // If groupId does not match forGroupId, return the response
        if (groupId !== forGroupId) {
            const response = {
                Status: 'Error',
                Message: `Group ID '${forGroupId}' not Assigned to this User Group ${selfGroupId}`
            };
            return{response};
            console.log(JSON.stringify(response)); // In place of echo in PHP
        }

  }catch (error) {
      console.error('Error fetching permissions:', error);
      throw error;
    }
};

const preUserInfoSelf = async (db, group_type, user_id, user_type, self_group_id, forGroupId) => {
    let shipmentMethod = {};

    // MySQL query for `feeder_type`
    const [feederTypeRows] = await db.promise().query(`SELECT * FROM feeder_type WHERE status=1 AND group_id=?`, [forGroupId]);

    feederTypeRows.forEach(row => {
        shipmentMethod[row.id] = row.type_code;
    });

    let feederTypeIds = "";
    let zoneId = "";
    let zoneIdArr = {};

    // MySQL query for `monitoring_group_assignment_master`
    const [monitoringGroupRows] = await db.promise().query(`
        SELECT * FROM monitoring_group_assingment_master 
        WHERE user_id = ? AND status = '1' AND assigned_group = ?
    `, [user_id, forGroupId]);

    monitoringGroupRows.forEach(row => {
        //const groupId = row.assigned_group;
        zoneId = row.assigned_zone_id;
        zoneIdArr[row.assigned_zone_id] = String(row.assigned_zone_id);
        feederTypeIds = row.feeder_type_id;
    });

    let feederTypeArr = [];
    let feederList = [];
    
    if (feederTypeIds !== "") {
        feederTypeArr = feederTypeIds.split(',');
        feederList = feederTypeArr.map(feederIdVal => shipmentMethod[feederIdVal]);
    }

    // MongoDB query for `alert_user_mapping_master`
    const conditions = { 
        group_id: { $in: [self_group_id] },
        status: 1,
        user_id: String(user_id)
    };
    //console.log(conditions);
    const fields = {};
    const table ="alert_user_mapping_master";
    const resultAlertMapping = await  mongu.getMongoQuery(conditions, fields, table);
    //console.log(resultAlertMapping);
    /*
    const alertUserMappingCollection = mongoDb.collection('alert_user_mapping_master');
    const resultAlertMapping = await alertUserMappingCollection.find({
        group_id: { $in: [self_group_id] },
        status: 1,
        user_id: String(user_id)
    }).toArray();
    */
    let alertMapBin = {};
    resultAlertMapping.forEach(row => {
        alertMapBin[row.alert_name] = row.min_escalation_level;
    });

    // Return the combined user information
    return {
        alert_map_bin: alertMapBin,
        zone_id: zoneId,
        zone_id_arr: zoneIdArr,
        feederlist: feederList
    };
};


const preUserInfo = async (db, group_type, user_id, user_type, self_group_id, forGroupId) => {
  let shipmentMethod = {};

  // MySQL query for `feeder_type`
  const [feederTypeRows] = await db.promise().query(`SELECT * FROM feeder_type WHERE status=1 AND group_id=?`, [forGroupId]);

  feederTypeRows.forEach(row => {
      shipmentMethod[row.id] = row.type_code;
  });

  let feederTypeIds = "";
  let zoneId = "";
  let zoneIdArr = {};
  if(group_type == "27")
  {
    // MySQL query for `monitoring_group_assignment_master`
    const [monitoringGroupRows] = await db.promise().query(`
        SELECT * FROM monitoring_group_assingment_master 
        WHERE user_id = ? AND status = '1' AND assigned_group = ?
    `, [user_id, forGroupId]);

    monitoringGroupRows.forEach(row => {
        //const groupId = row.assigned_group;
        zoneId = row.assigned_zone_id;
        zoneIdArr[row.assigned_zone_id] = String(row.assigned_zone_id);
        feederTypeIds = row.feeder_type_id;
    });
  }
  let feederTypeArr = [];
  let feederList = [];
  
  if (feederTypeIds !== "") {
      feederTypeArr = feederTypeIds.split(',');
      feederList = feederTypeArr.map(feederIdVal => shipmentMethod[feederIdVal]);
  }

  // MongoDB query for `alert_user_mapping_master`
  const conditions = { 
      group_id: { $in: [self_group_id] },
      status: 1,
      user_id: String(user_id)
  };
  //console.log(conditions);
  const fields = {};
  const table ="alert_user_mapping_master";
  const resultAlertMapping = await  mongu.getMongoQuery(conditions, fields, table);
  //console.log(resultAlertMapping);
  /*
  const alertUserMappingCollection = mongoDb.collection('alert_user_mapping_master');
  const resultAlertMapping = await alertUserMappingCollection.find({
      group_id: { $in: [self_group_id] },
      status: 1,
      user_id: String(user_id)
  }).toArray();
  */
  let alertMapBin = {};
  resultAlertMapping.forEach(row => {
      alertMapBin[row.alert_name] = row.min_escalation_level;
  });

  // Return the combined user information
  return {
      alert_map_bin: alertMapBin,
      zone_id: zoneId,
      zone_id_arr: zoneIdArr,
      feederlist: feederList
  };
};



const getPermissions =async (self_group_id, user_id) =>{
    try {
        const conditions_per = {
          group_id: String(self_group_id),
          status: 1,
          user_id: String(user_id), // dynamic later
        };
          const fields = {};
          const table ='alert_feature_mapping_master';
          const permission_detail = await  mongu.getMongoQuery(conditions_per, fields, table);
          const permission = {};
  
          permission_detail.forEach((perm_row) => {
            permission['create_alert'] = perm_row['create_alert'];
            permission['snooz'] = perm_row['snooz'];
            permission['escalate'] = perm_row['escalate'];
            permission['view_qrt'] = perm_row['view_qrt_team'];
            permission['assign_qrt_team'] = perm_row['assign_qrt_team'];
            permission['assign_ground_team'] = perm_row['assign_ground_team'];
            permission['add_document_on_trip'] = perm_row['add_document_on_trip'];
            permission['client_remarks_on_trigger'] = perm_row['client_remarks_on_trigger'];
            permission['close_alert'] = perm_row['close_alert'];
            permission['track_qrt_activity'] = perm_row['track_qrt_activity'];
            permission['history_and_summary'] = perm_row['history_and_summary'];
            permission['alert_action'] = perm_row['alert_action'];
      
            permission['priority_activate'] =
              perm_row['priority_activate'] !== undefined
                ? perm_row['priority_activate']
                : 0;
      
            permission['priority_deactivate'] =
              perm_row['priority_deactivate'] !== undefined
                ? perm_row['priority_deactivate']
                : 0;
          });
        


        return permission;
    
    
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw error;
    }

};


const lastSeenLatlongIOV3 = async (db,imeiArr)=>{
  console.log(imeiArr);
  
  let response =[];
  
  try{
  const io_type_values = await getVehicleIoDetailsV3(db, imeiArr);
  //const imeis = `'${imeiArr.join("','")}'`;
  //console.log(imeiArr);
  //console.log(io_type_values);

  const st_result = await o_cassandra.getLastData(imeiArr);//['991922203012345','HR74B4595']
  //const st_result = await o_cassandra.getLastData(['991922203012345','HR74B4595']);//
  //console.log(st_result);
  for(const row of Object.values(st_result))
    {
    
  //st_result.forEach((row) => {

    const imei_no = row.imei;

    const version = row.b;
    let lat = row.d;
    let long = row.e;
    const speed = row.f;
    //console.log(speed);
    const device_time = row.h;

    const io1 = row.i;
    const io2 = row.j;
    const io3 = row.k;
    const io4 = row.l;
    const io5 = row.m;
    const io6 = row.n;
    const io7 = row.o;
    const io8 = row.p;

    const bat_vol = row.r;
    const max_speed = row.s;
    const max_speed_time = row.t;
    const halt_time = row.u;
    const l_time = row.lt;

    if (lat.endsWith('N')) lat = lat.slice(0, -1);
    if (long.endsWith('E')) long = long.slice(0, -1);

    let bat_per = 0;
    if (bat_vol >= 3.7) {
        bat_per = (200 * bat_vol) - 730;
    } else {
        bat_per = (100 * bat_vol) - 360;
    }
    if (bat_per < 0) bat_per = 0;
    if (bat_per > 100) bat_per = 100;

    const io_type_value = io_type_values[imei_no] || "tmp_str";

    const current_time = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");//new Date();
    let diff_1, diff_2;
    if (new Date(l_time) >= new Date(device_time)) {
        diff_1 = (current_time - new Date(l_time)) / 1000;
        diff_2 = (new Date(l_time) - new Date(device_time)) / 1000;
    } else {
        diff_1 = (current_time - new Date(device_time)) / 1000;
        diff_2 = diff_1;
    }

    const diff_3 = (current_time - new Date(halt_time)) / 1000;

    let vehicle_status = "";
    let running_status = "";

    if (diff_1 > 86400) {
        vehicle_status = 'InActive';
        running_status = 'InActive';
    } else if (diff_2 >= 3600) {
        vehicle_status = 'NoGPS';
        running_status = 'NoGPS';
    } else if (lat.trim() !== "" && lat.trim().length > 4 && long.trim() !== "" && long.trim().length > 4 && diff_1 >= 1800) {
        vehicle_status = 'NoData';
        running_status = 'NoData';
    } else if (lat.trim().length > 4 && long.trim().length > 4 && diff_1 < 1800) {
        vehicle_status = 'Active';
        running_status = 'Running';

        if (diff_3 > 300) running_status = 'Stopped';
    } else {
        vehicle_status = 'NoGPS';
        running_status = 'NoGPS';
    }

    let io_data = {};
    if (io_type_value !== "tmp_str") {
        const io_type_value_arr = io_type_value.split(":");

        io_type_value_arr.forEach((io_type) => {
            const io_type_arr = io_type.split("^");
            let io_value;

            switch (io_type_arr[0]) {
                case "1": io_value = io1; break;
                case "2": io_value = io2; break;
                case "3": io_value = io3; break;
                case "4": io_value = io4; break;
                case "5": io_value = io5; break;
                case "6": io_value = io6; break;
                case "7": io_value = io7; break;
                case "8": io_value = io8; break;
            }

            const version_arr = version.split(".");
            const flag_version = ["v1", "v2", "v3"].includes(version_arr[0]) ? 1 : 0;

            if (io_type_arr[1] === "temperature") {
                if (io_value && io_value >= -30 && io_value <= 70) {
                    io_data['Temperature'] = io_value;
                } else {
                    io_data['Temperature'] = '-';
                }
            } else if (io_type_arr[1]) {
                switch (io_type_arr[1].trim()) {
                    case "engine":
                        const hours = diff_1 / 3600;
                        const minutes = hours * 60;
                        if (flag_version) {
                            if (io_value === "1") {
                                if (running_status === 'Running' && minutes < 30) running_status = 'Stopped';
                                io_data['Engine'] = 'Off';
                            } else {
                                if (minutes < 30) running_status = 'Running';
                                io_data['Engine'] = 'On';
                            }
                        } else {
                            if (io_value <= 350) {
                                running_status = 'Stopped';
                                io_data['Engine'] = 'Off';
                            } else {
                                running_status = 'Running';
                                io_data['Engine'] = 'On';
                            }
                        }
                        break;
                    case "engine_lock":
                        io_data['EngineLock'] = io_value == "0" ? 'Off' : 'On';
                        break;
                    case "ac":
                        if (flag_version) {
                            io_data['AC'] = io_value == "1" ? 'Off' : 'On';
                        } else {
                            io_data['AC'] = io_value > 500 ? 'Off' : 'On';
                        }
                        break;
                    case "door_open":
                    case "door_open2":
                    case "main_hole":
                    case "door_open3":
                    case "fuel_lead":
                        const state = flag_version ? io_value == "1" ? 'Close' : 'Open' : io_value < 250 ? 'Close' : 'Open';
                        io_data[ucwords(io_type_arr[1])] = state;
                        break;
                    case "sos":
                        io_data['SOS'] = io_value == "0" ? 'On' : 'Off';
                        break;
                    case "raw_power":
                        io_data['MainPower'] = flag_version ? (io_value >= 1000 ? 'On' : 'Off') : (io_value > 10 ? 'On' : 'Off');
                        break;
                    default:
                        io_data[ucwords(io_type_arr[1])] = io_value || '-';
                }
            }
        });
    }

    const init = new Date(device_time) - new Date(halt_time);
    const hours = Math.floor(init / 3600);
    const minutes = Math.floor((init % 3600) / 60);
    const seconds = init % 60;
    
    const speed1 = typeof speed === 'number' ? Number(speed.toFixed(2)) : Number(parseFloat(speed).toFixed(2));
    const bat_vol1 = typeof bat_vol === 'number' ? Number(bat_vol.toFixed(2)) : Number(parseFloat(bat_vol).toFixed(2));
    const bat_per1=typeof bat_per === 'number' ? Number(bat_per.toFixed(2)) : Number(parseFloat(bat_per).toFixed(2));
    const max_speed1 = typeof max_speed === 'number' ? Number(max_speed.toFixed(2)) : Number(parseFloat(max_speed).toFixed(2));
    const last_data = {
        Imei: imei_no,
        Version: version,
        Latitude: lat,
        Longitude: long,
        
        Speed: speed1,
        DeviceTime: device_time,
        BatVol: bat_vol1,
        BatPer: bat_per1,
        MaxSpeed: max_speed1,
        MaxSpeedTime: max_speed_time,
        HaltTime: halt_time,
        LTime: l_time,
        CellName: row.ci,
        HaltDuration: `${hours}:${minutes}:${seconds}`,
        VehicleStatus: vehicle_status,
        RunningStatus: running_status,
        IO: Object.keys(io_data).length ? io_data : 'N/A'
    };

    response[imei_no] = last_data;
  }
//});

  //o_cassandra.getLastData(imeiArr).then(resultdata =>console.log(resultdata));
  }catch(error){
    console.log( error.message);
  }
  // console.log(response);
  return response;
};

function ucwords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

const getVehicleIoDetailsV3 =async(db, imeiArr)=>
{
  let response =[];
  let imeis = `'${imeiArr.join("','")}'`;
  let dids = [];
  const [devicesid]= await db.promise().query(`SELECT id FROM devices WHERE status = 1 AND device_imei IN(${imeis})`);
  //console.log(devicesid);
  let deviceIdArr=[];
  deviceIdArr.push(devicesid[0].id);
  //console.log(deviceIdArr);
  let features = {};
  if(deviceIdArr.length > 0 )
  {
    dids = `${deviceIdArr.join("','")}`;
    //console.log(dids);
    const [result2] = await db.promise().query(`SELECT dfa.io1_feature_id, dfa.io2_feature_id, dfa.io3_feature_id, dfa.io4_feature_id, dfa.io5_feature_id, dfa.io6_feature_id, dfa.io7_feature_id, dfa.io8_feature_id, d.device_imei FROM device_feature_assignment dfa LEFT JOIN devices d ON dfa.device_id = d.id WHERE dfa.device_id IN(${dids})`);
    //console.log(result2);
    const [result3] = await db.promise().query('SELECT id,name FROM device_features WHERE status=1');
    if(result3){
     //console.log(result3);
      result3.forEach(row => {
        if(row.name && row.id)
        {
          features[row.id]=row.name;
        }
      
        
      });
    }
    //console.log(features);
    if(result2){
      result2.forEach(row => {
        let imei_no = row.device_imei;
        let assigned_io = [];

        for (let i = 1; i <= 8; i++) {
            const fid = row[`io${i}_feature_id`];

            if (fid !== "" && features[fid]!=undefined) {
                assigned_io.push(`${i}^${features[fid]}`);
            }
        }

        if (assigned_io.length > 0) {
            response[imei_no] = assigned_io.join(':');
        } else {
            response[imei_no] = "tmp_str";
        }
      
        
      });
    }

  }

  
  return response;
}


  

  module.exports = {
    getCourierUsertypeTripConditions,
    preUserInfoSelf,
    preUserInfo,
    getPermissions,
    chekGroupAssignment,
    lastSeenLatlongIOV3
  };