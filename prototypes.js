

Object.prototype.merge = function(object) {
    for (const key in object) {
        if (object.hasOwnProperty(key)) {
            if (typeof this[key] === "object" && typeof object[key] === "object") {
                this[key].merge(object[key]);

                continue;
            }

            this[key] = object[key];
        }
    }

    return this;
};