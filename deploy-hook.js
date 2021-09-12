/*
 * Node-deploy-hook
 * --------------------------------------------
 * See config.js for email and port options
 *
*/

var express = require('express'),
    compression = require('compression'),
    errorhandler = require('errorhandler'),
    bodyParser = require('body-parser'),

    http = require('http'),
    nodemailer = require("nodemailer"),
    
    cmd=require('node-cmd'),
    path = require("path"),

    app = express(),
    config = require('./config'),

    // port can be optionally configured (8888 by default)
    server = http.createServer(app).listen( config.port );



// Allow node to be run with proxy passing
app.enable('trust proxy');

app.use(errorhandler());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


var sendMail = function(message){
    var smtpTransport = nodemailer.createTransport("SMTP", config.email.transport);
    smtpTransport.sendMail({
        from: config.email.from,
        to: config.email.to,
        subject: message.subject,
        text: message.text
    }, function(err, res){
        if(err) console.log((new Date()).toString() + " :: Error sending deployment email:: " + err);
        else console.log((new Date()).toString() + " :: Successfully sent deployment email.");
    });
};

app.post("/", function(req, res){
    var projectDir,
        remoteBranch = req.params.remote_branch || 'origin',
        localBranch = req.params.local_branch || 'master',
        deployJSON, payload, ok;

	ok = true;

if(req.body.payload)
	payload = JSON.parse(req.body.payload);

    if(payload && payload.repository && payload.repository.name){        // POST request made by github service hook, use the repo name
        projectDir = path.normalize(config.serverRoot+payload.repository.name);
    } else if(req.query.project){                                          // GET request made thru nginx proxy, use the appended project GET param
        projectDir = path.normalize(config.serverRoot+req.query.project); 
    } else {                                                                // Else assume it is this repo or installed here, and was hit directly
        projectDir = __dirname;                             
	res.end('Invalid request');
	ok = false;
    }

if(ok) {
    var deploy = cmd.runSync("cd "+projectDir+" && git stash && git pull "+remoteBranch+" "+localBranch, function(err, stdout, stderr){
        if(err){
            deployJSON = { error: true, subject: config.email.subjectOnError, message: err };
            if(config.email.sendOnError) sendMail( deployJSON );
        } else {
            deployJSON = { success: true, subject: config.email.subjectOnSuccess, message: stdout  };
            if(config.email.sendOnSuccess) sendMail( deployJSON );
        }

        res.json( deployJSON );
    });
};
});

console.log((new Date()).toString()+ ":: Node-deploy-hook server listening on port::", config.port, ", environment:: ", app.settings.env);
