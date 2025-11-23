const express = require('express');
const router = express.Router();
const { addMessage } = require('../controllers/contactController');

router.post("/", addMessage);

module.exports = router;
