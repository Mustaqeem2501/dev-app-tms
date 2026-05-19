const { json } = require("body-parser");
const db = require("../config/db");
//const db = require("../models/mysqlglobal");
const {passenc}= require("../helpers/pass_enc");
//const {getLastData,getParticularDateFullData} = require('../lib/cassandra-lib/libLog');

//const {getCVMongoQuery} =require("../lib/mongo/mongo_api");
const getMongo =require("../lib/mongo/mongo_api");
//const {getAccessTokenDataWeb,lastActivityWeb} = require("../helpers/access_token_web");
const tokenWeb= require("../helpers/access_token_web");

const uploadComponent = require('./components/uploadComponent');
const uploadS3Component = require('./components/uploadS3Component');

//ping
exports.pings = (req, res) => {
    res.status(200).send({
        message: "Ping successfull!"
      });
};

// READ: Get all users
exports.sample = async(req, res) => {
/*	const qry1="SELECT * FROM alerts";
	let result_set1 = await  db.executeQuery(qry1);
	res.json(result_set1);*/
	try{
		let rows_role=[];
		setTimeout(async() => {
	rows_role = await db.promise().query("SELECT * FROM role");
			console.log(rows_role);
 }, 5000);
 const [rows] = await db.promise().query("SELECT * FROM alerts");
if (rows.length > 0) {
      //res.json(rows[0]);
//	const [rows_role] = await db.promise().query("SELECT * FROM role");
	 res.json(rows_role);// Return the first user found
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
/*	db.query('SELECT * FROM alerts', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });*/
};

//last cassandra 
exports.lastStatus =  async (req,res) => {
    try{
    
   const {imeis} = req.body;
   //this for raw data
   /*
   if (!Array.isArray(imeis) || imeis.length === 0) {
    return res.status(400).json({ error: 'Invalid input data' });
    }
   */
    
       const imeisno= JSON.parse(imeis);
       const data_m =[];
       for(const[keyinit, val] of Object.entries(imeisno))
       {
        //console.log(val);
        data_m.push(val);
       }
    console.log("postimei="+imeisno);
    //process.exit();
   getLastData(data_m).then(resultdata =>res.status(200).json(resultdata));
   //getLastData(["991922203012345","HR74B4595"]).then(resultdata =>res.status(200).json(resultdata));
   
   //res.status(200).json(resultdata);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
    
};

//passencrypt

exports.passencrypt = async (req,res)=>{
    try{
        const {password} = req.body;
        passenc(password).then(
            result =>{
                res.status(200).json(result)
            }
        )
    }
    catch(error){
        res.status(500).json({error: error.message})
    }
}

// exSelect

exports.exSelect =async (req,res)=>{
    try{

        
        const conditions = {};
        const fields = {};
        const table ="cv_billing_statistics";
        getMongo.getCVMongoQuery(conditions, fields, table)
        .then(data =>  res.status(200).json(data))//console.log(data))
        .catch(err => res.status(500).json(err))//console.error(err));
        
    }
    catch(error){
        res.status(500).json({error: error.message})
    }
}

// getAccessTokenData

exports.getAccessTokenData =async (req,res)=>{
    try{

        getAccessTokenDataWeb("M6rNW57Q28jyv1zeYOw6u07")
        .then(data =>  res.status(200).json(data))
        .catch(err => res.status(500).json(err))
        
       
        
    }
    catch(error){
        res.status(500).json({error: error.message})
    }
}

// lastActivity

exports.lastActivity =async (req,res)=>{
    try{

        lastActivityWeb(14386,"172.31.8.90")
        .then(data =>  res.status(200).json(data))
        .catch(err => res.status(500).json(err))
        
       
        
    }
    catch(error){
        res.status(500).json({error: error.message})
    }
}


//getSpecificGroup
exports.getSpecificGroup =async (req,res) =>{
    let response={};
    response.status = "fail";
    try{
        const {AccessToken} = req.body;
        if(AccessToken!=null){
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            //console.log(user_info);
             if (user_info && user_info.Status == 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    //res.status(200).json(response);
            }
            else
            {
                //const user_id = 5659;
                const user_id = user_info.AccountId;
                
                const sql_user=`SELECT * FROM user WHERE id in (${user_id})  and status = 1 `;
                const [user_data] = await db.promise().query(sql_user);
                let group_id="";
                if (user_data.length > 0) {
                    const resultUsr=user_data[0];
                    
                     group_id =resultUsr['group_id'];
                    
                }
                //const group_id ="0041";
                const spec_permission={};
                const [result] = await db.promise().query("SELECT * FROM cv_specific_group_assignment WHERE `group_id`=? AND `status`=?",[group_id,1]);
                if (result.length > 0) {
                    const resultspc=result[0];

                    const specific_trip = resultspc['specific_trip'];                    
                    const irun_alert_dashboard =resultspc['irun_alert_dashboard'];
                    const delay_dashboard = resultspc['delay_dashboard'];
                    const trip_text_dashboard = resultspc['trip_text_dashboard'];
                    const vehicle_nearby = resultspc['vehicle_nearby'];
                    const vehicle_utilization = resultspc['vehicle_utilization'];
                    const gps_integration = resultspc['gps_integration'];
                    const fleet_performance =resultspc['fleet_performance'];
                    const schedule_dashboard =resultspc['schedule_dashboard'];

                    spec_permission.group_id=group_id;
                    spec_permission.specific_trip = specific_trip;
                    spec_permission.irun_alert_dashboard = irun_alert_dashboard;
                    spec_permission.delay_dashboard = delay_dashboard;
                    spec_permission.trip_text_dashboard = trip_text_dashboard;
                    spec_permission.vehicle_nearby = vehicle_nearby;
                    spec_permission.vehicle_utilization =vehicle_utilization;
                    spec_permission.gps_integration =gps_integration;
                    spec_permission.fleet_performance =fleet_performance;
                    spec_permission.schedule_dashboard =schedule_dashboard;
                }
                response['status']="success";
                response['specific_permission'] =spec_permission;
            }
            res.status(200).json(response);
        }
        else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
}

exports.s3TestUpload  = async  (req, res)  =>  {
    console.log(req.body);
    let response = {};
    response.status = "fail";   
    try {
        uploadComponent.single('attach_file')
        // Wrapping the multer single file upload in a promise
        /*
        const uploadSingle = util.promisify(uploadComponent.single('attach_file'));

        // Wait for the upload to complete
        await uploadSingle(req, res);*/
       
        // If no file is uploaded, return an error
        if (!req.files) {
            throw new Error("No file uploaded.");
        }
        
        const files = req.files;
        let attachmentFile = [];
         files.forEach((file) => {
               attachmentFile.push({
                    filename: file.originalname,
                    //content: files[i].buffer //buffer problem when using large freqent upload
                    path:file.path
              });
         });
        
        console.log(attachmentFile);
        console.log(attachmentFile[0].path);
        console.log(attachmentFile[0].filename);
        const upld = await uploadS3Component(attachmentFile[0].path,"paddy/complain-attachments/"+attachmentFile[0].filename);
        // Success response
        console.log(upld);
        response.status = "success";
        res.status(200).json(response);

    } catch (error) {
        // Error response
        res.status(500).json({ error: error.message });
    }
};


