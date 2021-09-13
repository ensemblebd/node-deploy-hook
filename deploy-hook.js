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
    ipRangeCheck = require("ip-range-check"),
    
    cmd=require('node-cmd'),
    path = require("path"),
    fs = require('fs'),
    dayjs = require('dayjs'),

    config = require('./config'),
    sconfig = require('./config.secrets'),

    app = express(),
    server = http.createServer(app).listen( config.port )
    m_mailer = require('./mailer'),
    m_whitelist = require('./whitelist')
    ;

if (sconfig) {
    config.merge(sconfig);
}

var mailer = new m_mailer(config);
if (config.verifySMTPOnBootup) {
    mailer.verify();
}
var whitelist = new m_whitelist(config.ipList);

// Allow node to be run with proxy passing
app.enable('trust proxy');

app.use(errorhandler());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.post(config.route, function(req, res){
    whitelist.refreshIfNeeded();

    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    var safe = ipRangeCheck(ip, whitelist);
    if (!safe) {
        console.log('sender is not an authorized ip from a valid [bitbucket] or [github] origin.');
        res.status(config.preferredPublicErrorCode).json({});
        return;
    }

    var projectDir, deployJSON, payload, repoName, 
        valid = false, ok=false, is_bitbucket = false,
        remote = req.query.remote || config.remote,
        branch = req.query.branch || config.branch,
        pass = req.query[config.passwordQueryField] || ''
        ;

    if(payload && payload.repository){        // POST request made by github service hook, use the repo name
        repoName = payload.repository.name;
        if (payload.repository.links && payload.repository.links.self) { // it's enough to assume bitbucket, the keys don't exist on github payloads. But i guess we could do an indexOf for the url.
            is_bitbucket = true;
            repoName = payload.repository.full_name; // name can have spaces in it, so with bitbucket we should use the fullname. Which will have a folder prefix:   username_or_team/real-repo-name-here
        }
        projectDir = path.normalize(config.repoRoot+'/'+repoName);
    }

    // make sure we can even git pull to the target folder..
    fs.access(projectDir, fs.constants.W_OK, function(err) {
        if(err) {
            console.log(err);
        }
        else ok = true;
    });
    if (!ok) {
        console.log('The server repo path is invalid: '+projectDir);
        res.status(config.preferredPublicErrorCode).json({});
        return;
    }

    if (is_bitbucket) {
        valid = (payload.push && payload.push.changes && payload.push.changes.length>0);
        if (valid) {
            valid = false;
            for (let change of payload.push.changes) {
                if (change.new.type==="branch" && change.new.name === branch) {
                    valid = true;
                    break;
                }
            }
            if (!valid) {
                console.log('[bitbucket] none of the commits('+payload.push.changes.length+') match the target branch: '+branch);
                // output a soft error (200 ok to sender), but we will not take any actions.
                res.json({});
                return;
            }
        }
    }
    else {
        valid = (payload.ref && payload.commits && payload.commits.length>0);
        if (payload.ref.indexOf(branch)==-1) {
            console.log('[github] ref does not match the target branch: '+branch);
            // output a soft error (200 ok to sender), but we will not take any actions.
            res.json({});
            return;
        }
    }

    if (!valid) {
        // reaching here means the payload is invalid or malformed. Should be very rare.
        console.log('invalid payload received.');
        res.status(config.preferredPublicErrorCode).json({});
        return;
    }

    valid = (config.url_pass==='' || pass === config.url_pass);
    if (!valid) {
        // reaching here means the payload is invalid or malformed. Should be very rare.
        console.log('invalid password in url query string from sender: '+pass);
        res.status(config.preferredPublicErrorCode).json({});
        return;
    }


    // now we take action since the repo path is fine, and the sender provided valid payload info for target branch..

    cmd.runSync(`cd ${projectDir}`);

    if (config.repoIsWebroot) {
        cmd.runSync(`git stash`); // prevent changes from breaking the git pull.
        cmd.runSync(`git pull ${remote} ${branch}`, function(err, stdout, stderr){
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
        cmd.runSync(`git pull ${remote} ${branch}`);

    }
});

console.log((new Date()).toString()+ ":: Node-deploy-hook server listening on port::", config.port, ", environment:: ", app.settings.env);
