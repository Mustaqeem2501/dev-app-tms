const { fetchKeyNew, fetchKey, uploadFile } = require('../../lib/aws-lib/s3');
const fs = require('fs');

const uploadS3 = async (bucketName,uploadPath, key) => {
  try {
    // res.send(bucketName) ;
    const s3Client = await fetchKey();
    // const s3Client = await fetchKeyNew();
    const response =  await uploadFile(s3Client, bucketName, key, uploadPath );
    // console.log(`File uploaded successfully to ${bucketName}/${key}`);
    console.log("Response : " , response.$metadata.httpStatusCode);
    
    if(response.$metadata.httpStatusCode == 200){
      // console.log("File Upload Success");
      
          return "success"
    }else{
      console.log("File Upload Fail");
        return "fail"
    }
    return response
  } catch (error) {
    console.error("Error uploading file to S3:", error);
  }
}

module.exports = uploadS3;

 
  
 
  