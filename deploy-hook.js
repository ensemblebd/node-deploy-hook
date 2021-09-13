/*
 * Node-deploy-hook
 * --------------------------------------------
 * See config.js for email and port options
 *
*/
require('./prototypes.js');

var express = require('express'),
    compression = require('compression'),
    errorhandler = require('errorhandler'),
    bodyParser = require('body-parser'),

    http = require('http'),
    
    cmd=require('node-cmd'),
    path = require("path"),
    fs = require('fs'),

    config = require('./config'),
    sconfig = require('./config.secrets'),

    app = express(),
    server = http.createServer(app).listen( config.port )
    mail = require('./mailer')
    ;

if (sconfig) {
    config.merge(sconfig);
}

var mailer = new mail(config);
if (config.verifySMTPOnBootup) {
    mailer.verify();
}

// Allow node to be run with proxy passing
app.enable('trust proxy');

app.use(errorhandler());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/", function(req, res){
    var projectDir, deployJSON, payload, 
        valid = false, ok = true,
        remoteBranch = req.query.remote_branch || 'origin',
        localBranch = req.query.local_branch || 'master'
        ;

    if(payload && payload.repository && payload.repository.name){        // POST request made by github service hook, use the repo name
        projectDir = path.normalize(config.serverRoot+payload.repository.name);
    }

    if(ok) {
        cmd.runSync(`cd ${projectDir}`);
        if (pullDirectlyToWebRoot) {
            cmd.runSync(`git stash`);
        }
        cmd.runSync(`git pull ${remoteBranch} ${localBranch}`, function(err, stdout, stderr){
            if(err){
                deployJSON = { error: true, subject: config.email.subjectOnError, message: err };
                if(config.email.sendOnError) mailer.send( deployJSON );
            } else {
                deployJSON = { success: true, subject: config.email.subjectOnSuccess, message: stdout  };
                if(config.email.sendOnSuccess) mailer.send( deployJSON );
            }

            res.json( deployJSON );
        });
    };
});

console.log((new Date()).toString()+ ":: Node-deploy-hook server listening on port::", config.port, ", environment:: ", app.settings.env);
