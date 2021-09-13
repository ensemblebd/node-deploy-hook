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

    remote: 'origin',
    branch: 'master',

    ipList: {
        github: 'https://api.github.com/meta',
        bitbucket: 'https://ip-ranges.atlassian.com',
    },

    verifySMTPOnBootup: false,
    repoIsWebroot: true,

    // if [repoIsWebroot] is false, then the following applies:
    rsync: {
        basePath: '/var/www',
        args: "au --exclude '.git'",
        
    }
};
