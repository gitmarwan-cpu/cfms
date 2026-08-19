'use strict';

const express = require('express');
const locationRoutes = require('../src/routes/locationRoutes');
const { errorHandler, notFoundHandler } = require('../src/middlewares/errorHandler');

const app = express();

app.use(express.json());
app.use('/api/locations', locationRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
