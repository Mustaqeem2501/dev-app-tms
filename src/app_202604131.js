// src/app.js
const express = require('express');
const dotenv = require('dotenv');
const myRoutes = require('./routes/myRoutes.js');
const routesTms = require('./routes/routesTms.js');
const routesVoyager = require('./routes/routesVoyager.js');
const cors =require('cors');
const bodyParser = require('body-parser');
const uploadComponent = require('./controllers/components/uploadComponent');
const transportermanagement = require('./routes/transportermanagement_dpk.js');

const multer =require('multer');
const formbody =multer(uploadComponent);
//const formbody =multer();
dotenv.config();
const app =express();

//Middleware
app.use(cors());
app.options("*",cors());
app.use(express());
//for parsing application/json
app.use(bodyParser.json());
// parse application/x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended:true}));
app.use(express.json({ limit: '10mb' }));  // Adjust this as per your file size limits
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(formbody.any());

//Routes
app.use('/dev-app-tms',myRoutes);
// app.use('/dev-app-tms',routesDriverManagement);
app.use('/dev-app-tms',routesTms);
app.use('/dev-app-tms',transportermanagement);
app.use('/dev-app-tms',routesVoyager);
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});