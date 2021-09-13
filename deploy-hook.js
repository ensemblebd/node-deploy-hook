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

    config = require('./config'),

    app = express(),
    m_mailer = require('./mailer'),
    m_whitelist = require('./whitelist')
    ;

try {
    var sconfig = require('./config.custom');
    config.merge(sconfig);
}catch(e){}

var server = http.createServer(app).listen( config.port );

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

    var projectDir, deployJSON, payload, repoName, project_config, 
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
            // let's resolve that down to the repo name only to avoid having subfolders inside our git repo main folder.
            let start = -1;
            if ((start = repoName.lastIndexOf('/'))!==-1) {
                repoName = repoName.substring(start+1);
            }
        }
        projectDir = path.normalize(config.repoRoot+'/'+repoName);

        var keys = Object.keys(config.repos);
        for (let name of keys) {
            if (name === repoName) {
                project_config = config.repos[name];
                if (project_config.user && project_config.path && project_config.path.indexOf('$user')!==-1) {
                    project_config.path = project_config.path.replace('$user',project_config.user);
                }
                project_config.path = path.normalize(project_config.path);
                break;
            }
        }
    }

    if (typeof(project_config) == 'undefined') {
        console.log('The repository specified by sender is not configured as a repo in config file: '+repoName);
        res.status(config.preferredPublicErrorCode).json({});
        return;
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
    // let's also check the destination
    if (project_config.path) {
        ok = false;
        fs.access(project_config.path, fs.constants.W_OK, function(err) {
            if(err) {
                console.log(err);
            }
            else ok = true;
        });
        if (!ok) {
            console.log('The configuration specified an invalid destination for repo('+repoName+'): '+project_config.path);
            res.status(config.preferredPublicErrorCode).json({});
            return;
        }
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

    if (!project_config.syncToFolder) {
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
        cmd.runSync(`git pull ${remote} ${branch}`); // no stash, since the repo is always unadulterated & clean. 
        // now we can proceed to replicate the changes to the target folder based on config.

        cmd.runSync(`rsync ${(project_config.rsyncArgs || config.rsyncArgs)} ./${(project_config.repoSubFolderLimit || '')}* ${project_config.path}`);
        if (project_config.applyOwner) {
            cmd.run(`chown -R ${project_config.user}:${project_config.group || project_config.user} ${project_config.path}`);
        }
        if (project_config.applyPerms) {
            cmd.run(`chmod -R ${(project_config.perms || 755)} ${project_config.path}`);
        }
    }
});

console.log((new Date()).toString()+ ":: Node-deploy-hook server listening on port::", config.port, ", environment:: ", app.settings.env);
