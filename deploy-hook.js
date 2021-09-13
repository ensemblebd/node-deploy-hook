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
    axios = require('axios'),
    ipRangeCheck = require("ip-range-check"),
    
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

// load the acceptable source ip whitelists..
var whitelist=[];
axios.get(config.ipList.github).then((response) => {
    for(let cidr of response.data.hooks) {
        whitelist.push(cidr);
    }
});
axios.get(config.ipList.bitbucket).then((response) => {
    for(let item of response.data.items) {
        whitelist.push(item.cidr);
    }
});

app.post("/", function(req, res){
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    var safe = ipRangeCheck(ip, whitelist);
    console.log(ip, safe);

    var projectDir, deployJSON, payload, repoName, 
        valid = false, ok=false, is_bitbucket = false,
        remoteBranch = req.query.remote_branch || 'origin',
        localBranch = req.query.local_branch || 'master'
        ;

    if(payload && payload.repository){        // POST request made by github service hook, use the repo name
        repoName = payload.repository.name;
        if (payload.repository.links && payload.repository.links.self) { // it's enough to assume bitbucket, the keys don't exist on github payloads. But i guess we could do an indexOf for the url.
            is_bitbucket = true;
            repoName = payload.repository.full_name; // name can have spaces in it, so with bitbucket we should use the fullname. Which will have a folder prefix:   username_or_team/real-repo-name-here
        }
        projectDir = path.normalize(config.repoRoot+repoName);
    }

    // make sure we can even git pull to the target folder..
    fs.access(projectDir, fs.constants.W_OK, function(err) {
        if(err) {
            console.log(err);
        }
        else ok = true;
    });

    if(ok) {
        cmd.runSync(`cd ${projectDir}`);
        if (config.repoIsWebroot) {
            cmd.runSync(`git stash`);
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
        }
        else {
            cmd.runSync(`git pull ${remoteBranch} ${localBranch}`);
        }
    };
});

console.log((new Date()).toString()+ ":: Node-deploy-hook server listening on port::", config.port, ", environment:: ", app.settings.env);
