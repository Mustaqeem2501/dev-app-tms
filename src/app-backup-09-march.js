// src/app.js
const express = require('express');
const dotenv = require('dotenv');
const cors =require('cors');

const uploadComponent = require('./controllers/components/uploadComponent');
const myRoutes = require('./routes/myRoutes.js');
const routesTms = require('./routes/routesTms.js');
const transportermanagement = require('./routes/transportermanagement_dpk.js');
// const bodyParser = require('body-parser');

// const multer =require('multer');
// const formbody =multer(uploadComponent);
//const formbody =multer();
dotenv.config();
const app =express();

//Middleware
app.use(cors({
    // origin: 'http://localhost:4200', // Change to your client app's URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed methods
    credentials: true // Enable cookies and authorization headers
}));
app.options('*', cors()); // Enable pre-flight across-the-board
app.use(express.json()); // Parses incoming JSON requests
app.use(uploadComponent.any());

//Routes
// app.use('/dev-app-itraceit',myRoutes);
// app.use('/dev-app-tms',routesDriverManagement);
app.use('/dev-app-tms',routesTms);
app.use('/dev-app-tms',transportermanagement);
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});