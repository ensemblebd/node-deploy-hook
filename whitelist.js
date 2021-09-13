const dayjs = require("dayjs");
const axios = require('axios');

module.exports = function(config) {
    let self = this;
    this.last_refresh = null;
    this.whitelist = [];

    this.refreshIfNeeded = function() {
        if (self.last_refresh == null) return refresh();
        var next = self.last_refresh.add(config.refreshInterval, config.refreshIntervalType);
        if (self.last_refresh.isAfter(next)) return refresh();
    };

    var refresh=function() {
        self.last_refresh = dayjs();

        axios.get(config.github).then((response) => {
            for(let cidr of response.data.hooks) {
                self.whitelist.push(cidr);
            }
        });
        axios.get(config.bitbucket).then((response) => {
            for(let item of response.data.items) {
                self.whitelist.push(item.cidr);
            }
        });
        return self.whitelist;
    };
};