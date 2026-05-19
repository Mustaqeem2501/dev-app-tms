const express = require('express');
const router =express.Router();
// const complaintManagement =require('../controllers/complainManagementController.js');

const { searchComplainNo } = require("../controllers/complainManagementController");

/**
 * @swagger
 * /searchComplainNo:
 *   post:
 *     summary: Search complain number
 *     tags:
 *       - Complaint Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               AccessToken:
 *                 type: string
 *               searchValue:
 *                 type: string
 *               DeveloperOption:
 *                 type: string
 *               DeveloperOptionId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User Not Found
 *       500:
 *         description: Internal Server Error
 */

router.post( "/searchComplainNo", searchComplainNo );
// router.post("/searchComplainNo", searchComplainNo);


module.exports = router;