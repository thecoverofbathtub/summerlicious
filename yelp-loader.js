let async = require('async');
let cheerio = require('cheerio');
let fs = require('fs');
let superagent = require('superagent');
let url = require('url');

let YelpLoader = function() {
    this.template = 'https://www.yelp.com/search?find_desc=${restaurant}&find_loc=Toronto%2C+ON&ns=1';
    this.yelpUrl = 'https://www.yelp.com';
    this.dumpDetailsPath = './yelp.dump';
    this.dumpFailuresPath = './failures.dump';
    this.concurrencyLimit = 40;
    this.results = [];
    this.failures = [];
};

YelpLoader.prototype.getRestaurantDetails = function(restaurant) {
    let restaurantSearchUrl = this.getYelpSearchUrl(restaurant);
    return new Promise((resolve, reject) => {
        superagent.get(restaurantSearchUrl)
            .end((err, response) => {
                if (err) {
                    reject(err);
                    return;
                }
                let restaurantUrl = getRestaurantUrl(response.text, this.yelpUrl);
                if (restaurantUrl === undefined) {
                    this.failures.push(restaurant);
                    resolve(undefined);
                    return;
                }
                superagent.get(restaurantUrl)
                    .end((err, response) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        let details = getRestaurantDetailsFromPage(response.text);
                        if (details === undefined) {
                            this.failures.push(restaurant);
                            resolve(undefined);
                            return;
                        }
                        details.name = restaurant;
                        details.url = restaurantUrl;
                        resolve(details);
                    });
            });
    });
};

YelpLoader.prototype.getYelpSearchUrl = function(restaurant) {
    return this.template.replace('${restaurant}', encodeURI(restaurant));
};

YelpLoader.prototype.asyncQueueWorker = function(restaurant, callback) {
    console.log('Searching Yelp for ' + restaurant + ' ..');
    this.getRestaurantDetails(restaurant).then(details => {
        callback(null, details);
    }, err => {
        console.log(err);
    });
};

YelpLoader.prototype.asyncQueueCallback = function(err, details) {
    if (details === undefined) {
        console.log('ERROR HERE');
        return;
    }
    console.log('Finished pulling details of ' + details.name + ' ..');
    this.results.push(details);
};

YelpLoader.prototype.asyncQueueDrainer = function(resolve, reject) {
    return () => {
        saveDetailsToFile(this.dumpDetailsPath, this.results);
        saveFailuresToFile(this.dumpFailuresPath, this.failures);
        resolve(this.results);
    };
};

YelpLoader.prototype.run = function(restaurants, forceRefresh) {
    this.results = [];
    this.failures = [];
    return new Promise((resolve, reject) => {
        if (!forceRefresh) {
            let details = readDetailsFromFile(this.dumpDetailsPath);
            if (details !== undefined) {
                resolve(details);
                return;
            }
        }
        let q = async.queue(this.asyncQueueWorker.bind(this), this.concurrencyLimit);
        q.drain = this.asyncQueueDrainer(resolve).bind(this);
        restaurants.forEach(restaurant => {
            q.push(restaurant, this.asyncQueueCallback.bind(this));
        });
    });
};


function getRestaurantUrl(pageHtml, yelpUrl) {
    try {
        let $ = cheerio.load(pageHtml);
        let href = $('.indexed-biz-name > .biz-name').first().prop('href');
        return url.resolve(yelpUrl, href);
    } catch(ex) {
        console.log("Encountered problem at " + ex);
        return undefined;
    }
}

function getRestaurantDetailsFromPage(pageHtml) {
    try {
        let $ = cheerio.load(pageHtml);
        let reviewStars = $('.rating-very-large > meta').first().prop('content');
        let reviewCount = $('.review-count').first().text().trim();
        return {
            count: parseInt(reviewCount.match(/([0-9]*)\s.*/)[1]),
            stars: parseFloat(reviewStars)
        };
    } catch(ex) {
        console.log("Encountered problem at " + pageHtml);
        return undefined;
    }
}

function saveDetailsToFile(filePath, details) {
    fs.writeFile(filePath,
        JSON.stringify(details, null, 4),
        err => {
            if (err) {
                throw new Error(err);
            }
            console.log('Restaurant details saved successfully..');
        });
}

function readDetailsFromFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch(ex) {
        return undefined;
    }
}

function saveFailuresToFile(filePath, failures) {
    fs.writeFile(filePath,
        JSON.stringify(failures, null, 4),
        err => {
            if (err) {
                throw new Error(err);
            }
            console.log('Failed restaurants saved successfully..');
        });
}

module.exports = new YelpLoader();