module.exports = {
    email: {
        sendOnSuccess: false,
        sendOnError: false,
        to: "example@example.com",
        from: "node-deploy-hook",
        subjectOnSuccess: "Successfully updated repository",
        subjectOnError: "Failed to update respository",
        transports: {
            sample: {
                service: "Gmail",
                auth: {
                    user: "somegmailuser@gmail.com",
                    pass: "somepass"
                }
            }
        },
        transport: 'sample' 
    },
    route: "/deploy",
    port: 8888,
    repoRoot: '/var/www',
    url_pass: '',
    passwordQueryField: 'pwd',
    preferredPublicErrorCode: 403,

    remote: 'origin',
    branch: 'master',
    deployMessage: '#deploy-live',

    ipList: {
        github: 'https://api.github.com/meta',
        bitbucket: 'https://ip-ranges.atlassian.com',
        refreshInterval: 1,
        refreshIntervalType: 'day',
        additionalCIDR: []
    },

    verifySMTPOnBootup: false,
    rsyncArgs: "-au --exclude '.git'",

    cmds: {
        before: [],
        success: [],
        finally: []
    },

    repos: {
        "sample-repo-name": {
            syncToFolder: false
        },
        "sample-rsync-repo": {
            syncToFolder: true,
            applyOwner: true,
            applyPerms: true,

            user: 'ubuntu',
            group: 'nginx',
            perms: 775,

            path: '/var/www/$user/app/', // specify the full path on server where rsync should copy too. $user is currently only working automatic variable insertion. In this example, notice both end in "app/". Repo may have may folders, we only care about one in this case.
            repoSubFolderLimit: 'app/', // leave blank to rsync the entire git repo. Otherwise, target a single folder.,
            requireMessage: false
        }
    }
};
