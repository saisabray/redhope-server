const express = require('express');
const rootApp = require('../index');

const app = express();

// Mount the root app to handle all paths correctly regardless of Vercel's rewrite behaviors
app.use('/', rootApp);
app.use('/api', rootApp);

module.exports = app;
