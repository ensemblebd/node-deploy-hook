const dayjs = require("dayjs");
const axios = require('axios');

module.exports = function(config) {
    let self = this;
    this.last_refresh = null;
    this.cidrs = config.additionalCIDR || [];

    var refresh=function() {
        self.last_refresh = dayjs();

        console.log('refreshing ip whitelist from [github] and [bitbucket]');
        axios.get(config.github).then((response) => {
            for(let cidr of response.data.hooks) {
                self.cidrs.push(cidr);
            }
        });
        axios.get(config.bitbucket).then((response) => {
            for(let item of response.data.items) {
                self.cidrs.push(item.cidr);
            }
        });
        return self.cidrs;
    };

    this.refreshIfNeeded = function() {
        if (self.last_refresh == null) return refresh();
        var next = self.last_refresh.add(config.refreshInterval, config.refreshIntervalType);
        if (self.last_refresh.isAfter(next)) return refresh();
    };

    // go ahead and preload it..
    this.refreshIfNeeded();
};