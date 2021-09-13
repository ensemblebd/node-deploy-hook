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
    port: 8888,
    repoRoot: '/var/www/',
    url_pass: '',

    verifySMTPOnBootup: false,
    repoIsWebroot: true,

    // if [repoIsWebroot] is false, then the following applies:
    rsync: {
        basePath: '/var/www',
        args: "au --exclude '.git'",
        
    }
};
